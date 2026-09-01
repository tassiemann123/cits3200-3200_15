import type { PointName } from "./cfaSchema";

/**
 * Maps each named piece inside the bundled skeleton_pre-cut.glb onto the
 * pair of CFA landmarks that define where it should span.
 *
 * The model has no bone rig (confirmed by inspecting the GLB directly: no
 * `skins` array, and every node sits at an identity transform) -- it's cut
 * into 18 separate rigid pieces, each named after the body part it
 * represents. That means each piece can be positioned, rotated, and
 * stretched directly between its two landmarks instead of needing inverse
 * kinematics or a rig.
 *
 * `from` is the proximal (closer to the torso) end, `to` is the distal
 * end. Where a piece has no natural second endpoint (the pelvis), `from`
 * and `to` are the same landmark and the piece is just moved there rather
 * than stretched or rotated.
 */
export interface SkeletonPieceSpec {
  nodeName: string;
  from: PointName;
  to: PointName;
}

export const SKELETON_PIECES: SkeletonPieceSpec[] = [
  { nodeName: "SK_Head", from: "centre_of_head", to: "head_proximal" },
  { nodeName: "SK_Spine", from: "sacral_promontory", to: "manubrium" },
  { nodeName: "SK_Side", from: "sacral_promontory", to: "manubrium" },
  { nodeName: "SK_Coccyx", from: "sacral_promontory", to: "sacral_promontory" },

  { nodeName: "SK_RClavicle", from: "manubrium", to: "right_shoulder" },
  { nodeName: "SK_RArmUp", from: "right_shoulder", to: "right_elbow" },
  { nodeName: "SK_RArmDown", from: "right_elbow", to: "right_wrist" },
  { nodeName: "SK_HandR", from: "right_wrist", to: "right_fingertips" },

  { nodeName: "SK_LClavicle", from: "manubrium", to: "left_shoulder" },
  { nodeName: "SK_LArmUp", from: "left_shoulder", to: "left_elbow" },
  { nodeName: "SK_LArmDown", from: "left_elbow", to: "left_wrist" },
  { nodeName: "SK_HandL", from: "left_wrist", to: "left_fingertips" },

  { nodeName: "SK_RLegUp", from: "right_acetabulum", to: "right_knee" },
  { nodeName: "SK_RLegDown", from: "right_knee", to: "right_ankle" },
  { nodeName: "SK_RFoot", from: "right_ankle", to: "right_toes" },

  { nodeName: "SK_LLegUp", from: "left_acetabulum", to: "left_knee" },
  { nodeName: "SK_LLegDown", from: "left_knee", to: "left_ankle" },
  { nodeName: "SK_LFoot", from: "left_ankle", to: "left_toes" },
];
