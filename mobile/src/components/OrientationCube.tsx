/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG, 
 * RUAN VAN ZYL
 * 
 * File Function:
 * OrientationCube.tsx file for the coordinate system with three coloured arrows
 * that rotates with the camera on the android application to ease modification
 * of skeletons coordinates for noise/bad inputs that cause visualisation issues.
 * 
 * The feature will follow the same styling system used in the android application
 * frontend UI.
 * 
 * Component explicitly does not import three.js as SceneViewport which calls the
 * file is lazy-loaded, thus having three.js in this file would pull the other 
 * into the apps start bundle, thus we have manual quaternion maths.
 */

import { forwardRef, useImperativeHandle, useRef } from "react";
import { cfaLandmarkToWorld } from "../lib/coordinates";
import type { Vec3 } from "../types";

/** 
 * Sets the variable for the camera quartnion that provides the reference for the 
 * cubes position and rotation
 */
export interface OrientationCubeHandle {
  setCameraQuaternion: (q: [number, number, number, number]) => void;
}

// Axis colours (X red, Y green, Z blue) and sizes chosen arbitrarily and can be 
// adjusted below
const AXES: { label: string; colour: string; cfa: Vec3 }[] = [
  { label: "X", colour: "#d9675f", cfa: [1, 0, 0] },
  { label: "Y", colour: "#7bb06a", cfa: [0, 1, 0] },
  { label: "Z", colour: "#6a9fd9", cfa: [0, 0, 1] },
];
// SVG geometry using viewBox units, the dials must sit within the round container
// calculated with radius == size halved, so keep arm less than this if changing size
const SIZE = 62;
const CENTRE = SIZE / 2;
const ARM = 15;

/** 
 * Rotates the current vector v by the unit quarternion (qx, qy, qz, qw) to find the transformed
 * vectors as t and then returns the modified v with the camera q with t.
 * Vector Right Hand Rule can be used to assist with cross product results analysis.
 */
function rotate([vx, vy, vz]: Vec3, qx: number, qy: number, qz: number, qw: number): Vec3 {
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

/**
 * Function to take the calculated transformed/rotated vector locations and generate the cube
 */
export const OrientationCube = forwardRef<OrientationCubeHandle>(function OrientationCube(_props, ref) {
  const lines = useRef<(SVGLineElement | null)[]>([]);
  const labels = useRef<(SVGTextElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    setCameraQuaternion([x, y, z, w]) {
      AXES.forEach((axis, i) => {
        // We take the world direction to camera view space as the inverse rotation
        const [vx, vy, vz] = rotate(cfaLandmarkToWorld(axis.cfa), -x, -y, -z, w);
        const tipX = CENTRE + vx * ARM;
        // Y runs downwards for the SVG so we need to subtract
        const tipY = CENTRE - vy * ARM;
        // If an axis is pointing away we can set it to reduce in opacity and reduce 
        // visual clutter
        const opacity = vz >= 0 ? "1" : "0.4";
        lines.current[i]?.setAttribute("x2", String(tipX));
        lines.current[i]?.setAttribute("y2", String(tipY));
        lines.current[i]?.setAttribute("opacity", opacity);
        labels.current[i]?.setAttribute("x", String(CENTRE + vx * (ARM + 7)));
        labels.current[i]?.setAttribute("y", String(CENTRE - vy * (ARM + 7)));
        labels.current[i]?.setAttribute("opacity", opacity);
      });
    },
  }), []);

  return (
    <div className="orientation-cube" aria-hidden="true">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {AXES.map((axis, i) => (
          <g key={axis.label} stroke={axis.colour} fill={axis.colour}>
            <line ref={(el) => { lines.current[i] = el; }} x1={CENTRE} y1={CENTRE} x2={CENTRE} y2={CENTRE} strokeWidth={2} strokeLinecap="round" />
            <text ref={(el) => { labels.current[i] = el; }} x={CENTRE} y={CENTRE} stroke="none" textAnchor="middle" dominantBaseline="central">{axis.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
});