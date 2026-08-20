import type { Vec3 } from "../types";

/** Converts survey X/Z/Y ordering into a Three.js X/Y/Z world with elevation on Y. */
export function surveyToWorld(x: number, z: number, y: number): Vec3 {
  return [x, z, -y];
}

export function centroid(points: Vec3[]): Vec3 {
  if (points.length === 0) return [0, 0, 0];
  const sum = points.reduce<Vec3>((acc, point) => [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]], [0, 0, 0]);
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}
