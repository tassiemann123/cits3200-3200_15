import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Three.js strips characters like '.' from bone names at runtime (they
// clash with its animation-path syntax), so "HUMERUS.L" in the source
// file becomes "HUMERUSL" once loaded. Matching is done with dots
// stripped from both sides so it works either way.
function sanitize(name: string) {
  return name.replace(/[.[\]]/g, '');
}
function resolveBoneByPrefix(boneMap: Map<string, THREE.Bone>, prefix: string) {
  const sanitizedPrefix = sanitize(prefix);
  for (const [name, bone] of boneMap) {
    const sanitizedName = sanitize(name);
    if (sanitizedName === sanitizedPrefix || sanitizedName.startsWith(sanitizedPrefix + '_')) {
      return bone;
    }
  }
  return null;
}

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const boneMapRef = useRef<Map<string, THREE.Bone>>(new Map());
  const [boneNames, setBoneNames] = useState<string[]>([]);
  const [selectedBone, setSelectedBone] = useState<string>('');
  const [rotationDeg, setRotationDeg] = useState(0);
  const restRotationRef = useRef<THREE.Euler | null>(null);

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
        boneMapRef.current = boneMap;
        setBoneNames([...boneMap.keys()].sort());

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
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  function handleSelectBone(name: string) {
    setSelectedBone(name);
    const bone = resolveBoneByPrefix(boneMapRef.current, name) ?? boneMapRef.current.get(name);
    restRotationRef.current = bone ? bone.rotation.clone() : null;
    setRotationDeg(0);
  }

  function handleSlider(deg: number) {
    setRotationDeg(deg);
    const bone = boneMapRef.current.get(selectedBone);
    if (!bone || !restRotationRef.current) return;
    const rest = restRotationRef.current;
    bone.rotation.set(
      rest.x + THREE.MathUtils.degToRad(deg),
      rest.y,
      rest.z
    );
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div ref={mountRef} />

      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          right: 12,
          background: 'rgba(0,0,0,0.8)',
          color: '#fff',
          padding: 12,
          borderRadius: 8,
          fontFamily: 'monospace',
          fontSize: 13,
        }}
      >
        <div style={{ marginBottom: 8, fontWeight: 'bold' }}>Bone rotation test</div>

        <select
          value={selectedBone}
          onChange={(e) => handleSelectBone(e.target.value)}
          style={{ width: '100%', marginBottom: 8, padding: 4 }}
        >
          <option value="">-- pick a bone ({boneNames.length} found) --</option>
          {boneNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div style={{ marginBottom: 4 }}>Rotate X axis: {rotationDeg}°</div>
        <input
          type="range"
          min={-180}
          max={180}
          value={rotationDeg}
          onChange={(e) => handleSlider(Number(e.target.value))}
          disabled={!selectedBone}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}

export default App;