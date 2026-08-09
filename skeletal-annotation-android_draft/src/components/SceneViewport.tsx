import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { SkeletonLayer, Vec3 } from "../types";
import { centroid } from "../lib/coordinates";

export interface SceneViewportHandle {
  resetCamera: () => void;
  focusSelected: () => void;
  capturePng: () => Promise<Blob | null>;
}

interface SceneViewportProps {
  layers: SkeletonLayer[];
  selectedId: string | null;
  showGrid: boolean;
  showModels: boolean;
  onSelect: (id: string) => void;
}

const DEFAULT_CAMERA = new THREE.Vector3(4.8, 8.2, 2.2);
const DEFAULT_TARGET = new THREE.Vector3(2.6, 1.65, -6.3);

function allPositions(layer: SkeletonLayer): Vec3[] {
  return layer.landmarks.map((landmark) => landmark.position);
}

function layerBox(layer: SkeletonLayer): THREE.Box3 {
  const points = allPositions(layer).map((point) => new THREE.Vector3(...point));
  return points.length > 0 ? new THREE.Box3().setFromPoints(points) : new THREE.Box3();
}

function principalDirection(points: Vec3[]): THREE.Vector2 {
  if (points.length < 2) return new THREE.Vector2(0, 1);
  const center = centroid(points);
  let xx = 0;
  let zz = 0;
  let xz = 0;
  points.forEach(([x, , z]) => {
    const dx = x - center[0];
    const dz = z - center[2];
    xx += dx * dx;
    zz += dz * dz;
    xz += dx * dz;
  });
  const angle = 0.5 * Math.atan2(2 * xz, xx - zz);
  return new THREE.Vector2(Math.cos(angle), Math.sin(angle)).normalize();
}

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
  { layers, selectedId, showGrid, showModels, onSelect },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const layersRef = useRef(layers);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  layersRef.current = layers;
  selectedRef.current = selectedId;
  onSelectRef.current = onSelect;

  const focusLayer = (layer: SkeletonLayer | undefined) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !layer) return;
    const box = layerBox(layer);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.5);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(radius * 0.9, radius * 1.45, radius * 0.9));
    camera.near = Math.max(radius / 100, 0.001);
    camera.far = Math.max(radius * 100, 100);
    camera.updateProjectionMatrix();
    controls.update();
  };

  useImperativeHandle(ref, () => ({
    resetCamera: () => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      camera.position.copy(DEFAULT_CAMERA);
      controls.target.copy(DEFAULT_TARGET);
      controls.update();
    },
    focusSelected: () => focusLayer(layersRef.current.find((layer) => layer.id === selectedRef.current)),
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
    scene.background = new THREE.Color("#07171b");
    scene.fog = new THREE.FogExp2("#07171b", 0.025);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 200);
    camera.position.copy(DEFAULT_CAMERA);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(DEFAULT_TARGET);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.25;
    controls.maxDistance = 40;
    controls.update();

    const grid = new THREE.GridHelper(12, 48, "#53767c", "#1f3b40");
    grid.position.set(3, 1.15, -6.2);
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.46;
    });
    scene.add(grid);

    const grave = new THREE.Mesh(
      new THREE.BoxGeometry(3.3, 0.03, 2.2),
      new THREE.MeshStandardMaterial({ color: "#183037", roughness: 1, metalness: 0, transparent: true, opacity: 0.72 }),
    );
    grave.position.set(2.8, 1.12, -6.25);
    scene.add(grave);
    scene.add(new THREE.HemisphereLight("#dff9f4", "#102125", 2.2));
    const keyLight = new THREE.DirectionalLight("#fff4dd", 2.4);
    keyLight.position.set(5, 10, 4);
    scene.add(keyLight);
    const content = new THREE.Group();
    scene.add(content);

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 0.055 };
    raycaster.params.Points = { threshold: 0.08 };
    const pointer = new THREE.Vector2();
    let pointerStart: { x: number; y: number } | null = null;
    const onPointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const onPointerUp = (event: PointerEvent) => {
      if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(content.children, true).find((intersection) => intersection.object.userData.layerId);
      if (hit) onSelectRef.current(String(hit.object.userData.layerId));
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

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

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      contentRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
  }, [showGrid]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.children.slice().forEach((child) => {
      content.remove(child);
      disposeObject(child);
    });
    const selected = layers.find((layer) => layer.id === selectedId);

    layers.filter((layer) => layer.visible).forEach((layer) => {
      const group = new THREE.Group();
      group.userData.layerId = layer.id;
      const selectedLayer = layer.id === selectedId;
      const linePositions = layer.segments.flatMap((segment) => [...segment.from, ...segment.to]);
      if (linePositions.length > 0) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
        const material = new THREE.LineBasicMaterial({ color: layer.color, transparent: true, opacity: selectedLayer ? 1 : 0.78 });
        const lines = new THREE.LineSegments(geometry, material);
        lines.userData.layerId = layer.id;
        group.add(lines);
      }
      const pointPositions = layer.landmarks.flatMap((landmark) => landmark.position);
      if (pointPositions.length > 0 && (selectedLayer || layer.locked)) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
        const material = new THREE.PointsMaterial({ color: layer.color, size: selectedLayer ? 0.052 : 0.028, sizeAttenuation: true, transparent: true, opacity: 0.95 });
        const points = new THREE.Points(geometry, material);
        points.userData.layerId = layer.id;
        group.add(points);
      }
      content.add(group);
    });

    let cancelled = false;
    if (showModels && selected?.visible && selected.modelType !== "landmarks" && selected.landmarks.length > 1) {
      const url = selected.modelType === "female" ? "/models/female_skeleton.glb" : "/models/skeleton_pre-cut.glb";
      new GLTFLoader().load(url, (gltf) => {
        if (cancelled || !contentRef.current) return;
        const overlay = clone(gltf.scene);
        overlay.name = "reference-model-overlay";
        overlay.userData.layerId = selected.id;
        overlay.traverse((object) => {
          object.userData.layerId = selected.id;
          if (object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh) {
            const materials = (Array.isArray(object.material) ? object.material : [object.material]).map((source) => {
              const material = source.clone();
              material.transparent = true;
              material.opacity = 0.32;
              material.depthWrite = false;
              if ("color" in material && material.color instanceof THREE.Color) material.color.lerp(new THREE.Color(selected.color), 0.58);
              return material;
            });
            object.material = Array.isArray(object.material) ? materials : materials[0];
          }
        });
        const sourceBox = new THREE.Box3().setFromObject(overlay);
        const sourceSize = sourceBox.getSize(new THREE.Vector3());
        const targetBox = layerBox(selected);
        const targetSize = targetBox.getSize(new THREE.Vector3());
        const targetCenter = targetBox.getCenter(new THREE.Vector3());
        const targetLength = Math.max(targetSize.x, targetSize.z, 0.5);
        const scale = targetLength / Math.max(sourceSize.y, sourceSize.x, sourceSize.z, 0.001);
        overlay.scale.setScalar(scale);
        const direction = principalDirection(allPositions(selected));
        const layDown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(direction.x, direction.y));
        overlay.quaternion.copy(yaw.multiply(layDown));
        overlay.updateMatrixWorld(true);
        const positionedBox = new THREE.Box3().setFromObject(overlay);
        const positionedCenter = positionedBox.getCenter(new THREE.Vector3());
        overlay.position.add(targetCenter.sub(positionedCenter));
        contentRef.current.add(overlay);
      });
    }

    return () => { cancelled = true; };
  }, [layers, selectedId, showModels]);

  return <div ref={hostRef} className="scene-canvas" aria-label="3D skeletal viewport" />;
});
