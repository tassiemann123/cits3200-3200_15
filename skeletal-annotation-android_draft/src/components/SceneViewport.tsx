import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { ModelLoadState } from "../types";

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
  onLoadStateChange: (state: ModelLoadState) => void;
}

const DEFAULT_CAMERA = new THREE.Vector3(3.2, 1.8, 4.4);
const DEFAULT_TARGET = new THREE.Vector3(0, 1.12, 0);
const DISPLAY_HEIGHT = 2.25;

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
  { modelUrl, modelName, showGrid, onLoadStateChange },
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
    scene.background = new THREE.Color("#061418");
    scene.fog = new THREE.FogExp2("#061418", 0.055);

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

    const grid = new THREE.GridHelper(8, 32, "#477873", "#17353a");
    grid.position.y = -0.075;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.34;
    });
    scene.add(grid);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: "#07191d", roughness: 0.96, metalness: 0.02 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.09;
    floor.receiveShadow = true;
    scene.add(floor);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.28, 0.09, 72),
      new THREE.MeshStandardMaterial({ color: "#102c31", roughness: 0.72, metalness: 0.18 }),
    );
    pedestal.position.y = -0.045;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.17, 1.195, 96),
      new THREE.MeshBasicMaterial({ color: "#69d9c3", transparent: true, opacity: 0.48, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    scene.add(ring);

    scene.add(new THREE.HemisphereLight("#e6fff9", "#071113", 2.1));
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
    const rimLight = new THREE.DirectionalLight("#61d8cf", 1.7);
    rimLight.position.set(-4, 2.6, -3.5);
    scene.add(rimLight);

    const content = new THREE.Group();
    scene.add(content);

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
    modelBoxRef.current = null;
    onLoadStateChange("loading");

    let cancelled = false;
    new GLTFLoader().load(
      modelUrl,
      (gltf) => {
        if (cancelled || !contentRef.current) {
          disposeObject(gltf.scene);
          return;
        }

        const model = clone(gltf.scene);
        const oriented = new THREE.Group();
        const pivot = new THREE.Group();
        pivot.name = `${modelName}-reference-model`;
        oriented.add(model);
        pivot.add(oriented);
        const tint = new THREE.Color("#D8CBB7");

        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = true;
          object.receiveShadow = true;
          const materials = (Array.isArray(object.material) ? object.material : [object.material]).map((source) => {
            const material = source.clone();
            if ("color" in material && material.color instanceof THREE.Color) material.color.lerp(tint, 0.3);
            if ("roughness" in material && typeof material.roughness === "number") material.roughness = Math.max(material.roughness, 0.58);
            if ("metalness" in material && typeof material.metalness === "number") material.metalness = Math.min(material.metalness, 0.08);
            return material;
          });
          object.material = Array.isArray(object.material) ? materials : materials[0];
        });

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
