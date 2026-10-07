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
   * strong front/back identity of its own (the ribcage). -- anchors to 
   * the pieces `to` end not `from`
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
  *
  * For the same reason, a listed set is only used when *every* landmark
  * in it is present: with one side marked not present, the remaining
  * landmark alone would twist the piece toward that side (seen as the
  * torso turning to face the one remaining shoulder). If this set is
  * incomplete, `twistFallback` is tried instead; if neither is complete,
  * no twist is applied.
  */
  twist?: PointName | PointName[];
  /**
   * A second landmark pair to twist toward when `twist` isn't complete
   * (e.g. one arm marked not present). Like `twist`, it's only used when
   * every landmark in it is present -- see `twist` above for why.
   */
  twistFallback?: PointName[];
  /**
   * Which direction, in this piece's own untransformed rest-pose local
   * space, actually counts as "facing forward" for the twist correction
   * above. Defaults to +Z, which holds for the skull and for SK_Side (the
   * ribcage) -- confirmed for the latter by actually rendering a posed
   * front and back view and checking the sternum landed on the front one,
   * not the shoulder blades. The clavicle/scapula piece is the opposite:
   * its own rest-pose "front" (the scapula's flat face) runs along -Z, so
   * it overrides this to [0, 0, -1] -- without that override the scapula
   * twists to face the camera face-on instead of lying flush against the
   * ribcage's back, which is what was actually happening (see the fix
   * that added this override, confirmed the same way: rendering a posed
   * front and back view and checking the scapula all but disappears from
   * the front and shows properly from the back). Only meaningful
   * alongside `twist`; always verify a new value by actually rendering
   * both sides, not by eyeballing the raw mesh.
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
   * the terminal segment of the vertebral column itself (fused to the
   * sacrum, not to the ribcage), so it borrows SK_Spine's rotation rather
   * than SK_Side's -- rigging it to SK_Side instead left a visible kink
   * where the two met, since the ribcage's own from/to axis (sacral to
   * manubrium) doesn't point the same way as the spine's (sacral to
   * head_proximal), most noticeably once the two axes diverge a lot (a
   * lying-down pose). The referenced piece must appear earlier in
   * SKELETON_PIECES so it's already been posed.
   */
  /**
   * Which of a multi-bone joint's contributing bones this piece's `from`
   * (or `to`) endpoint actually represents, by label (matching
   * boneLabelsFor in cfaSchema.ts) -- e.g. the forearm piece's `from` at
   * the elbow is genuinely the forearm's own end, not the upper arm's,
   * even though they're both called "left_elbow". Without this, every
   * piece touching a shared joint would collapse onto that joint's first
   * entry, so two bones recorded as disarticulated (or one marked
   * missing) would never actually show as separated in the 3D view, only
   * in the exported data. Omitted for an ordinary single-bone landmark,
   * where there's only one entry to read anyway.
   */
  fromBone?: string;
  toBone?: string;
  rigidWith?: string;
  /**
   * The piece is only shown if at least one of these landmarks is present.
   * The pelvis hangs from sacral_promontory, which belongs to the "Head &
   * torso" group, not the pelvis groups, so marking both pelvis groups
   * "not present" left the pelvis drawn at the sacrum (rotation borrowed
   * from the spine) even though no pelvis data remained. Listing the pelvis
   * landmarks here hides it exactly when none of them are left, while still
   * allowing one side alone (the pelvis is one solid piece, so a single
   * side keeps it visible, oriented from whatever is available).
   */
  requiresAnyOf?: PointName[];
  /**
   * Independently orients a single-landmark piece (from === to) using
   * three of its own landmarks instead of borrowing another piece's
   * rotation via `rigidWith` -- currently only the pelvis, so it can
   * rotate on its own rather than cloning the spine's entire rotation
   * (both its lean *and* its twist), which previously meant even
   * something as unrelated as moving head_proximal dragged the pelvis
   * along with it.
   *
   * `left`/`right`/`anchor` name three real landmarks that, together,
   * pin down a full 3D orientation the same way the ISB's standard
   * pelvis coordinate system does in biomechanics: a line between the
   * two ASIS points (`left`/`right`) plus one more point off that line
   * (the sacral promontory, as `anchor`) is enough to build a complete,
   * unambiguous frame -- no mesh geometry required.
   *
   * `restLeft`/`restRight`/`restAnchor` are where those same three
   * landmarks sit on the bundled GLB mesh itself, relative to the sacral
   * promontory, in metres -- the same Blender vertex measurements as
   * REST_LANDMARKS below, and the same values the bundled lying-down
   * default (standard-skeleton-lying-coordinates.csv)
   * enters for them. The computed rotation is the identity exactly 
   * when the entered coordinates equal these, and rotates away from 
   * identity by however much the entered triangle differs from this 
   * rest triangle -- see computeTriangleQuaternion in skeletonPose.ts.
   *
   * Falls back to `rigidWith` (if given) whenever any of the three
   * landmarks is missing, or the triangle is degenerate (the anchor
   * landmark entered exactly on the left-right line), rather than
   * silently defaulting to an unrotated pelvis.
   */
  orientationTriangle?: {
    left: PointName;
    right: PointName;
    anchor: PointName;
    restLeft: [number, number, number];
    restRight: [number, number, number];
    restAnchor: [number, number, number];
  };
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
   * standing. A value of 0.276 is used, coming from:
   * (head_prox - chin)/(head_prox - sacral)
   * With the values being the landmark coordinates from the mesh directly
   * :anchoring the skull's jaw at chin height -- previous method used 
   * centre-of-head joint value that had been part of the original project csv
   * 
   * Modification to the value chosen for offset: The offset is now set as
   * 0.276 based on calculations from the mesh vertex coordinates checked directly
   */
  offsetFromRatio?: number;
  /**
   * For the scaling of the chest, an optional field for [minimum, maximum]
   * scaling bound numbers, which act as a multiplier for the bodyScale, with
   * the ribcage scale factor being clamped to that range.
   * The fields purpose is to avoid having unrealistically large chests visualised
   * for extreme data entries - a tall person does not necessarily have a larger 
   * chest than a shorter person in width and depth, scaling is within the body length
   * and some growth bounds.
   * The current employed values are for +- 15% but these are ballpark values I chose
   * for getting the feature implemented and further investigation into how the model
   * reacts may yield more accurate lower and upper bounds (not necessarily equal to 
   * one another).
   */
  scaleBounds?: [number, number];
}

