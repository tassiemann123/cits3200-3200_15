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