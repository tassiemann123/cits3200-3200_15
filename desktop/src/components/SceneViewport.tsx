import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getRenderableBones, type Individual } from '../model';
import { loadMobileModel, createAnatomicalSkeleton, disposeModel, type ModelPieces } from '../lib/mobileModel';

export interface SceneViewportProps {
  individuals: Individual[];
  selectedId: string;
  selectedJointId: string;
  onSelect: (individualId: string, jointId: string) => void;
  showGrid: boolean;
  showMarkers: boolean;
  showLabels: boolean;
  view: 'perspective' | 'front' | 'top';
  frameKey: number;
  zoom: number;
}

type JointTarget = { individualId: string; jointId: string };
type SceneLabel = { element: HTMLDivElement; position: THREE.Vector3 };
type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group;
  floor: THREE.Group;
  targets: THREE.Object3D[];
  rings: THREE.Object3D[];
  labels: SceneLabel[];
  bounds: THREE.Box3;
  framed: boolean;
  baseDistance: number;
};

const point = (p: readonly number[]) => new THREE.Vector3(p[0], p[1], p[2]);
const isCoordinate = (p: readonly (number | null)[]): p is number[] =>
  p.length === 3 && p.every((n) => typeof n === 'number' && Number.isFinite(n));

function disposeContents(group: THREE.Group) {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.userData.sharedGeometry) mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
    else mesh.material?.dispose();
  });
  group.clear();
}

function frameScene(state: SceneState, view: SceneViewportProps['view'], zoom: number) {
  if (state.bounds.isEmpty()) return;
  const center = state.bounds.getCenter(new THREE.Vector3());
  const size = state.bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.z, size.x / Math.max(0.6, state.camera.aspect), size.y, 1.4);
  state.baseDistance = span / (2 * Math.tan(THREE.MathUtils.degToRad(state.camera.fov / 2))) * 1.12;
  const direction = view === 'front'
    ? new THREE.Vector3(0, -1, 0.035)
    : view === 'top'
      ? new THREE.Vector3(0, -0.015, 1)
      : new THREE.Vector3(0.34, -1, 0.30);
  state.controls.target.copy(center);
  state.camera.position.copy(center).add(direction.normalize().multiplyScalar(state.baseDistance / (zoom / 100)));
  state.camera.up.set(0, 0, 1);
  state.camera.lookAt(center);
  state.controls.update();
  state.framed = true;
}

