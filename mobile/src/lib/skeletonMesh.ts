import type { Vec3, Landmark, Segment } from "../types";
import type { PointName } from "../data/cfaSchema";


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