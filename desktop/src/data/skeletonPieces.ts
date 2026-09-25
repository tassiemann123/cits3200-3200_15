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
 * end. Where a piece has no natural second endpoint of its own, `from`
 * and `to` are the same landmark. The pelvis/coccyx is then just moved
 * there, borrowing rotation via `rigidWith` since it's rigidly fused to
 * the sacrum rather than free-floating. The skull is different again:
 * since `centre_of_head` was removed at the CFA's request, it has no
 * second landmark of its own any more, but it also isn't rigidly fused to
 * anything -- so instead it sets `offsetFromRatio` (see below), which
 * synthesises a second point for it to span from.
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
   * One landmark, or several averaged together, off the piece's main axis,
   * used to resolve the twist *around* that axis that a two-point aim
   * can't determine. Works for any piece with two distinct `from`/`to`
   * landmarks (not just "anchor" pieces) -- rotates the piece so its real,
   * modelled facing direction (assumed +Z in the model's own rest pose --
   * confirmed by inspecting the skull mesh directly) points from `from`
   * toward this landmark, or toward the averaged position of the listed
   * landmarks, instead of landing on an arbitrary twist.
   *
   * A single landmark only works as a twist reference if it genuinely
   * sits in front of (or behind) the piece rather than off to one side --
   * the skull's `chin` does. A bilateral pair like the two ASIS points
   * (`left_ilium_superior` / `right_ilium_superior`) does not: either one
   * alone is mostly a *sideways* offset from the spine axis, so using just
   * one would twist the piece to face off toward that side. Passing both
   * as an array averages them, cancelling the left/right offset and
   * leaving only the forward component -- giving a proper front-facing
   * reference the same way a single midline landmark would.
   */
  twist?: PointName | PointName[];
  /**
   * Which direction, in this piece's own untransformed rest-pose local
   * space, actually counts as "facing forward" for the twist correction
   * above. Defaults to +Z, which holds for every piece checked so far
   * (the skull, and now SK_Side too -- see the fix that corrected its
   * earlier, wrong -Z override, confirmed this time by actually rendering
   * a posed front and back view and checking the sternum landed on the
   * front one, not the shoulder blades). Kept as an override, not removed
   * outright, in case a future piece's own rest-pose front genuinely does
   * run the other way. Only meaningful alongside `twist`.
   */
  twistForward?: [number, number, number];
  /**
   * Another piece's nodeName this one is rigidly fused to and should
   * borrow the posed rotation and scale from, instead of computing its
   * own. Only meaningful for a single-landmark piece (`from === to`),
   * which otherwise defaults to the identity rotation regardless of how
   * the rest of the body is actually posed -- fine near the rest pose
   * (standing) but visibly wrong once the body is posed very differently
   * (lying down): the piece would keep facing its rest-pose direction
   * while everything physically attached to it has rotated. The coccyx is
   * fused to the sacrum end of SK_Side, not free-floating, so it should
   * rotate along with it rather than staying fixed. The referenced piece
   * must appear earlier in SKELETON_PIECES so it's already been posed.
   */
  rigidWith?: string;
  /**
   * For a piece with no second landmark of its own, but that ISN'T
   * rigidly fused to anything either (currently just the skull) --
   * synthesises the missing `from` point instead, so the piece still gets
   * a real two-point pose (direction, twist, and a sensible attachment
   * point) rather than defaulting to an identity rotation or needing its
   * own special-cased posing branch.
   *
   * The synthetic point sits this fraction of the body's entered
   * sacral_promontory-to-head_proximal length below `to` (head_proximal),
   * measured along the body's own current up direction -- so it scales
   * with stature and still works for a body recorded lying down, not just
   * standing. 0.143 was chosen to match the ratio the skull's old, real
   * `centre_of_head` landmark sat below `head_proximal` in the CFA's own
   * sample data, before it was removed: anchoring the skull's actual
   * bottom-most mesh vertices at that point (rather than pinning its
   * crown exactly to head_proximal, which is what a naive single-landmark
   * treatment does) is what leaves the neck visible below it, since the
   * skull mesh's own real height is otherwise easy to misjudge from its
   * raw geometry alone -- see the fix that introduced this field for the
   * full comparison against the old behaviour.
   */
  offsetFromRatio?: number;
}

export const SKELETON_PIECES: SkeletonPieceSpec[] = [
  { nodeName: "SK_Head", from: "head_proximal", to: "head_proximal", stretch: "anchor", twist: "chin", offsetFromRatio: 0.143 },
  { nodeName: "SK_Spine", from: "sacral_promontory", to: "head_proximal" },
  { nodeName: "SK_Side", from: "sacral_promontory", to: "manubrium", stretch: "uniform", twist: ["left_ilium_superior", "right_ilium_superior"] },
  { nodeName: "SK_Coccyx", from: "sacral_promontory", to: "sacral_promontory", rigidWith: "SK_Side" },

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
