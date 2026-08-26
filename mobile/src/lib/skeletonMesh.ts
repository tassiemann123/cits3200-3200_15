import type { Vec3, Landmark, Segment } from "../types";
import type { PointName } from "../data/cfaSchema";
import { surveyToWorld } from "./coordinates";
import { ALL_CFA_POINTS } from "../data/cfaSchema";
import type { Vec3, Landmark, Segment, SkeletonCoordinates } from "../types";


export const boneMap: [PointName, PointName][] = [
  ["head_proximal", "centre_of_head"],
  ["centre_of_head", "chin"],
  ["centre_of_head", "manubrium"],
  ["manubrium", "left_shoulder"],
  ["manubrium", "right_shoulder"],
  ["manubrium", "sacral_promontory"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["left_wrist", "left_fingertips"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["right_wrist", "right_fingertips"],
  ["sacral_promontory", "left_ilium_superior"],
  ["sacral_promontory", "right_ilium_superior"],
  ["left_ilium_superior", "left_acetabulum"],
  ["left_acetabulum", "left_ischium"],
  ["left_acetabulum", "left_knee"],
  ["left_knee", "left_ankle"],
  ["left_ankle", "left_toes"],
  ["right_ilium_superior", "right_acetabulum"],
  ["right_acetabulum", "right_ischium"],
  ["right_acetabulum", "right_knee"],
  ["right_knee", "right_ankle"],
  ["right_ankle", "right_toes"],
];


// PLACEHOLDER values — pending Ruan's confirmed measurements.
// Survey order (x, z, y), y = height above the manubrium origin, in millimetres.
export const defaultSurveyCoordinates: Partial<Record<PointName, Vec3>> = {
  manubrium:            [0, 0, 0],
  head_proximal:        [0, 0, 311],
  centre_of_head:       [0, 0, 194],
  chin:                 [0, 30, 194],
  sacral_promontory:    [0, 0, -400],
  left_shoulder:        [-120, 0, 20],
  left_elbow:           [-220, 0, -300],
  left_wrist:           [-260, 0, -560],
  left_fingertips:      [-280, 0, -762],
  right_shoulder:       [120, 0, 20],
  right_elbow:          [220, 0, -300],
  right_wrist:          [260, 0, -562],
  right_fingertips:     [280, 0, -762],
  left_ilium_superior:  [-140, 0, -420],
  left_acetabulum:      [-100, 0, -450],
  left_ischium:         [-110, 0, -500],
  left_knee:            [-110, 0, -882],
  left_ankle:           [-110, 0, -1288],
  left_toes:            [-110, 100, -1554],
  right_ilium_superior: [140, 0, -420],
  right_acetabulum:     [100, 0, -450],
  right_ischium:        [110, 0, -500],
  right_knee:           [110, 0, -882],
  right_ankle:          [110, 0, -1288],
  right_toes:           [110, 100, -1554],
};



function toWorldCoordinates(
  survey: Partial<Record<PointName, Vec3>>,
): Partial<Record<PointName, Vec3>> {
  const world: Partial<Record<PointName, Vec3>> = {};
  for (const point of ALL_CFA_POINTS) {
    const coord = survey[point];
    if (!coord) continue;
    const [x, z, y] = coord;
    world[point] = surveyToWorld(x, z, y);
  }
  return world;
}


import { pointLabel } from "../data/cfaSchema";

export function buildLandmarksAndSegments(
  coordinates: Partial<Record<PointName, Vec3>>,
): { landmarks: Landmark[]; segments: Segment[] } {
  const world = toWorldCoordinates(coordinates);

  const landmarks: Landmark[] = ALL_CFA_POINTS.filter((point) => world[point]).map((point) => ({
    id: point,
    label: pointLabel(point),
    position: world[point]!,
  }));

  const segments: Segment[] = [];
  for (const [fromPoint, toPoint] of boneMap) {
    const from = world[fromPoint];
    const to = world[toPoint];
    if (!from || !to) continue;
    segments.push({ from, to });
  }

  return { landmarks, segments };
}


export function fromSkeletonCoordinates(
  coords: SkeletonCoordinates,
): Partial<Record<PointName, Vec3>> {
  const result: Partial<Record<PointName, Vec3>> = {};
  for (const point of ALL_CFA_POINTS) {
    const draft = coords[point];
    if (!draft) continue;
    const [x, y, z] = draft;
    if (x === null || y === null || z === null) continue;
    result[point] = [x, y, z];
  }
  return result;
}