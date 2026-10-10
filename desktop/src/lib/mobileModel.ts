// Geometry preparation reused from the mobile viewer. Keep rest-tip orientation consistent.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { computeTriangleQuaternion, poseSkeletonPiece, type PieceRestInfo } from './skeletonPose';
import { getRenderableBones, type Individual } from '../model';
import { CFA_GROUPS } from '../data/cfaSchema';

// Keep these values synchronized with mobile/src/data/skeletonPieces.ts and
// mobile/src/components/SceneViewport.tsx 
const HEAD_OFFSET_RATIO = 0.276;
const RIBCAGE_SCALE_BOUNDS: [number, number] = [0.85, 1.15];
const PELVIS_REST_TRIANGLE = {
  left: [0.126, 0.036, 0.047],
  right: [-0.126, 0.036, 0.047],
  anchor: [0, 0, 0],
} as const;
const REST_LANDMARKS: Record<string, readonly [number, number, number]> = {
  head_proximal: [0, 3.32, 0],
  chin: [0, 2.92, 0.115],
  manubrium: [0, 2.74, 0.0279],
  sacral_promontory: [0, 1.87, -0.109],
  left_ilium_superior: [0.242, 1.96, -0.0394],
  right_ilium_superior: [-0.242, 1.96, -0.0394],
  left_acetabulum: [0.144, 1.71, -0.0519],
  right_acetabulum: [-0.144, 1.71, -0.0519],
  left_knee: [0.143, 0.916, -0.0266],
  right_knee: [-0.143, 0.916, -0.0266],
  left_ischium: [0.0872, 1.57, -0.0684],
  right_ischium: [-0.0872, 1.57, -0.0684],
};
const EXTRA_SIDE_PAIRS: readonly (readonly (readonly [string, string])[])[] = [
  [['left_knee', 'right_knee'], ['left_ankle', 'right_ankle'], ['left_toes', 'right_toes']],
  [['left_elbow', 'right_elbow'], ['left_wrist', 'right_wrist'], ['left_fingertips', 'right_fingertips']],
];
const isMesh = (object: THREE.Object3D): object is THREE.Mesh => Boolean((object as THREE.Mesh).isMesh);

function bakePieceWorldTransform(pieceNode: THREE.Object3D): THREE.Group {
  const baked = new THREE.Group();
  baked.name = pieceNode.name;
  pieceNode.updateWorldMatrix(true, false);
  pieceNode.traverse((child) => {
    if (!(isMesh(child))) return;
    child.updateWorldMatrix(true, false);
    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    const mesh = new THREE.Mesh(geometry, child.material);
    mesh.name = child.name;
    baked.add(mesh);
  });
  return baked;
}

/**
 * The centroid of a piece's own real vertices sitting within a small band
 * of its extreme along one axis -- not a bounding-box corner, which is
 * frequently a point in thin air next to the mesh rather than on it (see
 * the comment on PieceRestInfo in lib/skeletonPose.ts for why that matters).
 */
function tipCentroid(baked: THREE.Object3D, axisIndex: 0 | 1 | 2, sign: 1 | -1, axisExtent: number): THREE.Vector3 {
  const probe = new THREE.Vector3();
  let extreme = sign > 0 ? -Infinity : Infinity;
  baked.traverse((child) => {
    if (!(isMesh(child))) return;
    const position = child.geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      probe.fromBufferAttribute(position, i);
      const value = probe.getComponent(axisIndex);
      if (sign > 0 ? value > extreme : value < extreme) extreme = value;
    }
  });

  const threshold = Math.max(axisExtent * 0.05, 1e-4);
  const sum = new THREE.Vector3();
  let count = 0;
  baked.traverse((child) => {
    if (!(isMesh(child))) return;
    const position = child.geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      probe.fromBufferAttribute(position, i);
      if (Math.abs(probe.getComponent(axisIndex) - extreme) <= threshold) {
        sum.add(probe);
        count += 1;
      }
    }
  });
  return count > 0 ? sum.divideScalar(count) : new THREE.Vector3();
}

/** A piece's own two extreme-tip candidates, before we know which one is
 * anatomically its `from` end versus its `to` end -- see
 * resolvePieceRestInfo, which turns this into a real PieceRestInfo. */
