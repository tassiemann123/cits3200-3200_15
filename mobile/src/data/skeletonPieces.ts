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
  /**
   * "rod" (default) stretches the piece along its single long axis and
   * rotates it to point between the two landmarks -- right for an actual
   * long bone (upper arm, forearm, thigh, shin, spine), which reads fine
   * stretched or twisted since it's roughly round and has no particular
   * "facing" direction.
   *
   * "uniform" resizes the piece evenly in all directions instead of
   * stretching one axis, but still rotates it to point between the
   * landmarks -- for a piece that's a chunky, rounded shape but has no
   * strong front/back identity of its own (the ribcage).
   *
   * "anchor" also resizes evenly, but skips rotation entirely and keeps
   * whatever direction the piece was actually modelled facing -- for a
   * piece with a real facing direction (a skull, the clavicle/shoulder-
   * blade piece, a hand, a foot), where rotating it to point between two
   * landmarks only pins down two of its three rotation axes and leaves it
   * twisted an arbitrary, often visibly wrong way around the third.
   */
  stretch?: "rod" | "uniform" | "anchor";
  /**
   * A third landmark, off the piece's main axis, used to resolve the twist
   * *around* that axis that a two-point aim can't determine (see the
   * "anchor" note above -- this is what actually fixes that ambiguity for
   * pieces that have one). Only meaningful alongside "anchor": rotates the
   * piece so its real, modelled facing direction (assumed +Z in the
   * model's own rest pose -- confirmed by inspecting the skull mesh
   * directly) points from `from` toward this landmark, instead of landing
   * on an arbitrary twist. Currently only the skull uses this (`chin`),
   * turning the head to face where the chin is actually recorded instead
   * of always facing forward.
   */
  twist?: PointName;
}

export const SKELETON_PIECES: SkeletonPieceSpec[] = [
  { nodeName: "SK_Head", from: "centre_of_head", to: "head_proximal", stretch: "anchor", twist: "chin" },
  { nodeName: "SK_Spine", from: "sacral_promontory", to: "head_proximal" },
  { nodeName: "SK_Side", from: "sacral_promontory", to: "manubrium", stretch: "uniform" },
  { nodeName: "SK_Coccyx", from: "sacral_promontory", to: "sacral_promontory" },

  { nodeName: "SK_RClavicle", from: "manubrium", to: "right_shoulder", stretch: "anchor" },
  { nodeName: "SK_RArmUp", from: "right_shoulder", to: "right_elbow" },
  { nodeName: "SK_RArmDown", from: "right_elbow", to: "right_wrist" },
  { nodeName: "SK_HandR", from: "right_wrist", to: "right_fingertips", stretch: "anchor" },

  { nodeName: "SK_LClavicle", from: "manubrium", to: "left_shoulder", stretch: "anchor" },
  { nodeName: "SK_LArmUp", from: "left_shoulder", to: "left_elbow" },
  { nodeName: "SK_LArmDown", from: "left_elbow", to: "left_wrist" },
  { nodeName: "SK_HandL", from: "left_wrist", to: "left_fingertips", stretch: "anchor" },

  { nodeName: "SK_RLegUp", from: "right_acetabulum", to: "right_knee" },
  { nodeName: "SK_RLegDown", from: "right_knee", to: "right_ankle" },
  { nodeName: "SK_RFoot", from: "right_ankle", to: "right_toes", stretch: "anchor" },

  { nodeName: "SK_LLegUp", from: "left_acetabulum", to: "left_knee" },
  { nodeName: "SK_LLegDown", from: "left_knee", to: "left_ankle" },
  { nodeName: "SK_LFoot", from: "left_ankle", to: "left_toes", stretch: "anchor" },
];
