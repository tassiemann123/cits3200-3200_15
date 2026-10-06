// Geometry preparation reused from the mobile viewer. Keep rest-tip orientation consistent.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { poseSkeletonPiece, type PieceRestInfo } from './skeletonPose';
import { getRenderableBones, type Individual } from '../model';

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

/**
 * Turns each piece's raw, direction-agnostic tip pair into a real
 * PieceRestInfo whose `fromTip`/`toTip` genuinely match its `from`/`to`
 * landmark (see the PieceRestInfo comment in lib/skeletonPose.ts for why
 * this can't just be guessed per-pose).
 *
 * This is resolved once, from the rest-pose model alone, by walking the
 * body outward from the spine: each piece's own two tips are compared
 * against the *already-resolved* neighbour it physically joins in the
 * rest pose (found via the shared landmark name in SKELETON_PIECES, e.g.
 * the forearm's "elbow" end and the upper arm's "elbow" end), and
 * whichever tip sits closer to that neighbour is this piece's `fromTip`.
 * A few pieces have no such name-sharing predecessor (the legs' hip end,
 * and the skull) -- those resolve against the nearest fixed rest-pose
 * landmark instead (the pelvis piece's own top, and the spine's top).
 */
function resolvePieceRestInfo(rawByName: Map<string, RawPieceGeometry>): Map<string, PieceRestInfo> {
  const resolved = new Map<string, PieceRestInfo>();

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
  resolved.set("SK_Spine", withOrder(spineRaw, spineLower, spineUpper));

  const sideRaw = rawByName.get("SK_Side");
  if (sideRaw) {
    const sideLower = sideRaw.tipMin.y < sideRaw.tipMax.y ? sideRaw.tipMin : sideRaw.tipMax;
    const sideUpper = sideRaw.tipMin.y < sideRaw.tipMax.y ? sideRaw.tipMax : sideRaw.tipMin;
    resolved.set("SK_Side", withOrder(sideRaw, sideLower, sideUpper));
  }

  // The pelvis is a single-landmark piece -- its only meaningful reference
  // point is its own top (see the single-target branch in
  // poseSkeletonPiece), which also doubles as the rest-pose anchor the
  // upper legs resolve against below.
  const coccyxRaw = rawByName.get("SK_Coccyx");
  if (coccyxRaw) {
    resolved.set("SK_Coccyx", withOrder(coccyxRaw, coccyxRaw.topTip, coccyxRaw.topTip));
  }

  function resolveAgainst(nodeName: string, anchor: THREE.Vector3 | undefined): void {
    const raw = rawByName.get(nodeName);
    if (!raw || !anchor) return;
    const dMin = raw.tipMin.distanceTo(anchor);
    const dMax = raw.tipMax.distanceTo(anchor);
    const fromTip = dMin < dMax ? raw.tipMin : raw.tipMax;
    const toTip = dMin < dMax ? raw.tipMax : raw.tipMin;
    resolved.set(nodeName, withOrder(raw, fromTip, toTip));
  }

  resolveAgainst("SK_RClavicle", resolved.get("SK_Spine")?.toTip);
  resolveAgainst("SK_LClavicle", resolved.get("SK_Spine")?.toTip);
  resolveAgainst("SK_RArmUp", resolved.get("SK_RClavicle")?.toTip);
  resolveAgainst("SK_LArmUp", resolved.get("SK_LClavicle")?.toTip);
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
  resolveAgainst("SK_Head", resolved.get("SK_Spine")?.toTip);

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
  const rests = resolvePieceRestInfo(raw);
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

// Same value as `offsetFromRatio` for SK_Head in the mobile skeletonPieces.ts.
const HEAD_OFFSET_RATIO = 0.143;

// --- Pelvis orientation from the two ASIS points + sacral promontory (same idea as mobile's orientationTriangle) ---
// Rest triangle, authored as [x = left, front, up] in the pelvis mesh's own frame.
// Copy these from `orientationTriangle` in the mobile skeletonPieces.ts if they change there.
const PELVIS_REST_TRIANGLE = {
  left: [0.19, 0.03, 0.041],
  right: [-0.19, 0.03, 0.041],
  anchor: [0, 0, 0],
} as const;
const pelvisRestToModel = (r: readonly number[]) => new THREE.Vector3(r[0], r[2], r[1]);

/** Orthonormal frame from three points: x = right->left, y/z from the anchor's offset off that line. */
function frameFromTriangle(left: THREE.Vector3, right: THREE.Vector3, anchor: THREE.Vector3): THREE.Matrix4 | undefined {
  const xAxis = new THREE.Vector3().subVectors(left, right);
  if (xAxis.lengthSq() < 1e-10) return undefined;
  xAxis.normalize();
  const midpoint = new THREE.Vector3().addVectors(left, right).multiplyScalar(0.5);
  const towardAnchor = new THREE.Vector3().subVectors(anchor, midpoint);
  const inPlane = towardAnchor.addScaledVector(xAxis, -towardAnchor.dot(xAxis));
  if (inPlane.lengthSq() < 1e-10) return undefined;
  inPlane.normalize();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, inPlane).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  return new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
}