interface RawPieceGeometry {
  axisIndex: 0 | 1 | 2;
  tipMin: THREE.Vector3;
  tipMax: THREE.Vector3;
  topTip: THREE.Vector3;
}

function computeRawPieceGeometry(baked: THREE.Object3D): RawPieceGeometry {
  const box = new THREE.Box3().setFromObject(baked);
  const size = box.getSize(new THREE.Vector3());
  const axisIndex = ([0, 1, 2] as const).reduce(
    (longest, index) => (size.getComponent(index) > size.getComponent(longest) ? index : longest),
    0 as 0 | 1 | 2,
  );
  return {
    axisIndex,
    tipMin: tipCentroid(baked, axisIndex, -1, size.getComponent(axisIndex)),
    tipMax: tipCentroid(baked, axisIndex, 1, size.getComponent(axisIndex)),
    topTip: tipCentroid(baked, 1, 1, size.y),
  };
}

function resolvePieceRestInfo(rawByName: Map<string, RawPieceGeometry>, modelScale: number): Map<string, PieceRestInfo> {
  const resolved = new Map<string, PieceRestInfo>();
  const restPoint = (name: string) => {
    const position = REST_LANDMARKS[name];
    return position ? new THREE.Vector3(...position).multiplyScalar(modelScale) : undefined;
  };

  const withOrder = (raw: RawPieceGeometry, fromTip: THREE.Vector3, toTip: THREE.Vector3): PieceRestInfo => ({
    axisIndex: raw.axisIndex,
    fromTip,
    toTip,
    topTip: raw.topTip,
  });

  // The spine is the one piece we can orient outright: in the rest pose
  // (standing upright) its sacral (from) end is simply the lower of its
  // own two tips, its manubrium (to) end the higher.
  const spineRaw = rawByName.get("SK_Spine");
  if (!spineRaw) return resolved;
  const spineLower = spineRaw.tipMin.y < spineRaw.tipMax.y ? spineRaw.tipMin : spineRaw.tipMax;
  const spineUpper = spineRaw.tipMin.y < spineRaw.tipMax.y ? spineRaw.tipMax : spineRaw.tipMin;
  resolved.set("SK_Spine", withOrder(
    spineRaw,
    restPoint("sacral_promontory") ?? spineLower,
    restPoint("head_proximal") ?? spineUpper,
  ));

  // The pelvis is a single-landmark piece -- its only meaningful reference
  // point is its own top (see the single-target branch in
  // poseSkeletonPiece), which also doubles as the rest-pose anchor the
  // upper legs resolve against below.
  const coccyxRaw = rawByName.get("SK_Coccyx");
  if (coccyxRaw) {
    const pelvisAnchor = restPoint("sacral_promontory") ?? coccyxRaw.topTip;
    resolved.set("SK_Coccyx", { ...withOrder(coccyxRaw, pelvisAnchor, pelvisAnchor), topTip: pelvisAnchor });
  }

  const sideRaw = rawByName.get("SK_Side");
  const restSacrum = restPoint("sacral_promontory");
  if (sideRaw && restSacrum) {
    const meshTop = sideRaw.tipMin.y < sideRaw.tipMax.y ? sideRaw.tipMax : sideRaw.tipMin;
    resolved.set("SK_Side", withOrder(sideRaw, restSacrum, restPoint("manubrium") ?? meshTop));
  }

  function resolveAgainst(nodeName: string, anchor: THREE.Vector3 | undefined, invert = false): void {
    const raw = rawByName.get(nodeName);
    if (!raw || !anchor) return;
    const dMin = raw.tipMin.distanceTo(anchor);
    const dMax = raw.tipMax.distanceTo(anchor);
    const nearTip = dMin < dMax ? raw.tipMin : raw.tipMax;
    const farTip = dMin < dMax ? raw.tipMax : raw.tipMin;
    const fromTip = invert ? farTip : nearTip;
    const toTip = invert ? nearTip : farTip;
    resolved.set(nodeName, withOrder(raw, fromTip, toTip));
  }

  resolveAgainst("SK_RClavicle", restPoint("manubrium"), true);
  resolveAgainst("SK_LClavicle", restPoint("manubrium"), true);
  resolveAgainst("SK_RArmUp", resolved.get("SK_RClavicle")?.fromTip);
  resolveAgainst("SK_LArmUp", resolved.get("SK_LClavicle")?.fromTip);
  resolveAgainst("SK_RArmDown", resolved.get("SK_RArmUp")?.toTip);
  resolveAgainst("SK_LArmDown", resolved.get("SK_LArmUp")?.toTip);
  resolveAgainst("SK_HandR", resolved.get("SK_RArmDown")?.toTip);
  resolveAgainst("SK_HandL", resolved.get("SK_LArmDown")?.toTip);
  resolveAgainst("SK_RLegUp", resolved.get("SK_Coccyx")?.topTip);
  resolveAgainst("SK_LLegUp", resolved.get("SK_Coccyx")?.topTip);
  resolveAgainst("SK_RLegDown", resolved.get("SK_RLegUp")?.toTip);
  resolveAgainst("SK_LLegDown", resolved.get("SK_LLegUp")?.toTip);
  resolveAgainst("SK_RFoot", resolved.get("SK_RLegDown")?.toTip);
  resolveAgainst("SK_LFoot", resolved.get("SK_LLegDown")?.toTip);
  resolveAgainst("SK_Head", restPoint("chin") ?? resolved.get("SK_Spine")?.toTip);

  return resolved;
}


