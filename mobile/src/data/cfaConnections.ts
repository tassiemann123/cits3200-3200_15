import type { PointName } from "./cfaSchema";

/**
 * Which CFA landmarks are drawn as connected "bones" in the 3D on-site check.
 * This is a first pass based on the point names -- please have someone with
 * anatomical knowledge (Dr Flavel or a teammate) confirm these chains before
 * relying on them for real fieldwork.
 */
export const CFA_CONNECTIONS: Array<[PointName, PointName]> = [
  // Head & torso (spine)
  ["head_proximal", "centre_of_head"],
  ["centre_of_head", "chin"],
  ["centre_of_head", "manubrium"],
  ["manubrium", "sacral_promontory"],

  // Left arm
  ["manubrium", "left_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["left_wrist", "left_fingertips"],

  // Right arm
  ["manubrium", "right_shoulder"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["right_wrist", "right_fingertips"],

  // Left pelvis + leg -- sequential order per the CFA Field Recording
  // Booklet's "Coordinates surveyed" table (ilium superior, ischium,
  // acetabulum, knee, ankle, toes listed in that order).
  ["sacral_promontory", "left_ilium_superior"],
  ["left_ilium_superior", "left_ischium"],
  ["left_ischium", "left_acetabulum"],
  ["left_acetabulum", "left_knee"],
  ["left_knee", "left_ankle"],
  ["left_ankle", "left_toes"],

  // Right pelvis + leg
  ["sacral_promontory", "right_ilium_superior"],
  ["right_ilium_superior", "right_ischium"],
  ["right_ischium", "right_acetabulum"],
  ["right_acetabulum", "right_knee"],
  ["right_knee", "right_ankle"],
  ["right_ankle", "right_toes"],
];
