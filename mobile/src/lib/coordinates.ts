import type { Landmark, Vec3 } from "../types";

/** Converts survey X/Z/Y ordering into a Three.js X/Y/Z world with elevation on Y. */
export function surveyToWorld(x: number, z: number, y: number): Vec3 {
  return [x, z, -y];
}

export function centroid(points: Vec3[]): Vec3 {
  if (points.length === 0) return [0, 0, 0];
  const sum = points.reduce<Vec3>((acc, point) => [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]], [0, 0, 0]);
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}


/**
 * Converts an entered CFA landmark coordinate (from the mobile app's manual
 * X/Y/Z entry form) into Three.js world space.
 *
 * ASSUMPTION, NOT YET CONFIRMED BY THE TEAM: this treats the form's Z
 * column as elevation (height off the ground) -- the ordinary "Z is up"
 * convention, and the more likely reading of "the x axis is parallel to
 * the wall" (implying X and Y are both horizontal). The site's separate
 * total-station survey exports actually use a *different* convention
 * (elevation in the middle/Y column -- see surveyToWorld above), so this
 * may need to change once someone confirms which column the CFA paper
 * form actually uses for height. If it turns out to be Y instead of Z,
 * change the return below to `[x, y, z]`.
 */
export function cfaLandmarkToWorld([x, y, z]: Vec3): Vec3 {
  return [x, z, y];
}


/**
 * Converts a full set of entered CFA landmarks into Three.js display
 * positions: recentred on the sacral promontory (the pelvis point the
 * team is using as each skeleton's own local origin), then lifted so the
 * pelvis sits at roughly hip height on the reference model instead of
 * down at the floor. Shared between the coordinate overlay and the posed
 * reference mesh so both always agree on where a given landmark actually
 * is.
 */
export function landmarksToDisplayPositions(landmarks: Landmark[]): Map<string, Vec3> {
  const PELVIS_HEIGHT = 0.95; // approx metres off the ground for an adult hip
  const reference = landmarks.find((landmark) => landmark.id === "sacral_promontory")?.position;
  const referenceWorld = reference ? cfaLandmarkToWorld(reference) : null;

  const result = new Map<string, Vec3>();
  landmarks.forEach((landmark) => {
    const [wx, wy, wz] = cfaLandmarkToWorld(landmark.position);
    if (!referenceWorld) {
      result.set(landmark.id, [wx, wy + PELVIS_HEIGHT, wz]);
      return;
    }
    const [refX, refY, refZ] = referenceWorld;
    result.set(landmark.id, [wx - refX, wy - refY + PELVIS_HEIGHT, wz - refZ]);
  });
  return result;
}
