import { forwardRef, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { surveyPointToScene } from '../lib/mobileModel';

export interface OrientationAxesHandle {
  setCameraQuaternion: (quaternion: THREE.Quaternion) => void;
}

const SIZE = 62;
const CENTER = SIZE / 2;
const ARM = 15;
const AXES = [
  { label: 'X', color: '#FF3030', direction: surveyPointToScene([1, 0, 0]) },
  { label: 'Y', color: '#00E5FF', direction: surveyPointToScene([0, 1, 0]) },
  { label: 'Z', color: '#39FF14', direction: surveyPointToScene([0, 0, 1]) },
];

/** Shows the recorded coordinate axes from the current camera angle. */
const OrientationAxes = forwardRef<OrientationAxesHandle>(function OrientationAxes(_props, ref) {
  const lines = useRef<(SVGLineElement | null)[]>([]);
  const labels = useRef<(SVGTextElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    setCameraQuaternion(quaternion) {
      const inverse = quaternion.clone().invert();
      AXES.forEach((axis, index) => {
        const direction = axis.direction.clone().applyQuaternion(inverse);
        const opacity = direction.z >= 0 ? '1' : '0.55';
        lines.current[index]?.setAttribute('x2', String(CENTER + direction.x * ARM));
        lines.current[index]?.setAttribute('y2', String(CENTER - direction.y * ARM));
        lines.current[index]?.setAttribute('opacity', opacity);
        labels.current[index]?.setAttribute('x', String(CENTER + direction.x * (ARM + 7)));
        labels.current[index]?.setAttribute('y', String(CENTER - direction.y * (ARM + 7)));
        labels.current[index]?.setAttribute('opacity', opacity);
      });
    },
  }), []);

  return (
    <div aria-hidden="true" style={{ position: 'absolute', bottom: 53, left: 16, width: SIZE, height: SIZE, pointerEvents: 'none' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={CENTER} cy={CENTER} r="2.5" fill="#39FF14" />
        {AXES.map((axis, index) => (
          <g key={axis.label} stroke={axis.color} fill={axis.color}>
            <line ref={element => { lines.current[index] = element; }} x1={CENTER} y1={CENTER} x2={CENTER} y2={CENTER} strokeWidth="1.5" strokeLinecap="round" />
            <text ref={element => { labels.current[index] = element; }} x={CENTER} y={CENTER} stroke="none" fontSize="9" fontWeight="600" textAnchor="middle" dominantBaseline="central">{axis.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
});

export default OrientationAxes;
