import type { Landmark, Vec3 } from "../types";
import { centroid } from "./coordinates";

export interface ModelAlignment {
  sourceLongAxis: Vec3;
  sourceWidthAxis: Vec3;
  targetLongAxis: Vec3;
  targetWidthAxis: Vec3;
  targetCenter: Vec3;
  targetLength: number;
  uniformScale: number;
}

const EPSILON = 1e-6;

function axisVector(index: number): Vec3 {
  return [index === 0 ? 1 : 0, index === 1 ? 1 : 0, index === 2 ? 1 : 0];
}

function dotHorizontal(point: Vec3, axis: Vec3): number {
  return point[0] * axis[0] + point[2] * axis[2];
}

function horizontalPrincipalAxis(landmarks: Landmark[]): Vec3 {
  const points = landmarks.map((landmark) => landmark.position);
  if (points.length < 2) return [0, 0, 1];
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
  let axis: Vec3 = [Math.cos(angle), 0, Math.sin(angle)];
  const labelledHead = landmarks.find((landmark) => /(?:head|skull|cranium)/i.test(landmark.label))
    ?? landmarks.find((landmark) => /^(?:point\s*)?0*1$/i.test(landmark.label.trim()));
  const headHint = labelledHead ?? landmarks[0];
  const headOffset: Vec3 = [
    headHint.position[0] - center[0],
    0,
    headHint.position[2] - center[2],
  ];

  // Both bundled models use their positive long axis from feet to head.
  // Survey files conventionally start at the skull, so keep that end positive.
  if (dotHorizontal(headOffset, axis) < 0) axis = [-axis[0], 0, -axis[2]];
  return axis;
}

export function calculateModelAlignment(landmarks: Landmark[], sourceSize: Vec3): ModelAlignment {
  const points = landmarks.map((landmark) => landmark.position);
  const targetLongAxis = horizontalPrincipalAxis(landmarks);
  const targetWidthAxis: Vec3 = [targetLongAxis[2], 0, -targetLongAxis[0]];

  const longValues = points.map((point) => dotHorizontal(point, targetLongAxis));
  const widthValues = points.map((point) => dotHorizontal(point, targetWidthAxis));
  const yValues = points.map((point) => point[1]);
  const longMin = Math.min(...longValues);
  const longMax = Math.max(...longValues);
  const widthMin = Math.min(...widthValues);
  const widthMax = Math.max(...widthValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const longMid = (longMin + longMax) / 2;
  const widthMid = (widthMin + widthMax) / 2;
  const targetLength = Math.max(longMax - longMin, EPSILON);

  const sourceAxes = [0, 1, 2].sort((a, b) => sourceSize[b] - sourceSize[a]);
  const sourceLongAxis = axisVector(sourceAxes[0]);
  const sourceWidthAxis = axisVector(sourceAxes[1]);
  const sourceLength = Math.max(sourceSize[sourceAxes[0]], EPSILON);

  return {
    sourceLongAxis,
    sourceWidthAxis,
    targetLongAxis,
    targetWidthAxis,
    targetCenter: [
      targetLongAxis[0] * longMid + targetWidthAxis[0] * widthMid,
      (yMin + yMax) / 2,
      targetLongAxis[2] * longMid + targetWidthAxis[2] * widthMid,
    ],
    targetLength,
    uniformScale: targetLength / sourceLength,
  };
}