export const SKELETON_PIECES: SkeletonPieceSpec[] = [
  { nodeName: "SK_Head", from: "head_proximal", to: "head_proximal", stretch: "anchor", twist: "chin", offsetFromRatio: 0.276 },
  { nodeName: "SK_Spine", from: "sacral_promontory", to: "head_proximal", twist: ["left_ilium_superior", "right_ilium_superior"], twistFallback: ["left_shoulder", "right_shoulder"] },
  { nodeName: "SK_Side", from: "sacral_promontory", to: "manubrium", toBone: "Sternum", stretch: "uniform", scaleBounds: [0.85, 1.15], twist: ["left_ilium_superior", "right_ilium_superior"], twistFallback: ["left_shoulder", "right_shoulder"] },
  {
    nodeName: "SK_Coccyx",
    from: "sacral_promontory",
    to: "sacral_promontory",
    rigidWith: "SK_Spine",
    requiresAnyOf: ["left_ilium_superior", "right_ilium_superior", "left_ischium", "right_ischium", "left_acetabulum", "right_acetabulum"],
    orientationTriangle: {
      left: "left_ilium_superior",
      right: "right_ilium_superior",
      anchor: "sacral_promontory",
      // [x = left, front, up] in the pelvis mesh's own frame (not raw CFA depth axes)
      restLeft: [0.126, 0.036, 0.047],
      restRight: [-0.126, 0.036, 0.047],
      restAnchor: [0, 0, 0],
    },
  },

  { nodeName: "SK_RClavicle", from: "right_shoulder", fromBone: "Clavicle (distal) / shoulder blade", to: "manubrium", toBone: "Right clavicle (proximal)", stretch: "anchor", twist: "head_proximal", twistForward: [0, 0, 1] },
  { nodeName: "SK_RArmUp", from: "right_shoulder", fromBone: "Upper arm (proximal)", to: "right_elbow", toBone: "Upper arm (distal)" },
  { nodeName: "SK_RArmDown", from: "right_elbow", fromBone: "Forearm (proximal)", to: "right_wrist", toBone: "Forearm (distal)" },
  { nodeName: "SK_HandR", from: "right_wrist", fromBone: "Hand", to: "right_fingertips", stretch: "anchor" },

  { nodeName: "SK_LClavicle", from: "left_shoulder", fromBone: "Clavicle (distal) / shoulder blade", to: "manubrium", toBone: "Left clavicle (proximal)", stretch: "anchor", twist: "head_proximal", twistForward: [0, 0, 1] },
  { nodeName: "SK_LArmUp", from: "left_shoulder", fromBone: "Upper arm (proximal)", to: "left_elbow", toBone: "Upper arm (distal)" },
  { nodeName: "SK_LArmDown", from: "left_elbow", fromBone: "Forearm (proximal)", to: "left_wrist", toBone: "Forearm (distal)" },
  { nodeName: "SK_HandL", from: "left_wrist", fromBone: "Hand", to: "left_fingertips", stretch: "anchor" },

  { nodeName: "SK_RLegUp", from: "right_acetabulum", fromBone: "Thigh (proximal)", to: "right_knee", toBone: "Thigh (distal)" },
  { nodeName: "SK_RLegDown", from: "right_knee", fromBone: "Shin (proximal)", to: "right_ankle", toBone: "Shin (distal)" },
  { nodeName: "SK_RFoot", from: "right_ankle", fromBone: "Foot", to: "right_toes", stretch: "anchor" },

  { nodeName: "SK_LLegUp", from: "left_acetabulum", fromBone: "Thigh (proximal)", to: "left_knee", toBone: "Thigh (distal)" },
  { nodeName: "SK_LLegDown", from: "left_knee", fromBone: "Shin (proximal)", to: "left_ankle", toBone: "Shin (distal)" },
  { nodeName: "SK_LFoot", from: "left_ankle", fromBone: "Foot", to: "left_toes", stretch: "anchor" },
];

/**
 * The mesh uses a different coordinate system than the visualiser and to assist in
 * the conversion of the values the global landmark coordinates of the joints on the
 * skeleton mesh being used were found using vertices on Blender.
 * The conversion takes (X, Y, Z) and converts to (X, Z, -Y)
 * The values are scaled as the GLB uses model units not a standard unit of measure --
 * see the globalScale in SceneViewport
 */
export const REST_LANDMARKS: Partial<Record<PointName, [number, number, number]>> = {
  head_proximal: [0, 3.32, 0],
  chin: [0, 2.92, 0.115],
  manubrium: [0, 2.74, 0.0279],
  sacral_promontory: [0, 1.87, -0.109],
};