export type ModelPieces = Map<string, { object: THREE.Group; rest: PieceRestInfo }>;
const NAMES = ['SK_Head', 'SK_Spine', 'SK_Side', 'SK_Coccyx', ...['L', 'R'].flatMap(s => [`SK_${s}Clavicle`, `SK_${s}ArmUp`, `SK_${s}ArmDown`, `SK_Hand${s}`, `SK_${s}LegUp`, `SK_${s}LegDown`, `SK_${s}Foot`])];

export function disposeModel(pieces: ModelPieces) {
  pieces.forEach(({ object }) => object.traverse(child => {
    if (!(isMesh(child))) return;
    child.geometry.dispose();
    (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => m.dispose());
  }));
}

export async function loadMobileModel(): Promise<ModelPieces> {
  const gltf = await new GLTFLoader().loadAsync(new URL('models/skeleton_pre-cut.glb', new URL(import.meta.env.BASE_URL, document.baseURI)).href);
  gltf.scene.updateMatrixWorld(true);
  const baked = new Map<string, THREE.Group>();
  const box = new THREE.Box3();
  for (const name of NAMES) {
    const source = gltf.scene.getObjectByName(name);
    if (!source) continue;
    const object = bakePieceWorldTransform(source);
    object.traverse(child => {
      if (!(isMesh(child))) return;
      const materials = (Array.isArray(child.material) ? child.material : [child.material]).map(m => {
        const material = m.clone() as THREE.MeshStandardMaterial;
        if (material.color) material.color.lerp(new THREE.Color('#D8CBB7'), .3);
        material.roughness = Math.max(material.roughness ?? .6, .58);
        material.metalness = Math.min(material.metalness ?? 0, .08);
        return material;
      });
      child.material = Array.isArray(child.material) ? materials : materials[0];
    });
    baked.set(name, object); box.union(new THREE.Box3().setFromObject(object));
  }
  gltf.scene.traverse(child => {
    if (!(isMesh(child))) return;
    child.geometry.dispose();
    (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => m.dispose());
  });
  if (box.isEmpty()) throw new Error('No anatomical mesh geometry was loaded.');
  const scale = 1.7 / Math.max(box.getSize(new THREE.Vector3()).y, .001);
  const raw = new Map<string, RawPieceGeometry>();
  baked.forEach((object, name) => {
    object.traverse(child => { if (isMesh(child)) child.geometry.scale(scale, scale, scale); });
    raw.set(name, computeRawPieceGeometry(object));
  });
  const rests = resolvePieceRestInfo(raw, scale);
  const result: ModelPieces = new Map();
  baked.forEach((object, name) => { const rest = rests.get(name); if (rest) result.set(name, { object, rest }); });
  if (result.size !== NAMES.length) { disposeModel(result); throw new Error('The mobile reference model is missing required bone pieces.'); }
  return result;
}

const complete = (p: (number | null)[] | undefined): p is number[] => !!p && p.length === 3 && p.every(n => typeof n === 'number' && Number.isFinite(n));
const toModel = (p: readonly number[]) => new THREE.Vector3(p[0], -p[2], p[1]);
const MODEL_TO_SCENE_ROTATION = Math.PI / 2;

