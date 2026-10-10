/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG, 
 * RUAN VAN ZYL
 * 
 * File Function:
 * Converts the entered coordinates to three.js for the scene generation,
 * the CFA landmarks mapping is used in every live import/entry for 
 * cfaLandmarkToWorld and landmarksToDisplayPositions and some helpers 
 * throughout -- confirm the current mapping implementation before making
 * any modifications here
 */

import type { Landmark, Vec3 } from "../types";

/** LEGACY: Converts survey X/Z/Y ordering into a Three.js X/Y/Z world with 
 * elevation on Y meaning larger == higher up, directly an opposite to 
 * cfaLandmarkToWorld 
 */
export function surveyToWorld(x: number, z: number, y: number): Vec3 {
  return [x, z, -y];
}

/** Averages a set of points, gives [0,0,0] for empty lists */
export function centroid(points: Vec3[]): Vec3 {
  if (points.length === 0) return [0, 0, 0];
  const sum = points.reduce<Vec3>((acc, point) => [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]], [0, 0, 0]);
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}


/**
 * Converts an entered CFA landmark coordinate (from the mobile app's manual
 * X/Y/Z entry form) into Three.js world space [x, -z, y].
 *
 * The form's Z column is depth, recorded
 * as distance *down* from a fixed reference point -- not height off the
 * ground. So a larger Z means the point sits lower, and the sign has to
 * flip when it becomes the Three.js Y (up) coordinate. Without the
 * negation, the Z column was read as plain elevation, which inverted the
 * whole pose along its length (e.g. BP157 rendered with the pelvis as the
 * highest point and the head/feet low, instead of the pelvis being the
 * lowest point with the head and feet higher).
 *
 * X and Y keep behaving exactly as before -- only Z's sign changes. (An
 * earlier version of this fix also negated Y, to keep this mapping's
 * determinant the same as the original's. That turned out to be the
 * wrong place to fix that problem -- see the handedness-correction
 * comment in SceneViewport.tsx, next to the pelvis's orientationTriangle
 * calculation, for where it actually got fixed instead and why.)
 */
export function cfaLandmarkToWorld([x, y, z]: Vec3): Vec3 {
  return [x, -z, y];
}


/**
 * Pelvis landmarks tried, in order of preference, as a stand-in origin 
 * when sacral_promontory is absent.
 */
const PELVIS_REFERENCE_IDS = [
  "left_acetabulum", "right_acetabulum",
  "left_ilium_superior", "right_ilium_superior",
  "left_ischium", "right_ischium",
];

/**
 * The point each skeleton is recentred on. Normally the sacral promontory.
 * If that landmark is missing (e.g. the sacrum is marked not present), 
 * the skeleton used to be left at its raw entered coordinates,
 * so a record entered far from the origin (the usual survey-style values)
 * ended up off-screen or below the floor and the whole skeleton appeared to
 * vanish. Falling back to the centre of whichever pelvis landmarks exist
 * (or, failing that, the centre of everything entered) keeps the remaining
 * bones in view in exactly the same place relative to each other.
 */
function referenceWorldPosition(landmarks: Landmark[]): Vec3 | null {
  const sacral = landmarks.find((landmark) => landmark.id === "sacral_promontory")?.position;
  if (sacral) return cfaLandmarkToWorld(sacral);
  const pelvis = landmarks.filter((landmark) => PELVIS_REFERENCE_IDS.includes(landmark.id));
  const pool = pelvis.length > 0 ? pelvis : landmarks;
  if (pool.length === 0) return null;
  return centroid(pool.map((landmark) => cfaLandmarkToWorld(landmark.position)));
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
  const referenceWorld = referenceWorldPosition(landmarks);

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
