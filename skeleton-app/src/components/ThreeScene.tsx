import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Renders the 3D skeleton viewport. Pure display for now - no bone
// posing logic wired in yet (that comes later, once the UI shell works).
// Exposes the loaded bone map upward via onModelLoaded so posing logic
// has somewhere to hook in without this component needing to know
// anything about coordinates or posing itself.

interface ThreeSceneProps {
  onModelLoaded?: (boneMap: Map<string, THREE.Bone>) => void;
}

export default function ThreeScene({ onModelLoaded }: ThreeSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);

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
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        camera.position
          .copy(center)
          .add(new THREE.Vector3(size, size, size).multiplyScalar(0.6));
        camera.near = size / 100;
        camera.far = size * 100;
        camera.updateProjectionMatrix();
        controls.minDistance = size * 0.1;
        controls.maxDistance = size * 3;
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

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}