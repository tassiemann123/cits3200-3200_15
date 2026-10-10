/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG, 
 * RUAN VAN ZYL
 * 
 * File Function:
 * Generates the 3D skeleton viewport, loads the GLB, poses the mesh pieces
 * after every coordinate change and includes the viewing feature support
 * for camera, grid and landmark pins. The landmark associations are in 
 * skeletonPieces.ts and the maths for posing in skeletonPose.ts.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { Landmark, ModelLoadState, Vec3 } from "../types";
import { CFA_CONNECTIONS } from "../data/cfaConnections";
import { ALL_CFA_POINTS, pieceLandmarkId, type PointName } from "../data/cfaSchema";
import { REST_LANDMARKS, SKELETON_PIECES, BODY_SCALE_MEASURES } from "../data/skeletonPieces";
import { landmarksToDisplayPositions, centroid } from "../lib/coordinates";
import { poseSkeletonPiece, computeTriangleQuaternion, type PieceRestInfo } from "../lib/skeletonPose";

/**
 * Controls for the camera positioning in the viewport
 */
export interface SceneViewportHandle {
  /** Reset the camera to a default position and re-run posing */
  resetView: () => void;
  /** Frame camera to the skeleton */
  focusModel: () => void;
  /** Multiply camera distance by factor to target position */
  zoomBy: (factor: number) => void;
  /** Store current view as a PNG file - only if renderer is ready */
  capturePng: () => Promise<Blob | null>;
}

interface SceneViewportProps {
  /** GLB models URL for loading */
  modelUrl: string;
  modelName: string;
  showGrid: boolean;
  /** Feature to show the location of the coordinate landmarks */
  showLandmarks: boolean;
  landmarks: Landmark[];
  onLoadStateChange: (state: ModelLoadState) => void;
  /** Called after each redraw of the camera rotation as [x, y, z, w] */
  onCameraRotate?: (quaternion: [number, number, number, number]) => void;
}

/** 
 * Left/right landmark pairs used as a last-resort facing reference for the
 * ribcage and spine, tried in order (legs, then arms) when no pelvis or
 * shoulder landmark is available. See the twist handling in SceneViewport.
*/
const EXTRA_SIDE_PAIRS: readonly (readonly (readonly [PointName, PointName])[])[] = [
  [["left_knee", "right_knee"], ["left_ankle", "right_ankle"], ["left_toes", "right_toes"]],
  [["left_elbow", "right_elbow"], ["left_wrist", "right_wrist"], ["left_fingertips", "right_fingertips"]],
];
/** Starting camera position [=] metres */
const DEFAULT_CAMERA = new THREE.Vector3(2.6, 1.4, 3.4);
/** Starting camera orbit target [=] metres */
const DEFAULT_TARGET = new THREE.Vector3(0, 0.85, 0);
// The bundled GLB isn't modeled to real-world scale (its raw geometry is
// only ~3.3 units tall with no compensating node transform), so it's scaled
// to a plausible average adult height in real metres instead of an
// arbitrary cosmetic number. This makes it a meaningful size reference once
// entered coordinates are also plotted in real metres -- a taller or
// shorter skeleton than this will visibly read as taller or shorter.
const DISPLAY_HEIGHT = 1.7;

/** Clears the GPU geometry and materials of everything under `root` */
function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose());
    }
  });
}

/**
 * Each named skeleton piece sits several levels deep inside the loaded
 * file (Sketchfab_model -> SkeletonBodyPart.fbx -> RootNode -> the piece
 * itself), and those in-between levels carry a hidden scale and rotation
 * left over from how the file was originally exported. getObjectByName()
 * only grabs the piece's own node -- if that node is then reparented
 * straight under our own scene group (which it needs to be, so it can be
 * posed independently of the others), the hidden scale/rotation from its
 * old ancestors is silently dropped instead of carried along, and the
 * piece renders at the wrong size and angle from the moment it loads,
 * before any coordinate math even runs.
 *
 * This bakes each piece's true, fully-resolved position/rotation/scale
 * directly into a fresh copy of its own geometry, so the returned group
 * has no leftover transform of its own and can be moved anywhere safely --
 * which is exactly what poseSkeletonPiece() assumes it's working with.
 */