/** Anatomical bone pieces and their recorded endpoints in the shared coordinate space. */
export default function SceneViewport(props: SceneViewportProps) {
  const { individuals, selectedId, selectedJointId, showGrid, showMarkers, showLabels, view, frameKey, zoom } = props;
  const canvasHost = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [fallback, setFallback] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [templates, setTemplates] = useState<ModelPieces | null>(null);
  const [modelError, setModelError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let loaded: ModelPieces | null = null;
    loadMobileModel().then(pieces => {
      if (cancelled) { disposeModel(pieces); return; }
      loaded = pieces; setTemplates(pieces);
    }).catch(() => { if (!cancelled) setModelError('Reference model could not be loaded. Check the bundled mobile GLB and reload.'); });
    return () => { cancelled = true; if (loaded) disposeModel(loaded); };
  }, []);

  useEffect(() => {
    const host = canvasHost.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFallback(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor('#20252A', 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', 'Interactive skeletal survey. Drag to rotate, scroll to zoom, and select a coordinate point. Use the landmark list for keyboard editing.');
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#20252A', 9, 25);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.up.set(0, 0, 1);
    camera.position.set(1.3, -4, 2.3);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.target.set(0, 0, 0.9);
    controls.minDistance = 0.3;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI * 0.98;
    controls.screenSpacePanning = true;
    scene.add(new THREE.HemisphereLight('#fffdf3', '#9ba78f', 2.0));
    const sun = new THREE.DirectionalLight('#fff9e9', 2.0);
    sun.position.set(-2, -3, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -4;
    sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 4;
    sun.shadow.camera.bottom = -4;
    sun.shadow.normalBias = 0.02;
    sun.shadow.bias = -0.0001;
    sun.shadow.radius = 4;
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#dcead6', 1.1);
    fill.position.set(3, 2, 2);
    scene.add(fill);
    const content = new THREE.Group();
    const floor = new THREE.Group();
    scene.add(content, floor);
    const state: SceneState = { renderer, scene, camera, controls, content, floor, targets: [], rings: [], labels: [], bounds: new THREE.Box3(), framed: false, baseDistance: 4 };
    stateRef.current = state;
    const resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (state.framed) frameScene(state, propsRef.current.view, propsRef.current.zoom);
    });
    resize.observe(host);
    const initialRect = host.getBoundingClientRect();
    renderer.setSize(initialRect.width || 800, initialRect.height || 600, false);
    camera.aspect = (initialRect.width || 800) / (initialRect.height || 600);
    camera.updateProjectionMatrix();

    const raycaster = new THREE.Raycaster();
    let down = { x: 0, y: 0 };
    const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
    const pick = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5 || event.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hit = raycaster.intersectObjects(state.targets, false)[0];
      if (hit) {
        const target = hit.object.userData as JointTarget;
        propsRef.current.onSelect(target.individualId, target.jointId);
      }
    };
    const hover = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      renderer.domElement.style.cursor = raycaster.intersectObjects(state.targets, false).length ? 'pointer' : 'grab';
    };
    const startDrag = () => setIsDragging(true);
    const stopDrag = () => setIsDragging(false);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pick);
    renderer.domElement.addEventListener('pointermove', hover);
    controls.addEventListener('start', startDrag);
    controls.addEventListener('end', stopDrag);
    let animation = 0;
    const projected = new THREE.Vector3();
    const animate = () => {
      animation = requestAnimationFrame(animate);
      controls.update();
      state.rings.forEach((ring) => ring.quaternion.copy(camera.quaternion));
      state.labels.forEach(({ element, position }) => {
        projected.copy(position).project(camera);
        element.style.transform = `translate(-50%, -50%) translate(${(projected.x * 0.5 + 0.5) * host.clientWidth}px, ${(-projected.y * 0.5 + 0.5) * host.clientHeight}px)`;
        element.style.visibility = projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2 ? 'visible' : 'hidden';
      });
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(animation);
      resize.disconnect();
      controls.removeEventListener('start', startDrag);
      controls.removeEventListener('end', stopDrag);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pick);
      renderer.domElement.removeEventListener('pointermove', hover);
      disposeContents(content);
      disposeContents(floor);
      sun.shadow.dispose();
      state.labels.forEach(({ element }) => element.remove());
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    disposeContents(state.content);
    disposeContents(state.floor);
    state.labels.forEach(({ element }) => element.remove());
    state.labels = [];
    state.targets = [];
    state.rings = [];
    state.bounds.makeEmpty();

    individuals.filter((individual) => individual.visible).forEach((individual) => {
      const individualGroup = new THREE.Group();
      state.content.add(individualGroup);
      const selected = individual.id === selectedId;
      const color = new THREE.Color(individual.color);
      const jointsMaterial = new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color('#f7f9ee'), 0.18), roughness: 0.6 });
      const selectedMaterial = new THREE.MeshStandardMaterial({ color: '#fdfef8', roughness: 0.5, emissive: color, emissiveIntensity: 0.12 });
      const renderable = getRenderableBones(individual);
      // A recorded endpoint can still be inspected when the other end is blank.
      // Inventory controls presence; completeness only controls connecting shafts.
      const boneIds = new Set(individual.bones.filter((bone) => bone.status === 'present').map((bone) => bone.id));
      const individualBounds = new THREE.Box3();
      if (templates) {
        const model = createAnatomicalSkeleton(individual, templates, selected ? selectedJointId : undefined);
        individualGroup.add(model);
        if (model.children.length) individualBounds.union(new THREE.Box3().setFromObject(model));
      }
      renderable.forEach(bone => individualBounds.expandByPoint(point(bone.from)).expandByPoint(point(bone.to)));

      if (showMarkers) individual.joints.forEach((joint) => {
        const unique = new Set<string>();
        joint.endpoints.forEach((endpoint) => {
          if (!isCoordinate(endpoint.coordinate) || !boneIds.has(endpoint.boneId)) return;
          const key = endpoint.coordinate.join(',');
          if (unique.has(key)) return;
          unique.add(key);
          const position = point(endpoint.coordinate);
          individualBounds.expandByPoint(position);
          const active = selected && joint.id === selectedJointId;
          const marker = new THREE.Mesh(new THREE.SphereGeometry(active ? 0.018 : 0.0115, 14, 10), active ? selectedMaterial : jointsMaterial);
          marker.position.copy(position);
          marker.renderOrder = 2;
          marker.userData = { individualId: individual.id, jointId: joint.id };
          individualGroup.add(marker);
          const pickTarget = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
          pickTarget.position.copy(position);
          pickTarget.userData = marker.userData;
          individualGroup.add(pickTarget);
          state.targets.push(pickTarget);
          if (active) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.039, 0.0027, 6, 40), new THREE.MeshBasicMaterial({ color, depthTest: false }));
            ring.position.copy(position);
            ring.renderOrder = 4;
            individualGroup.add(ring);
            state.rings.push(ring);
            const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.001, 4, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthTest: false }));
            outerRing.position.copy(position);
            outerRing.renderOrder = 3;
            individualGroup.add(outerRing);
            state.rings.push(outerRing);
          }
        });
      });
      state.bounds.union(individualBounds);
      if (!individualBounds.isEmpty() && showLabels && labelHost.current) {
        const label = document.createElement('div');
        label.style.cssText = `position:absolute;top:0;left:0;display:flex;align-items:center;gap:7px;white-space:nowrap;padding:6px 10px;border:1px solid ${selected ? '#c3d0bb' : '#dce1d7'};border-radius:6px;background:rgba(18,29,37,.9);box-shadow:0 2px 8px #293b1810;font:600 10px/1.2 Inter,system-ui,sans-serif;color:#dce4ea;letter-spacing:.035em;pointer-events:none;`;
        const dot = document.createElement('span');
        dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${individual.color}`;
        const name = document.createElement('span');
        name.textContent = individual.name;
        label.append(dot, name);
        labelHost.current.appendChild(label);
        const position = individualBounds.getCenter(new THREE.Vector3());
        position.z = individualBounds.max.z + 0.13;
        state.labels.push({ element: label, position });
      }
      if (!individualBounds.isEmpty()) {
        const center = individualBounds.getCenter(new THREE.Vector3());
        const footprint = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.255, 80), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: selected ? 0.3 : 0.16, side: THREE.DoubleSide }));
        footprint.position.set(center.x, center.y, individualBounds.min.z - 0.033);
        state.floor.add(footprint);
      }
    });

    const center = state.bounds.isEmpty() ? new THREE.Vector3(0, 0, 0.9) : state.bounds.getCenter(new THREE.Vector3());
    const floorZ = state.bounds.isEmpty() ? 0 : state.bounds.min.z - 0.04;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: '#20252A', roughness: 1, metalness: 0 }));
    plane.position.set(center.x, center.y, floorZ - 0.002);
    plane.receiveShadow = true;
    state.floor.add(plane);
    if (showGrid) {
      const grid = new THREE.GridHelper(20, 100, '#57636e', '#36414b');
      grid.rotation.x = Math.PI / 2;
      grid.position.set(Math.round(center.x / 0.2) * 0.2, Math.round(center.y / 0.2) * 0.2, floorZ);
      const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
      materials.forEach((m) => { m.transparent = true; m.opacity = 0.4; });
      state.floor.add(grid);
    }
    if (!state.framed || (templates && !state.content.userData.modelFramed)) {
      state.content.userData.modelFramed = Boolean(templates);
      frameScene(state, propsRef.current.view, propsRef.current.zoom);
    }
  }, [individuals, selectedId, selectedJointId, showGrid, showMarkers, showLabels, templates]);

  useEffect(() => {
    const state = stateRef.current;
    if (state) frameScene(state, view, propsRef.current.zoom);
  }, [view, frameKey]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state || !state.framed) return;
    const direction = state.camera.position.clone().sub(state.controls.target).normalize();
    state.camera.position.copy(state.controls.target).add(direction.multiplyScalar(state.baseDistance / (zoom / 100)));
    state.controls.update();
  }, [zoom]);

  return <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden', background: '#20252A', cursor: isDragging ? 'grabbing' : undefined }}>
    <div ref={canvasHost} style={{ position: 'absolute', inset: 0 }} />
    <div ref={labelHost} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />
    {fallback && <div className="model-message">3D rendering is unavailable in this browser. Coordinate editing remains available.</div>}
    {!templates && !fallback && <div className="model-message">{modelError || 'Loading anatomical reference…'}</div>}

    <div aria-hidden="true" style={{ position: 'absolute', bottom: 57, left: 20, width: 50, height: 50, pointerEvents: 'none' }}>
      <svg width="52" height="52" viewBox="0 0 52 52"><path d="M18 33V8" stroke="#738e69" strokeWidth="1.5"/><path d="M18 33L43 39" stroke="#ae9475" strokeWidth="1.5"/><path d="M18 33L4 43" stroke="#8e9c9b" strokeWidth="1.5"/><circle cx="18" cy="33" r="2.5" fill="#6e7f60"/><text x="15" y="7" fontSize="8" fill="#738e69">Z</text><text x="46" y="42" fontSize="8" fill="#ae9475">X</text><text x="0" y="51" fontSize="8" fill="#8e9c9b">Y</text></svg>
    </div>
    <div style={{ position: 'absolute', top: 24, right: 18, maxWidth: 170, color: '#7c8674', textAlign: 'right', pointerEvents: 'none', font: '9px/1.6 Inter, system-ui, sans-serif' }}>
      <div style={{ letterSpacing: '.03em', fontSize: 9 }}>{!fallback && templates ? 'Anatomical reference' : ''}</div>
    </div>
  </div>;
}