/** Convert survey coordinates into the same Z-up scene frame as the anatomical mesh. */
export const surveyPointToScene = (p: readonly number[]) =>
  toModel(p).applyAxisAngle(new THREE.Vector3(1, 0, 0), MODEL_TO_SCENE_ROTATION);

// --- Pelvis orientation from the two ASIS points + sacral promontory (same idea as mobile's orientationTriangle) ---
// Rest triangle, authored as [x = left, front, up] in the pelvis mesh's own frame.
// Copy these from `orientationTriangle` in the mobile skeletonPieces.ts if they change there.
const pelvisRestToModel = (r: readonly number[]) => new THREE.Vector3(r[0], r[2], r[1]);

/** Pose the actual mobile meshes from each contributing bone's own coordinates. */
export function createAnatomicalSkeleton(individual: Individual, templates: ModelPieces, selectedJointId?: string): THREE.Group {
  const root = new THREE.Group();
  root.rotation.x = MODEL_TO_SCENE_ROTATION; // Mobile meshes are Y-up; the desktop scene is Z-up.
  const bones = new Map(getRenderableBones(individual).map(b => [b.id, b]));
  const absentGroups = individual.absentGroups ?? [];

  // Landmarks (head, chin, sacral promontory, shoulders...) are read from the
  // joint's first endpoint, regardless of bone inventory.
  const landmark = (jointId: string) => {
    const joint = individual.joints.find(j => j.id === jointId);
    const pointGroup = CFA_GROUPS.find(group => (group.points as readonly string[]).includes(jointId))?.id;
    for (const [index, endpoint] of joint?.endpoints.entries() ?? []) {
      const groupId = jointId.endsWith('_acetabulum') && index === 1
        ? `${jointId.startsWith('left_') ? 'left' : 'right'}_leg`
        : pointGroup;
      if ((groupId === 'sacrum' && absentGroups.includes(groupId))
        || (endpoint.boneId && !bones.has(endpoint.boneId))) continue;
      if (complete(endpoint.coordinate)) return toModel(endpoint.coordinate);
    }
    return undefined;
  };

  // Head, spine and ribcage used to hang off the old "spine" bone.
  // The sternum bone ("Head & torso" group) now controls them.
  const sternumPresent = individual.bones.find(b => b.id === 'sternum')?.status === 'present';
  const headPresent = sternumPresent && !absentGroups.includes('head');
  const torsoPresent = sternumPresent && !absentGroups.includes('spine_ribcage');
  const spineRest = templates.get('SK_Spine')!.rest;
  const headRaw = landmark('head_proximal');
  const sacrumRaw = landmark('sacral_promontory');
  const recordedLandmark = (jointId: string) => {
    const coordinate = individual.joints.find(j => j.id === jointId)?.endpoints[0]?.coordinate;
    return complete(coordinate) ? toModel(coordinate) : undefined;
  };
  const headForScale = recordedLandmark('head_proximal');
  const sacrumForScale = recordedLandmark('sacral_promontory');
  const manubriumForScale = recordedLandmark('manubrium');
  const manubrium = landmark('manubrium');
  const modelScale = spineRest.fromTip.distanceTo(spineRest.toTip)
    / new THREE.Vector3(...REST_LANDMARKS.sacral_promontory).distanceTo(new THREE.Vector3(...REST_LANDMARKS.head_proximal));
  const restLandmark = (id: string) => {
    const value = REST_LANDMARKS[id];
    return value ? new THREE.Vector3(...value).multiplyScalar(modelScale) : undefined;
  };
  const restLength = (from: string, to: string) => {
    const a = restLandmark(from);
    const b = restLandmark(to);
    return a && b ? a.distanceTo(b) : undefined;
  };
  const scaleMeasures: [number | undefined, number | undefined][] = [
    [headForScale && sacrumForScale ? headForScale.distanceTo(sacrumForScale) : undefined, spineRest.fromTip.distanceTo(spineRest.toTip)],
    [manubriumForScale && sacrumForScale ? manubriumForScale.distanceTo(sacrumForScale) : undefined, restLength('sacral_promontory', 'manubrium')],
  ];
  for (const side of ['left', 'right']) {
    const femur = bones.get(`${side}_femur`);
    scaleMeasures.push([
      femur ? toModel(femur.from).distanceTo(toModel(femur.to)) : undefined,
      restLength(`${side}_acetabulum`, `${side}_knee`),
    ]);
  }
  const leftIlium = landmark('left_ilium_superior');
  const rightIlium = landmark('right_ilium_superior');
  scaleMeasures.push([
    leftIlium && rightIlium ? leftIlium.distanceTo(rightIlium) : undefined,
    restLength('left_ilium_superior', 'right_ilium_superior'),
  ]);
  const selectedScaleMeasure = scaleMeasures.find(([actual, expected]) => actual !== undefined && expected !== undefined && expected > 1e-6);
  const resolvedBodyScale = selectedScaleMeasure
    ? selectedScaleMeasure[0]! / selectedScaleMeasure[1]!
    : 1;

  const estimateSacrum = (): THREE.Vector3 | undefined => {
    const restSacrum = restLandmark('sacral_promontory');
    if (!restSacrum) return undefined;
    const pairs = [
      [['left_ilium_superior', 'right_ilium_superior'], ['left_acetabulum', 'right_acetabulum']],
      [['left_ilium_superior', 'right_ilium_superior'], ['left_ischium', 'right_ischium']],
      [['left_acetabulum', 'right_acetabulum'], ['left_ischium', 'right_ischium']],
    ] as const;
    for (const [[sideLeftId, sideRightId], [referenceLeftId, referenceRightId]] of pairs) {
      const sideLeft = landmark(sideLeftId);
      const sideRight = landmark(sideRightId);
      const referenceLeft = landmark(referenceLeftId);
      const referenceRight = landmark(referenceRightId);
      const restSideLeft = restLandmark(sideLeftId);
      const restSideRight = restLandmark(sideRightId);
      const restReferenceLeft = restLandmark(referenceLeftId);
      const restReferenceRight = restLandmark(referenceRightId);
      if (!sideLeft || !sideRight || !referenceLeft || !referenceRight
        || !restSideLeft || !restSideRight || !restReferenceLeft || !restReferenceRight) continue;
      const anchor = referenceLeft.clone().add(referenceRight).multiplyScalar(0.5);
      const restAnchor = restReferenceLeft.clone().add(restReferenceRight).multiplyScalar(0.5);
      const rotation = computeTriangleQuaternion(
        restSideLeft, restSideRight, restAnchor,
        sideRight, sideLeft, anchor,
      );
      if (!rotation) continue;
      return anchor.add(restSacrum.sub(restAnchor).multiplyScalar(resolvedBodyScale).applyQuaternion(rotation));
    }
    return undefined;
  };
  const sacrum = sacrumRaw ?? estimateSacrum();

  const add = (
    name: string,
    from: THREE.Vector3 | undefined,
    to: THREE.Vector3 | undefined,
    stretch: 'rod' | 'uniform' | 'anchor' = 'rod',
    twist?: THREE.Vector3,
    twistForward?: THREE.Vector3,
    orientationOverride?: THREE.Quaternion,
    scaleBounds?: [number, number],
    visible = true,
  ) => {
    const template = templates.get(name);
    if (!template || !from || !to) return;
    const piece = template.object.clone(true);
    piece.traverse(child => {
      if (!(isMesh(child))) return;
      child.userData.sharedGeometry = true;
      child.castShadow = false; child.receiveShadow = false;
      const materials = (Array.isArray(child.material) ? child.material : [child.material]).map(() => {
        const material = new THREE.MeshStandardMaterial({
          color: individual.color,
          roughness: 0.6,
          metalness: 0,
        });
        return material;
      });
      child.material = Array.isArray(child.material) ? materials : materials[0];
    });
    poseSkeletonPiece(
      piece, template.rest, from, to, stretch, twist, resolvedBodyScale,
      twistForward, undefined, orientationOverride, scaleBounds,
    );
    piece.visible = visible;
    root.add(piece);
  };

  const head = headRaw;

  // The mobile view derives torso facing from left/right axes, not pair
  // midpoints, which can sit behind the torso and make it face backwards.
  const torsoTwistTarget = (from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 | undefined => {
    const axis = to.clone().sub(from);
    if (axis.lengthSq() < 1e-9) return undefined;
    axis.normalize();
    const perpendicular = (vector: THREE.Vector3) => {
      vector.addScaledVector(axis, -vector.dot(axis));
      return vector.lengthSq() > 1e-8 ? vector.normalize() : undefined;
    };
    const pairs = [
      ['left_ilium_superior', 'right_ilium_superior'],
      ['left_shoulder', 'right_shoulder'],
    ] as const;
    let left: THREE.Vector3 | undefined;
    for (const [leftId, rightId] of pairs) {
      const leftPoint = landmark(leftId);
      const rightPoint = landmark(rightId);
      if (leftPoint && rightPoint) {
        left = perpendicular(leftPoint.sub(rightPoint));
        if (left) break;
      }
    }
    if (!left) {
      for (const id of [...pairs.flat(), 'left_acetabulum', 'right_acetabulum']) {
        const point = landmark(id);
        if (!point) continue;
        const lateral = perpendicular(point.sub(from));
        if (lateral) {
          left = id.startsWith('left_') ? lateral : lateral.negate();
          break;
        }
      }
      if (!left) {
        for (const group of EXTRA_SIDE_PAIRS) {
          const sum = new THREE.Vector3();
          for (const [leftId, rightId] of group) {
            const leftPoint = landmark(leftId);
            const rightPoint = landmark(rightId);
            if (!leftPoint || !rightPoint) continue;
            const direction = perpendicular(leftPoint.sub(rightPoint));
            if (direction) sum.add(direction);
          }
          if (sum.lengthSq() > 1e-8) {
            left = sum.normalize();
            break;
          }
        }
      }
    }
    if (left) {
      return from.clone().add(new THREE.Vector3().crossVectors(axis, left).normalize().multiplyScalar(0.1));
    }

    const chin = landmark('chin');
    if (!chin) return undefined;
    const bodyAxis = headRaw ? headRaw.clone().sub(from).normalize() : axis;
    const chinOffset = chin.sub(from);
    chinOffset.addScaledVector(bodyAxis, -chinOffset.dot(bodyAxis));
    return chinOffset.lengthSq() > 1e-8
      ? from.clone().add(chinOffset.normalize().multiplyScalar(0.1))
      : undefined;
  };

  let ribcagePiece: THREE.Object3D | undefined;
  if (sacrum && manubrium) {
    const beforeRibcage = root.children.length;
    add(
      'SK_Side', sacrum, manubrium, 'uniform',
      torsoTwistTarget(sacrum, manubrium),
      undefined, undefined, RIBCAGE_SCALE_BOUNDS,
      torsoPresent,
    );
    if (root.children.length > beforeRibcage) ribcagePiece = root.children[root.children.length - 1];
  }

  // Mobile poses the ribcage before the spine; it carries head_proximal
  // with the ribcage when the head landmark is not recorded.
  let carriedHead: THREE.Vector3 | undefined;
  if (!headRaw && ribcagePiece) {
    ribcagePiece.updateMatrix();
    carriedHead = spineRest.toTip.clone().applyMatrix4(ribcagePiece.matrix);
  }
  const spineHead = headRaw ?? carriedHead;
  const beforeSpine = root.children.length;
  if (sacrum && spineHead) {
    add('SK_Spine', sacrum, spineHead, 'rod', torsoTwistTarget(sacrum, spineHead), undefined, undefined, undefined, torsoPresent && Boolean(manubrium));
  }
  const spinePiece = root.children.length > beforeSpine ? root.children[root.children.length - 1] : undefined;

  let bodyUp = head && sacrum ? head.clone().sub(sacrum) : undefined;
  if ((!bodyUp || bodyUp.lengthSq() < 1e-9) && head) {
    const lowerPoints = manubrium
      ? [manubrium]
      : ['left_acetabulum', 'right_acetabulum', 'left_ilium_superior', 'right_ilium_superior', 'left_ischium', 'right_ischium']
          .map(landmark).filter((point): point is THREE.Vector3 => point !== undefined);
    if (lowerPoints.length > 0) {
      const base = lowerPoints.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(lowerPoints.length);
      bodyUp = head.clone().sub(base);
    }
  }
  if (bodyUp && bodyUp.lengthSq() > 1e-9) bodyUp.normalize();
  else bodyUp = undefined;
  const spineLength = head && sacrum ? sacrum.distanceTo(head) : spineRest.fromTip.distanceTo(spineRest.toTip);

  if (head) {
    const headFrom = bodyUp
      ? head.clone().addScaledVector(bodyUp, -HEAD_OFFSET_RATIO * spineLength)
      : head;
    add('SK_Head', headFrom, head, 'anchor', landmark('chin'), undefined, undefined, undefined, headPresent);
  }

  // Orient the pelvis from the same measured triangle as the mobile view.
  const pelvisPresent = individual.bones.find(b => b.id === 'pelvis')?.status === 'present'
    && (!absentGroups.includes('left_pelvis') || !absentGroups.includes('right_pelvis'));
  const hasPelvisLandmark = [
    'left_ilium_superior', 'right_ilium_superior',
    'left_ischium', 'right_ischium',
    'left_acetabulum', 'right_acetabulum',
  ].some(id => landmark(id) !== undefined);
  if (pelvisPresent && hasPelvisLandmark && sacrum) {
    const leftAsis = landmark('left_ilium_superior');
    const rightAsis = landmark('right_ilium_superior');
    const triangleQuat = leftAsis && rightAsis
      ? computeTriangleQuaternion(
          pelvisRestToModel(PELVIS_REST_TRIANGLE.left),
          pelvisRestToModel(PELVIS_REST_TRIANGLE.right),
          pelvisRestToModel(PELVIS_REST_TRIANGLE.anchor),
          rightAsis, leftAsis, sacrum,
        )
      : undefined;
    add('SK_Coccyx', sacrum, sacrum, 'anchor', undefined, undefined, triangleQuat ?? spinePiece?.quaternion, undefined, pelvisPresent);
  }

  const addFollowingTorso = (
    name: string,
    from: THREE.Vector3,
    to: THREE.Vector3,
    stretch: 'rod' | 'uniform' | 'anchor',
  ) => {
    const template = templates.get(name);
    if (!template) return;
    let twist: THREE.Vector3 | undefined;
    let twistForward: THREE.Vector3 | undefined;
    if (ribcagePiece) {
      const aim = to.clone().sub(from);
      if (aim.lengthSq() > 1e-12) {
        aim.normalize();
        const restAxis = template.rest.toTip.clone().sub(template.rest.fromTip).normalize();
        const candidates = [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)];
        candidates.sort((a, b) => Math.abs(a.dot(restAxis)) - Math.abs(b.dot(restAxis)));
        const side = candidates[0];
        const torsoQuaternion = ribcagePiece.quaternion;
        const localAim = new THREE.Quaternion().setFromUnitVectors(
          restAxis,
          aim.clone().applyQuaternion(torsoQuaternion.clone().invert()),
        );
        twistForward = side;
        twist = from.clone().addScaledVector(
          side.clone().applyQuaternion(localAim).applyQuaternion(torsoQuaternion),
          0.1,
        );
      }
    }
    add(name, from, to, stretch, twist, twistForward);
  };

  for (const [side, prefix] of [['left', 'L'], ['right', 'R']]) {
    const pairs: [string, string, 'rod' | 'anchor'][] = [
      [`${side}_clavicle`, `SK_${prefix}Clavicle`, 'anchor'],
      [`${side}_humerus`, `SK_${prefix}ArmUp`, 'rod'], [`${side}_forearm`, `SK_${prefix}ArmDown`, 'rod'],
      [`${side}_hand`, `SK_Hand${prefix === 'L' ? 'R' : 'L'}`, 'anchor'], [`${side}_femur`, `SK_${prefix}LegUp`, 'rod'],
      [`${side}_lower_leg`, `SK_${prefix}LegDown`, 'rod'], [`${side}_foot`, `SK_${prefix}Foot`, 'anchor'],
    ];
    for (const [owner, name, stretch] of pairs) {
      const bone = bones.get(owner);
      if (!bone || bone.to === undefined) continue;
      const from = toModel(bone.from);
      const to = toModel(bone.to);
      if (name.endsWith('Clavicle')) {
        add(name, to, from, stretch);
      } else if (name.includes('Arm') || name.includes('Hand')) {
        addFollowingTorso(name, from, to, stretch);
      } else {
        add(name, from, to, stretch);
      }
    }
  }
  void selectedJointId;
  return root;
}