function bakePieceWorldTransform(pieceNode: THREE.Object3D): THREE.Group {
  const baked = new THREE.Group();
  baked.name = pieceNode.name;
  pieceNode.updateWorldMatrix(true, false);
  pieceNode.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
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
    if (!(child instanceof THREE.Mesh)) return;
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
    if (!(child instanceof THREE.Mesh)) return;
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

/** Finds the longest axus and the vertex tips at both ends for a piece */
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
 * New type for storing the landmark pair names -- see
 * estimateSacralPromontory and SACRUM_ESTIMATE_PAIRS
 */
type PelvisLandmarkPair = [PointName, PointName];
const ILIUM_SUPS: PelvisLandmarkPair = ["left_ilium_superior", "right_ilium_superior"];
const ACETABS: PelvisLandmarkPair = ["left_acetabulum", "right_acetabulum"];
const ISCHIS: PelvisLandmarkPair = ["left_ischium", "right_ischium"];

/**
 * Pairs for trying to generate the midline pelvis from the possible reference points 
 * in order of best usage -- see estimateSacralPromontory.
 */
const SACRUM_ESTIMATE_PAIRS: [PelvisLandmarkPair, PelvisLandmarkPair][] = [
  [ILIUM_SUPS, ACETABS],
  [ILIUM_SUPS, ISCHIS],
  [ACETABS, ISCHIS],
];

/**
 * Function to ensure the rendering of all bones are still possible when the sacral
 * is selected to be 'not present', current build requirements for the sacral are the 
 * spine and manubrium (ribcage bone section) that get references off of the sacrals 
 * location, so when it is missing they lose a reference and cannot be rendered, so 
 * by using the same logic of estimating a position as was done for the head location 
 * to render the spine properly, however we had to do that off of a different bone segment,
 * here we can use the landmarks within the pelvis to create a reference position for the 
 * sacral via a triangle system. We can then also get estimates from the mesh for where
 * the sacral would be - use the mesh offset and pelvis rotation scaled by bodyScale, 
 * thus provide a theorised location for the spine and manubrium referencing.
 * 
 * The best case is to have the main left-right reference off of the ilium superior pair
 * as they are the same pair used in the orientationTriangle for the pelvis, but per 
 * the nature of all of our rendering system we want as many fallbacks available to 
 * allow missing bones as possible, setting the other pelvis pairs in decreasing width
 * order as our fallbacks here.
 */
function estimateSacralPromontory(
  positions: Map<string, Vec3>,
  rest: Map<PointName, THREE.Vector3>,
  bodyScale: number,
): Vec3 | undefined {
  const restSacrum = rest.get("sacral_promontory");
  if (!restSacrum) return undefined;

  for (const [[sideL, sideR], [refL, refR]] of SACRUM_ESTIMATE_PAIRS) {
    const sideLeft = positions.get(sideL);
    const sideRight = positions.get(sideR);
    const refLeft = positions.get(refL);
    const refRight = positions.get(refR);
    const restSideLeft = rest.get(sideL);
    const restSideRight = rest.get(sideR);
    const restRefLeft = rest.get(refL);
    const restRefRight = rest.get(refR);

    if (!sideLeft || !sideRight || !refLeft || !refRight || !restSideLeft 
      || !restSideRight || !restRefLeft || !restRefRight) continue;
    const anchor = new THREE.Vector3(...refLeft).add(new THREE.Vector3(...refRight)).multiplyScalar(0.5);
    const restAnchor = restRefLeft.clone().add(restRefRight).multiplyScalar(0.5);
    // for input coordinates left and right swapped we can use the same mirroring 
    // fix as the pelvis orientation -- see orientationTriangle
    const rotation = computeTriangleQuaternion(
      restSideLeft, restSideRight, restAnchor,
      new THREE.Vector3(...sideRight), new THREE.Vector3(...sideLeft), anchor,
    );
    if (!rotation) continue;
    const offset = restSacrum.clone().sub(restAnchor).multiplyScalar(bodyScale).applyQuaternion(rotation);
    const p = anchor.add(offset);
    return [p.x, p.y, p.z];
  }
return undefined; 
}


/**
 * Scaling function for the REST_LANDMARKS to bring it into the same space as the 
 * fully baked pieces geometry
 */
function scaleRestLandmarks(globalScale: number): Map<PointName, THREE.Vector3> {
  const scaled = new Map<PointName, THREE.Vector3>();
  for (const [name, p] of Object.entries(REST_LANDMARKS)) {
    if (p) scaled.set(name as PointName, new THREE.Vector3(...p).multiplyScalar(globalScale));
  }
  return scaled;
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
 * A few pieces have no such name-sharing predecessor (the legs' hip end) 
 * -- those resolve against the nearest fixed rest-pose landmark instead
 * The skull uses the chin as its landmark, while the spine and ribcage use 
 * the values of their landmarks from REST_LANDMARKS directly
 */
function resolvePieceRestInfo(rawByName: Map<string, RawPieceGeometry>, restLandmarks: Map<PointName, THREE.Vector3>): Map<string, PieceRestInfo> {
  // Lookup for the measured and scaled resting pose landmark coordinates 
  // -- see REST_LANDMARKS and the scaleRestLandmarks function below.
  // This function works as a helper to store clones and prevent access
  // to the main table. 
  const restPoint = (name: PointName) => restLandmarks.get(name)?.clone();

  const resolved = new Map<string, PieceRestInfo>();

  const withOrder = (raw: RawPieceGeometry, fromTip: THREE.Vector3, toTip: THREE.Vector3): PieceRestInfo => ({
    axisIndex: raw.axisIndex,
    fromTip,
    toTip,
    topTip: raw.topTip,
  });

  // The spine spans the sacral to head, if either is not present in 
  // REST_LANDMARKS, fall back to it own end tips and use estimate landmarks.
  const spineRaw = rawByName.get("SK_Spine");
  if (!spineRaw) return resolved;
  const spineLower = spineRaw.tipMin.y < spineRaw.tipMax.y ? spineRaw.tipMin : spineRaw.tipMax;
  const spineUpper = spineRaw.tipMin.y < spineRaw.tipMax.y ? spineRaw.tipMax : spineRaw.tipMin;
  resolved.set("SK_Spine", withOrder(spineRaw, restPoint("sacral_promontory") ?? spineLower, restPoint("head_proximal") ?? spineUpper));

  // The pelvis is a single-landmark piece -- with possible references
  // from the measured mesh landmark for the sacral or its own top
  // the measured landmark is priority (see the single-target branch in
  // poseSkeletonPiece), which also doubles as the rest-pose anchor the
  // upper legs resolve against below.
  const coccyxRaw = rawByName.get("SK_Coccyx");
  if (coccyxRaw) {
    const pelvisAnchor = restPoint("sacral_promontory") ?? coccyxRaw.topTip;
    resolved.set("SK_Coccyx", { ...withOrder(coccyxRaw, pelvisAnchor, pelvisAnchor), topTip: pelvisAnchor });
  }

  // The ribcage spans the measured sacral promontory to manubrium. Its own
  // lowest vertices sit well above the sacrum (the lumbar spine is between),
  // so using them as fromTip would squeeze out that gap and inflate the
  // whole chest to fill it. The fromTip is therefore a point off the mesh,
  // which is fine here: nothing joins onto the ribcage's lower edge.
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

  // The clavicle pieces are anchored at the shoulder end now (from:
  // left/right_shoulder, to: manubrium -- see skeletonPieces.ts), so their
  // fromTip must be the shoulder-side vertex, not the manubrium-side one.
  // We set the clavicle locations directly to the landmark point for the 
  // manubrium, directly from the mesh. Then `invert: true`
  // flips the near/far assignment: the tip CLOSER to the manubrium becomes
  // toTip, and the farther one (the shoulder side) becomes fromTip.
  // Modifications for the above: we set the clavicle locations directly
  // to the landmark point for the manubrium, instead of the stand-in spine 
  // location, directly from the mesh
  resolveAgainst("SK_RClavicle", restPoint("manubrium"), true);
  resolveAgainst("SK_LClavicle", restPoint("manubrium"), true);
  // The upper arm's proximal (shoulder) end sits at the same physical
  // point as the clavicle's own shoulder-side vertex -- now the
  // clavicle's fromTip (see above), not its toTip.
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
  // The point assigned to the head is now set for the landmark point 
  // directly from the mesh for the chin so that the jaw end becomes
  // the fromTip for the end offsetFromRatio positions
  resolveAgainst("SK_Head", restPoint("chin"));

  return resolved;
}

export const SceneViewport = forwardRef<SceneViewportHandle, SceneViewportProps>(function SceneViewport(
  { modelUrl, modelName, showGrid, showLandmarks, landmarks, onLoadStateChange, onCameraRotate },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const invalidateRef = useRef<() => void>(() => {});
  const [modelRevision, setModelRevision] = useState(0);
  const [visualizationRevision, setVisualizationRevision] = useState(0);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const modelBoxRef = useRef<THREE.Box3 | null>(null);
  const overlayRef = useRef<THREE.Group | null>(null);
  const piecesRef = useRef<Map<string, { object: THREE.Object3D; rest: PieceRestInfo }>>(new Map());
  const onCameraRotateRef = useRef(onCameraRotate);
  useEffect(() => { onCameraRotateRef.current = onCameraRotate; }, [onCameraRotate]);
  const restLandmarksRef = useRef<Map<PointName, THREE.Vector3>>(new Map());

  const resetCamera = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.copy(DEFAULT_CAMERA);
    controls.target.copy(DEFAULT_TARGET);
    camera.near = 0.01;
    camera.far = 100;
    camera.updateProjectionMatrix();
    controls.update();
    invalidateRef.current();
  };

  const resetView = () => {
    resetCamera();
    // Re-run coordinate-driven effects even when the landmark array has not changed.
    setVisualizationRevision((revision) => revision + 1);
  };

  const focusModel = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const box = modelBoxRef.current;
    if (!camera || !controls || !box || box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const height = Math.max(size.y, 1);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(height * 0.82, height * 0.18, height * 1.25));
    camera.near = Math.max(height / 100, 0.01);
    camera.far = Math.max(height * 50, 100);
    camera.updateProjectionMatrix();
    controls.update();
  };

  const zoomBy = (factor: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !Number.isFinite(factor) || factor <= 0) return;
    const offset = camera.position.clone().sub(controls.target);
    const distance = THREE.MathUtils.clamp(
      offset.length() * factor,
      controls.minDistance,
      controls.maxDistance,
    );
    if (offset.lengthSq() === 0) offset.set(0, 0, 1);
    camera.position.copy(controls.target).add(offset.setLength(distance));
    controls.update();
  };

  useImperativeHandle(ref, () => ({
    resetView,
    focusModel,
    zoomBy,
    capturePng: () => new Promise((resolve) => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return resolve(null);
      renderer.render(scene, camera);
      renderer.domElement.toBlob(resolve, "image/png", 1);
    }),
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#20252A");
    scene.fog = new THREE.FogExp2("#20252A", 0.055);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    camera.position.copy(DEFAULT_CAMERA);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    // Keep the reference model shadow-free. A projected silhouette beneath
    // the bones can be mistaken for recorded skeletal evidence in field use.
    renderer.shadowMap.enabled = false;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(DEFAULT_TARGET);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.screenSpacePanning = true;
    controls.minDistance = 1.2;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI * 0.92;
    controls.update();

    const grid = new THREE.GridHelper(8, 32, "#52697A", "#303B44");
    grid.position.y = -0.075;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.34;
    });
    scene.add(grid);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: "#1C2227", roughness: 0.96, metalness: 0.02 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.09;
    scene.add(floor);

    scene.add(new THREE.HemisphereLight("#F4F0E6", "#171B1F", 2.1));
    const keyLight = new THREE.DirectionalLight("#fff1d9", 3.1);
    keyLight.position.set(3.8, 6.5, 4.2);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight("#6F8FA8", 1.7);
    rimLight.position.set(-4, 2.6, -3.5);
    scene.add(rimLight);

    const content = new THREE.Group();
    scene.add(content);

    const overlay = new THREE.Group();
    overlay.name = "coordinate-overlay";
    overlay.renderOrder = 999;
    scene.add(overlay);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      invalidateRef.current();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const invalidate = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(render);
    };
    const render = () => {
      frame = 0;
      const { width, height } = host.getBoundingClientRect();
      if (document.hidden || width === 0 || height === 0) return;
      // OrbitControls emits change events while damping settles.
      controls.update();
      renderer.render(scene, camera);
      
      const { x, y, z, w } = camera.quaternion;
      onCameraRotateRef.current?.([x, y, z, w]);
    };

    invalidateRef.current = invalidate;
    controls.addEventListener("change", invalidate);
    document.addEventListener("visibilitychange", invalidate);
    invalidate();

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;
    contentRef.current = content;
    gridRef.current = grid;
    overlayRef.current = overlay;

    return () => {
      cancelAnimationFrame(frame);
      invalidateRef.current = () => {};
      controls.removeEventListener("change", invalidate);
      document.removeEventListener("visibilitychange", invalidate);
      observer.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      contentRef.current = null;
      gridRef.current = null;
      modelBoxRef.current = null;
      overlayRef.current = null;
      piecesRef.current = new Map();
    };
  }, []);

  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
    invalidateRef.current();
  }, [showGrid]);

  // Lets a researcher hide the entered-coordinate overlay (the yellow
  // joint markers and their connecting "bone" lines) to see the bare
  // reference model underneath, without losing or re-entering the
  // coordinates themselves -- the overlay-building effect below still
  // runs on every landmark change, this just controls whether its result
  // is shown.
  useEffect(() => {
    if (overlayRef.current) overlayRef.current.visible = showLandmarks;
    invalidateRef.current();
  }, [showLandmarks]);

  // Draws the entered CFA coordinates as a joint-and-bone stick figure, so a
  // researcher can visually compare it against the skeleton in the grave.
  // Coordinates are plotted exactly as entered (no scaling/rotation math) --
  // if the figure looks like it's lying on its side, the entry form's X/Y/Z
  // axes probably don't match Three.js's Y-up convention and will need a swap
  // (see surveyToWorld() in lib/coordinates.ts for the same issue solved
  // for the CSV/ROT import path).
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    // depthTest disabled so entered points stay visible even when they sit
    // "inside" the solid reference mesh (e.g. torso points behind the ribcage) --
    // this is a see-through comparison overlay, not physical geometry.
    // Allocate once, then update positions/visibility without GPU churn.
    if (overlay.children.length === 0) {
      const jointGeometry = new THREE.SphereGeometry(0.025, 12, 12);
      const jointMaterial = new THREE.MeshStandardMaterial({
        color: "#F4C542",
        roughness: 0.4,
        depthTest: false,
        depthWrite: false,
      });
      const boneMaterial = new THREE.LineBasicMaterial({
        color: "#F4C542",
        depthTest: false,
        depthWrite: false,
      });

      ALL_CFA_POINTS.forEach((id) => {
        const joint = new THREE.Mesh(jointGeometry, jointMaterial);
        joint.name = id;
        overlay.add(joint);
      });
      CFA_CONNECTIONS.forEach(([from, to]) => {
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const line = new THREE.Line(geometry, boneMaterial);
        line.userData.endpoints = [from, to];
        overlay.add(line);
      });
    }
    const positionById = landmarksToDisplayPositions(landmarks);
    overlay.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        const position = positionById.get(child.name);
        child.visible = Boolean(position);
        if (position) child.position.set(...position);
        return;
      }
      if (!(child instanceof THREE.Line)) return;
      const [fromId, toId] = child.userData.endpoints as [string, string];
      const from = positionById.get(fromId);
      const to = positionById.get(toId);
      child.visible = Boolean(from && to);
      if (!from || !to) return;
      const positions = child.geometry.getAttribute("position");
      positions.setXYZ(0, ...from);
      positions.setXYZ(1, ...to);
      positions.needsUpdate = true;
      child.geometry.computeBoundingSphere();
    });
    invalidateRef.current();
  }, [landmarks, visualizationRevision]);

  // Poses each of the 18 known skeleton pieces directly from the entered
  // coordinates, once they've been loaded and matched by name (see the
  // GLTFLoader callback below). A piece missing either of its two
  // landmarks is hidden rather than left in a stale or default position.
  useEffect(() => {
    if (piecesRef.current.size === 0) return;
    const positions = landmarksToDisplayPositions(landmarks);

    // One overall body-scale factor, derived from a complete set of pre-
    // defined landmark distances, so "anchor" pieces (skull, hands,
    // feet, clavicles) can resize toward it too instead of staying frozen
    // at adult size regardless of what's entered. See the scaleFactor
    // comment in poseSkeletonPiece for why this is an approximation, not
    // an exact fix and see BODY_SCALE_MEASURES for the set of landmarks in
    // skeletonPieces.ts.
    let bodyScale: number | undefined;
    
    // Implementation of the ordered fallback list for setting the bodyScale
    // -- see BODY_SCALE_MEASURES in skeltonPieces.ts
    // Uses the mesh defined distances between select bones we determine the scale
    // as the entered lengths from the coordinates divided by the meshes length for 
    // those same distances (restVariable for the mesh points)
    for (const { from, fromBone, to, toBone } of BODY_SCALE_MEASURES) {
      const a = positions.get(pieceLandmarkId(from, fromBone));
      const b = positions.get(pieceLandmarkId(to, toBone));
      const restA = restLandmarksRef.current.get(from);
      const restB = restLandmarksRef.current.get(to);
      // Only calculate the distance for a complete set, working down the ordered list
      if (!a || !b || !restA || !restB) continue;
      const restLength = restA.distanceTo(restB);
      // Standard min value set for distance to ensure points set in ref are functioning 
      // as we anticipate and would like
      if (restLength < 1e-6) continue;
      bodyScale = new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b)) / restLength;
      // Value works so we break
      break;
    }

    // Generating the estimate sacral location for cases where sacral is toggled
    // `not present` but other pelvis landmarks are -- see estimateSacralPromontory.
    // We dont add this to the actual landmarks map or pins but just use if for the
    // posing map so the ribcage and spine can be rendered while the sacral is absent.
    // Moved to run after the bodyScale to allow for its use in the estimates generation.
    if (!positions.has("sacral_promontory")) {
      const estimate = estimateSacralPromontory(positions, restLandmarksRef.current, bodyScale ?? 1);
      if (estimate) positions.set("sacral_promontory", estimate);
    }
    let spineTargetLength: number | undefined;
    const spineSpec = SKELETON_PIECES.find((spec) => spec.nodeName === "SK_Spine");
    const spinePiece = spineSpec ? piecesRef.current.get(spineSpec.nodeName) : undefined;
    const spineFromPos = spineSpec ? positions.get(spineSpec.from) : undefined;
    const spineToPos = spineSpec ? positions.get(spineSpec.to) : undefined;
    if (spineFromPos && spineToPos) {
      spineTargetLength = new THREE.Vector3(...spineFromPos).distanceTo(new THREE.Vector3(...spineToPos));
    }

    // Tracked so a `rigidWith` piece (see skeletonPieces.ts) can copy the
    // rotation/scale another, already-posed piece ended up with, instead
    // of defaulting to an identity rotation that ignores how the body is
    // actually posed. Relies on that referenced piece appearing earlier in
    // SKELETON_PIECES, so its transform is already in here by the time a
    // later piece looks it up.
    const posedTransforms = new Map<string, { quaternion: THREE.Quaternion; scale: THREE.Vector3 }>();

    // The body's own current "up" direction (sacral_promontory -> head_
    // proximal), used to synthesise the skull's missing second landmark
    // (see `offsetFromRatio` in skeletonPieces.ts). Derived from the
    // entered pose rather than assumed to be world-up, since a body can
    // be recorded lying down.
    let bodyUpDirection: THREE.Vector3 | undefined;
    if (spineFromPos && spineToPos) {
      const up = new THREE.Vector3(...spineToPos).sub(new THREE.Vector3(...spineFromPos));
      if (up.lengthSq() > 1e-9) bodyUpDirection = up.normalize();
    }
    // Skull fallback: without the sacral promontory there is no spine, so no
    // "up" direction, and the skull was left in its native orientation (it
    // ended up looking away from the body). Fall back to the nearest other
    // body landmark below the head: the manubrium, else the centre of
    // whichever pelvis landmarks are present.
    const headPosForUp = positions.get("head_proximal");
    if (!bodyUpDirection && headPosForUp) {
      const lowerPoints = positions.get("manubrium")
        ? [positions.get("manubrium") as Vec3]
        : (["left_acetabulum", "right_acetabulum", "left_ilium_superior", "right_ilium_superior", "left_ischium", "right_ischium"] as const)
            .map((id) => positions.get(id)).filter((v): v is Vec3 => v !== undefined);
      if (lowerPoints.length > 0) {
        const base = centroid(lowerPoints);
        const up = new THREE.Vector3(...headPosForUp).sub(new THREE.Vector3(...base));
        if (up.lengthSq() > 1e-9) bodyUpDirection = up.normalize();
      }
    }
    const skullOffsetLength = spineTargetLength ?? (spinePiece ? spinePiece.rest.fromTip.distanceTo(spinePiece.rest.toTip) : undefined);

    // Where `point` would be if it moved rigidly with the already-posed
    // `carrierName` piece -- see `toCarrier` in skeletonPieces.ts.
    const carriedLandmark = (carrierName: string, point: PointName): Vec3 | undefined => {
      const carrier = piecesRef.current.get(carrierName);
      const rest = restLandmarksRef.current.get(point);
      if (!carrier?.object.visible || !rest) return undefined;
      // Force update the matrix as it is rebuilt at render time normally
      carrier.object.updateMatrix();
      const p = rest.clone().applyMatrix4(carrier.object.matrix);
      return [p.x, p.y, p.z];
    };

    SKELETON_PIECES.forEach(({ nodeName, from, fromBone, to, toBone, stretch, twist, twistForward, twistFallback, rigidWith, offsetFromRatio, orientationTriangle, requiresAnyOf, scaleBounds, toCarrier, followsTorso }) => {
      const piece = piecesRef.current.get(nodeName);
      if (!piece) return;
      // A piece naming a specific bone (fromBone/toBone) reads that bone's
      // own entered position at a shared joint, rather than the joint's
      // first-listed bone -- see pieceLandmarkId in cfaSchema.ts. This is
      // what makes two disarticulated bones actually show a gap here,
      // rather than only being recorded in the exported data.
      const fromPos = positions.get(pieceLandmarkId(from, fromBone));
      const toPos = positions.get(pieceLandmarkId(to, toBone)) ?? (toCarrier ? carriedLandmark(toCarrier, to) : undefined);
      if (!fromPos || !toPos) {
        piece.object.visible = false;
        return;
      }
      // A piece that depends on a whole group of landmarks (the pelvis) is
      // hidden once none of them remain -- see requiresAnyOf in skeletonPieces.ts.
      if (requiresAnyOf && !requiresAnyOf.some((point) => positions.has(point))) {
        piece.object.visible = false;
        return;
      }
       // The twist reference is optional -- an archaeologist may not have
      // recorded it, or marked a side "not present". A bilateral pair is
      // only used when complete: one side alone is mostly a sideways offset
      // from the piece's axis, so it twists the piece to face that side
      // (seen with one arm marked absent). An incomplete `twist` falls back
      // to `twistFallback`; with neither complete, no twist is applied and
      // the piece keeps its bare two-point aim, which can face the wrong way
      // (see the twistForward comment in skeletonPieces.ts).
      const completeCentroid = (points: readonly PointName[] | undefined) => {
        if (!points || points.length === 0) return undefined;
        const samples = points.map((point) => positions.get(point));
        return samples.every((pos): pos is Vec3 => pos !== undefined) ? centroid(samples) : undefined;
      };
      const twistLandmarks = twist ? (Array.isArray(twist) ? twist : [twist]) : [];
      let twistPos = completeCentroid(twistLandmarks) ?? completeCentroid(twistFallback);
      // Left/right-based facing for the ribcage and spine (pieces whose twist
      // is a left/right pair plus a fallback pair). The centroid of a pair
      // only gives the right facing if that pair happens to sit in front of
      // the spine axis, which is not reliable (in the default skeleton the
      // shoulders sit slightly BEHIND it, so dropping one pelvis half made the
      // ribcage flip 180 degrees). The left-to-right direction is robust:
      // take it from a complete pair, or failing that from any single left or
      // right landmark (spine axis -> that point, known side), and derive the
      // front as spine direction x left. The displayed axes are mirrored (see
      // the pelvis MIRROR FIX), which is why front = spine direction x left
      // in this scene.
      const isSidePair = (points: readonly PointName[] | undefined) =>
        !!points && points.length === 2 && points.every((id) => /^(left|right)_/.test(id));
      if (twistFallback && isSidePair(twistLandmarks)) {
        const axisDir = new THREE.Vector3(...toPos).sub(new THREE.Vector3(...fromPos));
        if (axisDir.lengthSq() > 1e-9) {
          axisDir.normalize();
          const perpendicular = (v: THREE.Vector3) => {
            v.addScaledVector(axisDir, -v.dot(axisDir));
            return v.lengthSq() > 1e-8 ? v.normalize() : undefined;
          };
          let left: THREE.Vector3 | undefined;
          for (const pair of [twistLandmarks, twistFallback] as readonly (readonly PointName[])[]) {
            const leftId = pair.find((id) => id.startsWith("left_"));
            const rightId = pair.find((id) => id.startsWith("right_"));
            const leftPos = leftId ? positions.get(leftId) : undefined;
            const rightPos = rightId ? positions.get(rightId) : undefined;
            if (leftPos && rightPos) {
              left = perpendicular(new THREE.Vector3(...leftPos).sub(new THREE.Vector3(...rightPos)));
              if (left) break;
            }
          }
          if (!left) {
            const singles = [...twistLandmarks, ...twistFallback, "left_acetabulum", "right_acetabulum"] as PointName[];
            for (const id of singles) {
              const pos = positions.get(id);
              if (!pos || !/^(left|right)_/.test(id)) continue;
              const lateral = perpendicular(new THREE.Vector3(...pos).sub(new THREE.Vector3(...fromPos)));
              if (!lateral) continue;
              left = id.startsWith("left_") ? lateral : lateral.negate();
              break;
            }
          }
          // Last resorts, only reached when the pelvis and shoulder points
          // gave nothing (e.g. both arms and both pelvis halves marked not
          // present, which used to leave the ribcage facing backwards).
          if (!left) {
            // 1) Complete left/right pairs elsewhere on the body: legs first
            // (more stable than arms, which can swing about), then arms.
            // Every complete pair in the first group that has any is
            // averaged for a steadier left direction.
            for (const group of EXTRA_SIDE_PAIRS) {
              const sum = new THREE.Vector3();
              for (const [leftId, rightId] of group) {
                const leftPos = positions.get(leftId);
                const rightPos = positions.get(rightId);
                if (!leftPos || !rightPos) continue;
                const dir = perpendicular(new THREE.Vector3(...leftPos).sub(new THREE.Vector3(...rightPos)));
                if (dir) sum.add(dir);
              }
              if (sum.lengthSq() > 1e-8) {
                left = sum.normalize();
                break;
              }
            }
          }
          if (left) {
            const front = new THREE.Vector3().crossVectors(axisDir, left).normalize();
            const t = new THREE.Vector3(...fromPos).addScaledVector(front, 0.1);
            twistPos = [t.x, t.y, t.z];
          } else {
            // 2) No left/right points at all: the chin sits in front of the
            // spine line, so face toward it. This is a direct front
            // direction (no cross product), so the mirrored display axes do
            // not matter here.
            const chinPos = positions.get("chin");
            if (chinPos) {
              // Measure "in front of" against the whole spine line (sacrum to
              // head) rather than this piece's own axis: the ribcage axis
              // (sacrum to manubrium) leans forward, which can put the chin
              // behind it.
              const headPos = positions.get("head_proximal");
              const spineAxis = headPos ? new THREE.Vector3(...headPos).sub(new THREE.Vector3(...fromPos)) : axisDir.clone();
              spineAxis.normalize();
              const chinOffset = new THREE.Vector3(...chinPos).sub(new THREE.Vector3(...fromPos));
              chinOffset.addScaledVector(spineAxis, -chinOffset.dot(spineAxis));
              const front = chinOffset.lengthSq() > 1e-8 ? chinOffset.normalize() : undefined;
              if (front) {
                const t = new THREE.Vector3(...fromPos).addScaledVector(front, 0.1);
                twistPos = [t.x, t.y, t.z];
              }
            }
          }
        }
      }

      const toVector = new THREE.Vector3(toPos[0], toPos[1], toPos[2]);
      // A piece with no real second landmark of its own (currently just
      // the skull, since `centre_of_head` was removed) gets one
      // synthesised here instead of reusing `from`'s (identical) position
      // -- see the `offsetFromRatio` comment in skeletonPieces.ts for why.
      const fromVector =
        offsetFromRatio !== undefined && bodyUpDirection && skullOffsetLength !== undefined
          ? toVector.clone().addScaledVector(bodyUpDirection, -offsetFromRatio * skullOffsetLength)
          : new THREE.Vector3(fromPos[0], fromPos[1], fromPos[2]);

      // Independently orients a single-landmark piece (currently just the
      // pelvis) from three of its own landmarks -- see orientationTriangle
      // in skeletonPieces.ts. Left undefined (falling back to rigidWith
      // below) whenever a landmark is missing or the triangle turns out
      // degenerate, rather than ever silently posing the pelvis unrotated.
      let orientationOverride: THREE.Quaternion | undefined;
      if (orientationTriangle) {
        const leftPos = positions.get(orientationTriangle.left);
        const rightPos = positions.get(orientationTriangle.right);
        const anchorPos = positions.get(orientationTriangle.anchor);
        if (leftPos && rightPos && anchorPos) {
          // rest*/restAnchor are authored in the pelvis mesh's own frame
          // (x = left, y = up, z = front -- see skeletonPieces.ts), stored
          // as [x, front, up] triples, so reorder them into x/y/z here.
          const restToModel = (r: readonly [number, number, number]) => new THREE.Vector3(r[0], r[2], r[1]);
          //
          // MIRROR FIX: the entered points go through cfaLandmarkToWorld,
          // which turns the (left-handed) depth-based CFA axes into viewer
          // axes while keeping that handedness, i.e. the displayed skeleton
          // is a mirror image of the real body (left x up != front). The
          // pelvis frame is built with cross products, so it needs a
          // right-handed body to give the right rotation; fed the mirrored
          // points it comes out upside-down / back-to-front (the tailbone
          // ended up on the front of the body). The pelvis mesh is
          // left/right symmetric, so mirroring it is harmless: we build
          // the *entered* frame with left and right swapped, which flips
          // only the frame's x axis (cancelling the mirror) and leaves
          // up/front untouched. Rest stays in the mesh's own frame.
          orientationOverride = computeTriangleQuaternion(
            restToModel(orientationTriangle.restLeft),
            restToModel(orientationTriangle.restRight),
            restToModel(orientationTriangle.restAnchor),
            new THREE.Vector3(...rightPos),
            new THREE.Vector3(...leftPos),
            new THREE.Vector3(...anchorPos),
          );
        }
      }

      // The clavicle/scapula pieces used to get a *twist* correction here on
      // top of their aim rotation (either the plain declared `twist:
      // head_proximal` / `twistForward: [0, 0, 1]` from skeletonPieces.ts, or
      // several since-abandoned dynamic replacements for it -- a guessed
      // cardinal direction, two different PCA-derived forward vectors, and
      // borrowing SK_Side's own posed rotation outright). Every one of those
      // produced basically the same result, which is what exposed the real
      // problem: a twist is a pure rotation *around* the piece's own
      // already-aimed fromTip->toTip axis, so it can never change that
      // vector's own component *along* that same axis. This piece's actual
      // flat-face normal sits at a fixed, mesh-measured ~31 degrees from its
      // own fromTip->toTip axis, but both a seated reference pose and the
      // bundled lying-down default need that angle to instead be 75-85
      // degrees for the blade to really face behind the ribcage -- a gap no
      // twistForward choice can close, confirmed by comparing each attempt's
      // actual posed mesh geometry, not just a rendered screenshot (which is
      // also why they all looked identical despite being numerically
      // different quaternions). Borrowing SK_Side's rotation directly did not
      // work either: it's derived from landmarks spanning the whole
      // ribcage/spine, which doesn't track the local orientation needed right
      // at the shoulder once the torso isn't one single rigid rotation
      // end-to-end (confirmed by a ~163 degree gap to the known-good
      // lying-down quaternion). The combined clavicle+scapula mesh also has
      // no separate scapula geometry to pose independently (checked directly
      // in the GLB), so nothing here can locally correct just the blade.
      //
      // The fix: stop resolving a twist for these two pieces at all, and use
      // only the 2-DOF aim rotation (see `isClaviclePiece` below). Measured at
      // ~16 degrees from the old hand-tuned lying-down quaternion -- close
      // enough that the aim alone carries nearly all of the real orientation
      // signal here -- and confirmed visually across multiple camera angles
      // for the bundled lying-down default (unchanged from before), a seated
      // reference pose (scapulae now sit flush against the ribcage from the
      // front, back, and side instead of winging up or facing front), and a
      // real client record (no regression). Simply not resolving a twist at
      // all also can't reintroduce a per-pose sign problem the way every
      // twist attempt above did.
      const isClaviclePiece = nodeName === "SK_RClavicle" || nodeName === "SK_LClavicle";

      // followsTorso: pose this piece as if the arm were moved relative to the
      // body, then carry that with the ribcage's own rotation. Concretely: aim
      // in the torso's frame (the aim that would be used if the body were
      // standing in its rest pose), then turn the result by the ribcage
      // rotation. A standing skeleton is therefore unchanged, and a lying one
      // keeps the arm's natural roll relative to the body (palms up) instead
      // of whatever the plain aim leaves. The roll is applied as a twist
      // reference, the same way the other twist targets are. Left alone if
      // the ribcage was not posed (see followsTorso in skeletonPieces.ts).
      let torsoTwistTarget: THREE.Vector3 | undefined;
      let torsoTwistForward: THREE.Vector3 | undefined;
      const torsoTransform = followsTorso ? posedTransforms.get("SK_Side") : undefined;
      if (torsoTransform) {
        const torsoQ = torsoTransform.quaternion;
        const aimDir = toVector.clone().sub(fromVector);
        if (aimDir.lengthSq() > 1e-12) {
          aimDir.normalize();
          const restAxis = piece.rest.toTip.clone().sub(piece.rest.fromTip).normalize();
          const candidates = [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)];
          candidates.sort((u, v) => Math.abs(u.dot(restAxis)) - Math.abs(v.dot(restAxis)));
          const side = candidates[0];
          const aimInTorso = aimDir.clone().applyQuaternion(torsoQ.clone().invert());
          const localAim = new THREE.Quaternion().setFromUnitVectors(restAxis, aimInTorso);
          const wantedSide = side.clone().applyQuaternion(localAim).applyQuaternion(torsoQ);
          torsoTwistForward = side;
          torsoTwistTarget = fromVector.clone().addScaledVector(wantedSide, 0.1);
        }
      }

      poseSkeletonPiece(
        piece.object,
        piece.rest,
        fromVector,
        toVector,
        stretch,
        torsoTwistTarget ?? (isClaviclePiece ? undefined : (twistPos ? new THREE.Vector3(twistPos[0], twistPos[1], twistPos[2]) : undefined)),
        bodyScale,
        torsoTwistForward ?? (isClaviclePiece ? undefined : (twistForward ? new THREE.Vector3(twistForward[0], twistForward[1], twistForward[2]) : undefined)),
        rigidWith ? posedTransforms.get(rigidWith) : undefined,
        orientationOverride,
        scaleBounds,
      );
      posedTransforms.set(nodeName, { quaternion: piece.object.quaternion.clone(), scale: piece.object.scale.clone() });
    });
    const content = contentRef.current;
    if (content) modelBoxRef.current = new THREE.Box3().setFromObject(content);
    invalidateRef.current();
  }, [landmarks, modelRevision, visualizationRevision]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.children.slice().forEach((child) => {
      content.remove(child);
      disposeObject(child);
    });
    modelBoxRef.current = null;
    piecesRef.current = new Map();
    invalidateRef.current();
    onLoadStateChange("loading");

    let cancelled = false;
    new GLTFLoader().load(
      modelUrl,
      (gltf) => {
        if (cancelled || !contentRef.current) {
          disposeObject(gltf.scene);
          return;
        }

        const tint = new THREE.Color("#D8CBB7");
        const tintMaterials = (object: THREE.Object3D) => {
          object.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            child.castShadow = false;
            child.receiveShadow = false;
            const materials = (Array.isArray(child.material) ? child.material : [child.material]).map((source) => {
              const material = source.clone();
              if ("color" in material && material.color instanceof THREE.Color) material.color.lerp(tint, 0.3);
              if ("roughness" in material && typeof material.roughness === "number") material.roughness = Math.max(material.roughness, 0.58);
              if ("metalness" in material && typeof material.metalness === "number") material.metalness = Math.min(material.metalness, 0.08);
              return material;
            });
            child.material = Array.isArray(child.material) ? materials : materials[0];
          });
        };

        // The bundled skeleton_pre-cut.glb has no bone rig -- it's cut into
        // 18 separately-named rigid pieces (see data/skeletonPieces.ts). If
        // every named piece is found, pose each one directly from the
        // entered coordinates instead of showing one static whole-model
        // mesh. Any other GLB (a different reference model, or a
        // researcher-imported one) falls back to the old behaviour: show
        // it whole, auto-oriented upright and scaled to DISPLAY_HEIGHT.
        gltf.scene.updateMatrixWorld(true);
        const bakedByName = new Map<string, THREE.Group>();
        const nativeBox = new THREE.Box3();
        SKELETON_PIECES.forEach(({ nodeName }) => {
          const found = gltf.scene.getObjectByName(nodeName);
          if (!found) return;
          const baked = bakePieceWorldTransform(found);
          bakedByName.set(nodeName, baked);
          nativeBox.union(new THREE.Box3().setFromObject(baked));
        });

        // The 18 pieces are baked straight out of the file's own units,
        // which aren't real-world metres (see the DISPLAY_HEIGHT comment
        // above) -- but the coordinates each piece gets posed to (from
        // landmarksToDisplayPositions) genuinely are metres. Left
        // uncorrected, every piece's rest length comes out roughly double
        // its real target length, and poseSkeletonPiece has to compress
        // it back down to fit -- shrinking its long axis while its width
        // stays at the file's native (oversized) scale, which is what
        // turns ordinary bones into pinched, flared stumps at every joint.
        // Rescaling every piece by one shared factor -- fixed for this
        // file, not recomputed per patient -- so the whole assembly's own
        // native height matches DISPLAY_HEIGHT fixes that at the source:
        // each piece's rest length then already sits close to a real
        // adult's, so the per-piece stretch that follows only has to
        // account for genuine person-to-person variation, not a leftover
        // file-scale mismatch.
        const nativeHeight = nativeBox.getSize(new THREE.Vector3()).y;
        const globalScale = nativeHeight > 0.0001 ? DISPLAY_HEIGHT / nativeHeight : 1;

        const rawGeometryByName = new Map<string, RawPieceGeometry>();
        bakedByName.forEach((baked, nodeName) => {
          if (Math.abs(globalScale - 1) > 1e-6) {
            const scaleMatrix = new THREE.Matrix4().makeScale(globalScale, globalScale, globalScale);
            baked.traverse((child) => {
              if (!(child instanceof THREE.Mesh)) return;
              child.geometry.applyMatrix4(scaleMatrix);
            });
          }
          rawGeometryByName.set(nodeName, computeRawPieceGeometry(baked));
        });

        // Which tip of each piece is its `from` end versus its `to` end is
        // resolved once here, from the whole assembly's rest-pose geometry
        // -- not re-guessed per pose (see resolvePieceRestInfo above).
        const restLandmarks = scaleRestLandmarks(globalScale);
        restLandmarksRef.current = restLandmarks;
        const restInfoByName = resolvePieceRestInfo(rawGeometryByName, restLandmarks);

        const foundPieces = new Map<string, { object: THREE.Object3D; rest: PieceRestInfo }>();
        bakedByName.forEach((baked, nodeName) => {
          const rest = restInfoByName.get(nodeName);
          if (!rest) return;
          foundPieces.set(nodeName, { object: baked, rest });
        });

        if (foundPieces.size === SKELETON_PIECES.length) {
          foundPieces.forEach(({ object }) => {
            tintMaterials(object);
            contentRef.current!.add(object);
          });
          piecesRef.current = foundPieces;
          setModelRevision((revision) => revision + 1);
          modelBoxRef.current = new THREE.Box3().setFromObject(contentRef.current);
          onLoadStateChange("ready");
          return;
        }

        piecesRef.current = new Map();
        const model = clone(gltf.scene);
        const oriented = new THREE.Group();
        const pivot = new THREE.Group();
        pivot.name = `${modelName}-reference-model`;
        oriented.add(model);
        pivot.add(oriented);
        tintMaterials(model);

        model.updateMatrixWorld(true);
        const sourceBox = new THREE.Box3().setFromObject(model);
        const sourceSize = sourceBox.getSize(new THREE.Vector3());
        if (sourceBox.isEmpty() || !Number.isFinite(sourceSize.length()) || sourceSize.lengthSq() < 0.000001) {
          disposeObject(pivot);
          onLoadStateChange("error");
          return;
        }
        const axes = [
          { size: sourceSize.x, direction: new THREE.Vector3(1, 0, 0) },
          { size: sourceSize.y, direction: new THREE.Vector3(0, 1, 0) },
          { size: sourceSize.z, direction: new THREE.Vector3(0, 0, 1) },
        ];
        const longestAxis = axes.reduce((longest, axis) => axis.size > longest.size ? axis : longest);
        oriented.quaternion.setFromUnitVectors(longestAxis.direction, new THREE.Vector3(0, 1, 0));
        oriented.updateMatrixWorld(true);

        const orientedBox = new THREE.Box3().setFromObject(oriented);
        const orientedSize = orientedBox.getSize(new THREE.Vector3());
        const orientedCenter = orientedBox.getCenter(new THREE.Vector3());
        oriented.position.set(-orientedCenter.x, -orientedBox.min.y, -orientedCenter.z);
        pivot.scale.setScalar(DISPLAY_HEIGHT / Math.max(orientedSize.y, 0.001));
        pivot.position.y = 0.015;
        contentRef.current.add(pivot);
        pivot.updateMatrixWorld(true);
        modelBoxRef.current = new THREE.Box3().setFromObject(pivot);
        invalidateRef.current();
        onLoadStateChange("ready");
      },
      undefined,
      () => {
        if (!cancelled) {
          console.warn(`Reference model could not be loaded: ${modelUrl}`);
          onLoadStateChange("error");
        }
      },
    );

    return () => { cancelled = true; };
  }, [modelUrl, modelName, onLoadStateChange]);

  return <div ref={hostRef} className="scene-canvas" aria-label={`${modelName} 3D reference model`} />;
});
