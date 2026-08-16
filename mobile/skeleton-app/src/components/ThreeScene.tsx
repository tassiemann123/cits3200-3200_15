import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface ThreeSceneProps {
  onModelLoaded?: (boneMap: Map<string, THREE.Bone>) => void;
}

export default function ThreeScene({ onModelLoaded }: ThreeSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Kept in refs (not local vars) so the zoom buttons, which live outside
  // the setup effect, can reach the same live camera/controls instance.
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.01,
      1000
    );
    camera.position.set(2, 2, 2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.touchAction = 'none';
    mountRef.current?.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(5, 10, 7);
    scene.add(light);

    const loader = new GLTFLoader();
    loader.load(
      '/skeleton_rig.glb',
      (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        const boneMap = new Map<string, THREE.Bone>();
        model.traverse((child) => {
          if ((child as THREE.Bone).isBone) {
            boneMap.set(child.name, child as THREE.Bone);
          }
        });
        onModelLoaded?.(boneMap);

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());

        const viewDir = new THREE.Vector3(1, 1, 1).normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(worldUp, viewDir).normalize();
        const up = new THREE.Vector3().crossVectors(viewDir, right).normalize();

        const corners = [
          new THREE.Vector3(box.min.x, box.min.y, box.min.z),
          new THREE.Vector3(box.min.x, box.min.y, box.max.z),
          new THREE.Vector3(box.min.x, box.max.y, box.min.z),
          new THREE.Vector3(box.min.x, box.max.y, box.max.z),
          new THREE.Vector3(box.max.x, box.min.y, box.min.z),
          new THREE.Vector3(box.max.x, box.min.y, box.max.z),
          new THREE.Vector3(box.max.x, box.max.y, box.min.z),
          new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        ];

        let maxRightExtent = 0;
        let maxUpExtent = 0;
        corners.forEach((corner) => {
          const rel = corner.clone().sub(center);
          maxRightExtent = Math.max(maxRightExtent, Math.abs(rel.dot(right)));
          maxUpExtent = Math.max(maxUpExtent, Math.abs(rel.dot(up)));
        });

        const vFovRad = (camera.fov * Math.PI) / 180;
        const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * camera.aspect);
        const distanceForUp = maxUpExtent / Math.tan(vFovRad / 2);
        const distanceForRight = maxRightExtent / Math.tan(hFovRad / 2);

        const paddingFactor = 1.0;
        const distance = Math.max(distanceForUp, distanceForRight) * paddingFactor;

        controls.target.copy(center);
        camera.position.copy(center).add(viewDir.clone().multiplyScalar(distance));
        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.updateProjectionMatrix();
        controls.minDistance = distance * 0.05;
        controls.maxDistance = distance * 6;
      },
      undefined,
      (error) => console.error('Error loading model:', error)
    );

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual zoom - moves the camera along its current line of sight toward
  // or away from the target. Works instantly, live, no rebuild needed -
  // this is the actual fix for "can't tell what size looks right" without
  // going through a full rebuild/reinstall cycle for every test.
  function zoomBy(factor: number) {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const offset = camera.position.clone().sub(controls.target);
    offset.multiplyScalar(factor);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }

  const buttonStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: 'rgba(0,0,0,0.85)',
    color: '#fff',
    border: '1px solid #444',
    fontSize: 22,
    fontFamily: 'sans-serif',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Manual zoom controls - live adjustment, no rebuild required */}
      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 90,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 19,
        }}
      >
        <button onClick={() => zoomBy(0.8)} style={buttonStyle} title="Zoom in">
          +
        </button>
        <button onClick={() => zoomBy(1.25)} style={buttonStyle} title="Zoom out">
          −
        </button>
      </div>
    </>
  );
}