/** Rotation taking the rest triangle's frame to the entered triangle's frame. */
function computeTriangleQuaternion(
  restLeft: THREE.Vector3, restRight: THREE.Vector3, restAnchor: THREE.Vector3,
  curLeft: THREE.Vector3, curRight: THREE.Vector3, curAnchor: THREE.Vector3,
): THREE.Quaternion | undefined {
  const restFrame = frameFromTriangle(restLeft, restRight, restAnchor);
  const curFrame = frameFromTriangle(curLeft, curRight, curAnchor);
  if (!restFrame || !curFrame) return undefined;
  const restQuat = new THREE.Quaternion().setFromRotationMatrix(restFrame);
  const curQuat = new THREE.Quaternion().setFromRotationMatrix(curFrame);
  return curQuat.multiply(restQuat.invert());
}

/** Pose the actual mobile meshes from each contributing bone's own coordinates. */
export function createAnatomicalSkeleton(individual: Individual, templates: ModelPieces, selectedJointId?: string): THREE.Group {
  const root = new THREE.Group();
  root.rotation.x = MODEL_TO_SCENE_ROTATION; // Mobile meshes are Y-up; the desktop scene is Z-up.
  const bones = new Map(getRenderableBones(individual).map(b => [b.id, b]));

  // Landmarks (head, chin, sacral promontory, shoulders...) are read from the
  // joint's first endpoint, regardless of bone inventory.
  const landmark = (jointId: string) => {
    const value = individual.joints.find(j => j.id === jointId)?.endpoints[0]?.coordinate;
    return complete(value) ? toModel(value) : undefined;
  };

  // Head, spine and ribcage used to hang off the old "spine" bone.
  // The sternum bone ("Head & torso" group) now controls them.
  const torsoPresent = individual.bones.find(b => b.id === 'sternum')?.status === 'present';

  const selectedBones = new Set(individual.joints.find(j => j.id === selectedJointId)?.endpoints.map(e => e.boneId));
  const spineRest = templates.get('SK_Spine')!.rest;

  // bodyScale is this skeleton's size relative to the template. It comes from the
  // raw recorded head and sacral coordinates, so it does not change when the
  // torso is hidden.
  const headRaw = landmark('head_proximal');
  const sacrumRaw = landmark('sacral_promontory');
  const bodyScale = headRaw && sacrumRaw
    ? Math.min(2, Math.max(.25, headRaw.distanceTo(sacrumRaw) / spineRest.fromTip.distanceTo(spineRest.toTip)))
    : 1;

  const add = (name: string, owner: string, from: THREE.Vector3 | undefined, to: THREE.Vector3 | undefined, stretch: 'rod' | 'uniform' | 'anchor' = 'rod', twist?: THREE.Vector3) => {
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
    poseSkeletonPiece(piece, template.rest, from, to, stretch, twist, bodyScale);
    if (from.distanceToSquared(to) < 1e-8) {
      piece.scale.setScalar(bodyScale);
      piece.position.copy(from).sub(template.rest.topTip.clone().multiplyScalar(bodyScale));
    }
    root.add(piece);
  };

  const head = torsoPresent ? headRaw : undefined;
  const sacrum = sacrumRaw;

  // Shoulder midpoint: twist target for both the spine and the ribcage (as in mobile).
  const leftShoulder = landmark('left_shoulder');
  const rightShoulder = landmark('right_shoulder');
  const shoulderMid = leftShoulder && rightShoulder
    ? leftShoulder.clone().lerp(rightShoulder, .5)
    : leftShoulder ?? rightShoulder;

  // Spine: sacral promontory up to the top of the head, twisted toward the shoulders (as in mobile).
  const beforeSpine = root.children.length;
  if (torsoPresent && head && sacrum) add('SK_Spine', 'sternum', sacrum, head, 'rod', shoulderMid);
  const spinePiece = root.children.length > beforeSpine ? root.children[root.children.length - 1] : undefined;

  const bodyUp = torsoPresent && head && sacrum ? head.clone().sub(sacrum).normalize() : undefined;
  const spineLength = torsoPresent && head && sacrum ? sacrum.distanceTo(head) : undefined;

  // Head: same as mobile's SK_Head spec (stretch "anchor", offsetFromRatio 0.143, twist "chin").
  // The base sits HEAD_OFFSET_RATIO of the spine length below head_proximal along body-up,
  // and the chin is passed as the twist target so poseSkeletonPiece turns the face toward it.
  // With no spine direction it is placed at head_proximal unrotated (mobile's single-landmark branch).
  if (head) {
    const headFrom = bodyUp && spineLength !== undefined
      ? head.clone().addScaledVector(bodyUp, -HEAD_OFFSET_RATIO * spineLength)
      : head;
    add('SK_Head', 'sternum', headFrom, head, 'anchor', landmark('chin'));
  }

  // Pelvis: needs both acetabula and the sacral promontory (see getRenderableBones).
  // Oriented from the two ASIS points + sacral promontory, falling back to the spine's rotation.
  if (bones.has('pelvis')) {
    const before = root.children.length;
    add('SK_Coccyx', 'pelvis', sacrum, sacrum, 'anchor');
    if (root.children.length > before && sacrum) {
      const pelvis = root.children[root.children.length - 1];
      const leftAsis = landmark('left_ilium_superior');
      const rightAsis = landmark('right_ilium_superior');
      const triangleQuat = leftAsis && rightAsis
        ? computeTriangleQuaternion(
            pelvisRestToModel(PELVIS_REST_TRIANGLE.left),
            pelvisRestToModel(PELVIS_REST_TRIANGLE.right),
            pelvisRestToModel(PELVIS_REST_TRIANGLE.anchor),
            rightAsis, leftAsis, sacrum, // swap if the pelvis comes out back-to-front
          )
        : undefined;
      const q = triangleQuat ?? (spinePiece ? spinePiece.quaternion.clone() : new THREE.Quaternion());
      pelvis.quaternion.copy(q);
      pelvis.scale.setScalar(bodyScale);
      pelvis.position.copy(sacrum).sub(
        templates.get('SK_Coccyx')!.rest.topTip.clone().multiplyScalar(bodyScale).applyQuaternion(q),
      );
    }
  }

  // Ribcage: sacrum -> manubrium, twisted toward the shoulder midpoint (as in mobile).
  // Without a manubrium it aims at the shoulder midpoint with no twist.
  const manubrium = landmark('manubrium');
  const ribTop = manubrium ?? shoulderMid;
  if (torsoPresent && sacrum && ribTop) {
    add('SK_Side', 'sternum', sacrum, ribTop, 'uniform', manubrium ? shoulderMid : undefined);
  }

  // Clavicles now run from the manubrium to each shoulder, as recorded.
  for (const [side, prefix] of [['left', 'L'], ['right', 'R']]) {
    const pairs: [string, string, 'rod' | 'anchor'][] = [
      [`${side}_clavicle`, `SK_${prefix}Clavicle`, 'anchor'],
      [`${side}_humerus`, `SK_${prefix}ArmUp`, 'rod'], [`${side}_forearm`, `SK_${prefix}ArmDown`, 'rod'],
      [`${side}_hand`, `SK_Hand${prefix}`, 'anchor'], [`${side}_femur`, `SK_${prefix}LegUp`, 'rod'],
      [`${side}_lower_leg`, `SK_${prefix}LegDown`, 'rod'], [`${side}_foot`, `SK_${prefix}Foot`, 'anchor'],
    ];
    for (const [owner, name, stretch] of pairs) { const bone = bones.get(owner); if (bone && bone.to !== undefined) add(name, owner, toModel(bone.from), toModel(bone.to), stretch); }
  }
  void selectedBones;
  return root;
}
