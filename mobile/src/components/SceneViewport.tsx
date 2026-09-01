import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { Landmark, ModelLoadState } from "../types";
import { CFA_CONNECTIONS } from "../data/cfaConnections";
import { SKELETON_PIECES } from "../data/skeletonPieces";
import { landmarksToDisplayPositions } from "../lib/coordinates";
import { poseSkeletonPiece } from "../lib/skeletonPose";

export interface SceneViewportHandle {
  resetCamera: () => void;
  focusModel: () => void;
  zoomBy: (factor: number) => void;
  capturePng: () => Promise<Blob | null>;
}

interface SceneViewportProps {
  modelUrl: string;
  modelName: string;
  showGrid: boolean;
  landmarks: Landmark[];
  onLoadStateChange: (state: ModelLoadState) => void;
}

const DEFAULT_CAMERA = new THREE.Vector3(2.6, 1.4, 3.4);
const DEFAULT_TARGET = new THREE.Vector3(0, 0.85, 0);
// The bundled GLB isn't modeled to real-world scale (its raw geometry is
// only ~1.2 units tall with no compensating node transform), so it's scaled
// to a plausible average adult height in real metres instead of an
// arbitrary cosmetic number. This makes it a meaningful size reference once
// entered coordinates are also plotted in real metres -- a taller or
// shorter skeleton than this will visibly read as taller or shorter.
const DISPLAY_HEIGHT = 1.7;

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose());
    }
  });
}

export const SceneViewport = forwardRef<SceneViewportHandle, SceneViewportProps>(function SceneViewport(
  { modelUrl, modelName, showGrid, landmarks, onLoadStateChange },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const modelBoxRef = useRef<THREE.Box3 | null>(null);
  const overlayRef = useRef<THREE.Group | null>(null);
  const piecesRef = useRef<Map<string, { object: THREE.Object3D; restBox: THREE.Box3 }>>(new Map());

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
    resetCamera,
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
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
    floor.receiveShadow = true;
    scene.add(floor);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.28, 0.09, 72),
      new THREE.MeshStandardMaterial({ color: "#2B333A", roughness: 0.72, metalness: 0.18 }),
    );
    pedestal.position.y = -0.045;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.17, 1.195, 96),
      new THREE.MeshBasicMaterial({ color: "#C8A96B", transparent: true, opacity: 0.48, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    scene.add(ring);

    scene.add(new THREE.HemisphereLight("#F4F0E6", "#171B1F", 2.1));
    const keyLight = new THREE.DirectionalLight("#fff1d9", 3.1);
    keyLight.position.set(3.8, 6.5, 4.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -1;
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
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;
    contentRef.current = content;
    gridRef.current = grid;
    overlayRef.current = overlay;

    return () => {
      cancelAnimationFrame(frame);
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
  }, [showGrid]);

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

    overlay.children.slice().forEach((child) => {
      overlay.remove(child);
      disposeObject(child);
    });

    // depthTest disabled so entered points stay visible even when they sit
    // "inside" the solid reference mesh (e.g. torso points behind the ribcage) --
    // this is a see-through comparison overlay, not physical geometry.
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

    const positionById = landmarksToDisplayPositions(landmarks);

    landmarks.forEach((landmark) => {
      const joint = new THREE.Mesh(jointGeometry, jointMaterial);
      const [px, py, pz] = positionById.get(landmark.id)!;
      joint.position.set(px, py, pz);
      overlay.add(joint);
    });

    CFA_CONNECTIONS.forEach(([fromId, toId]) => {
      const from = positionById.get(fromId);
      const to = positionById.get(toId);
      if (!from || !to) return;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(from[0], from[1], from[2]),
        new THREE.Vector3(to[0], to[1], to[2]),
      ]);
      overlay.add(new THREE.Line(geometry, boneMaterial));
    });
  }, [landmarks]);

  // Poses each of the 18 known skeleton pieces directly from the entered
  // coordinates, once they've been loaded and matched by name (see the
  // GLTFLoader callback below). A piece missing either of its two
  // landmarks is hidden rather than left in a stale or default position.
  useEffect(() => {
    if (piecesRef.current.size === 0) return;
    const positions = landmarksToDisplayPositions(landmarks);
    SKELETON_PIECES.forEach(({ nodeName, from, to }) => {
      const piece = piecesRef.current.get(nodeName);
      if (!piece) return;
      const fromPos = positions.get(from);
      const toPos = positions.get(to);
      if (!fromPos || !toPos) {
        piece.object.visible = false;
        return;
      }
      poseSkeletonPiece(
        piece.object,
        piece.restBox,
        new THREE.Vector3(fromPos[0], fromPos[1], fromPos[2]),
        new THREE.Vector3(toPos[0], toPos[1], toPos[2]),
      );
    });
    const content = contentRef.current;
    if (content) modelBoxRef.current = new THREE.Box3().setFromObject(content);
  }, [landmarks]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.children.slice().forEach((child) => {
      content.remove(child);
      disposeObject(child);
    });
    modelBoxRef.current = null;
    piecesRef.current = new Map();
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
            child.castShadow = true;
            child.receiveShadow = true;
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
        const foundPieces = new Map<string, { object: THREE.Object3D; restBox: THREE.Box3 }>();
        SKELETON_PIECES.forEach(({ nodeName }) => {
          const found = gltf.scene.getObjectByName(nodeName);
          if (found) foundPieces.set(nodeName, { object: found, restBox: new THREE.Box3().setFromObject(found) });
        });

        if (foundPieces.size === SKELETON_PIECES.length) {
          foundPieces.forEach(({ object }) => {
            tintMaterials(object);
            contentRef.current!.add(object);
          });
          piecesRef.current = foundPieces;
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
