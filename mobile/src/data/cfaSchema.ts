export const CFA_GROUPS = [
  {
    id: "head_torso",
    label: "Head & torso",
    points: ["head_proximal", "chin", "manubrium", "sacral_promontory"],
  },
  {
    id: "left_arm",
    label: "Left arm",
    points: ["left_shoulder", "left_elbow", "left_wrist", "left_fingertips"],
  },
  {
    id: "left_pelvis",
    label: "Left pelvis",
    points: ["left_ilium_superior", "left_ischium", "left_acetabulum"],
  },
  {
    id: "left_leg",
    label: "Left leg",
    points: ["left_knee", "left_ankle", "left_toes"],
  },
  {
    id: "right_arm",
    label: "Right arm",
    points: ["right_shoulder", "right_elbow", "right_wrist", "right_fingertips"],
  },
  {
    id: "right_pelvis",
    label: "Right pelvis",
    points: ["right_ilium_superior", "right_ischium", "right_acetabulum"],
  },
  {
    id: "right_leg",
    label: "Right leg",
    points: ["right_knee", "right_ankle", "right_toes"],
  },
] as const;

export type PointGroupId = (typeof CFA_GROUPS)[number]["id"];
export type PointName = (typeof CFA_GROUPS)[number]["points"][number];

export const ALL_CFA_POINTS = CFA_GROUPS.flatMap((group) => group.points) as PointName[];

export function pointLabel(point: PointName): string {
  return point
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function groupForPoint(point: PointName): PointGroupId {
  return CFA_GROUPS.find((group) => (group.points as readonly PointName[]).includes(point))?.id ?? "head_torso";
}

/**
 * Which non-terminal joints get more than one coordinate slot, one per
 * contributing bone, per Dr Flavel's request: a single shared coordinate
 * per joint can't tell a genuinely missing bone apart from one nobody's
 * entered yet, and can't record a disarticulated joint where the two
 * bones have actually drifted to different real-world positions.
 *
 * This is a first pass based on standard adult osteology, not yet
 * confirmed by the team or the client -- please have someone with
 * anatomical knowledge check it before relying on it for real fieldwork
 * (same caveat as CFA_CONNECTIONS above).
 *
 * Deliberately excluded (kept as a single coordinate):
 * - head_proximal, chin, left/right_fingertips, left/right_toes: terminal
 *   points on a single bone, not a junction between two bones.
 * - sacral_promontory: despite sitting where the connection lines drawn
 *   in CFA_CONNECTIONS fan out to both hips, this is a landmark on the
 *   sacrum itself (where it meets the lumbar spine above), not the
 *   sacroiliac joints -- those sit elsewhere on the sacrum entirely, so
 *   there's no second/third bone actually touching this exact point.
 * - left/right_ilium_superior, left/right_ischium: landmarks on the
 *   pelvis's own single fused hip bone (ilium + ischium + pubis are one
 *   bone in an adult), not a junction with a different bone. The hip
 *   bone's actual joint with the femur is left/right_acetabulum instead.
 *
 * manubrium is the one 3-bone case: both collarbones attach directly to
 * the manubrium itself (the sternoclavicular joints), one on each side,
 * so the sternum and both clavicles genuinely meet at this one point.
 * Every other included joint is an ordinary 2-bone junction.
 */
export const POINT_BONE_LABELS: Partial<Record<PointName, string[]>> = {
  manubrium: ["Sternum", "Left clavicle (proximal)", "Right clavicle (proximal)"],
  left_shoulder: ["Clavicle (distal) / shoulder blade", "Upper arm (proximal)"],
  right_shoulder: ["Clavicle (distal) / shoulder blade", "Upper arm (proximal)"],
  left_elbow: ["Upper arm (distal)", "Forearm (proximal)"],
  right_elbow: ["Upper arm (distal)", "Forearm (proximal)"],
  left_wrist: ["Forearm (distal)", "Hand"],
  right_wrist: ["Forearm (distal)", "Hand"],
  left_acetabulum: ["Pelvis", "Thigh (proximal)"],
  right_acetabulum: ["Pelvis", "Thigh (proximal)"],
  left_knee: ["Thigh (distal)", "Shin (proximal)"],
  right_knee: ["Thigh (distal)", "Shin (proximal)"],
  left_ankle: ["Shin (distal)", "Foot"],
  right_ankle: ["Shin (distal)", "Foot"],
};

/** Bone labels for a joint, or undefined for an ordinary single-coordinate point. */
export function boneLabelsFor(point: PointName): string[] | undefined {
  return POINT_BONE_LABELS[point];
}

/** How many coordinate slots a joint has: 1 for an ordinary point, 2 or 3 for a multi-bone joint. */
export function boneCountFor(point: PointName): number {
  return POINT_BONE_LABELS[point]?.length ?? 1;
}

/**
 * Overrides which group's presence toggle actually governs one specific
 * bone at a multi-bone joint, for the one case where a bone doesn't
 * belong to the same body part as the joint it's displayed under.
 *
 * Every other multi-bone joint's bones are both genuinely part of the
 * same limb as each other (an elbow's upper-arm and forearm ends, a
 * wrist's forearm and hand, a knee's thigh and shin), so marking that
 * whole joint -- or the group it lives in -- "not present" correctly
 * takes both bones with it. left/right_acetabulum is different: it's
 * displayed under the pelvis group (it's the hip socket, entered
 * alongside the other pelvis landmarks), but its "Thigh (proximal)" bone
 * is the femur's own end, not the hip bone's -- marking the pelvis absent
 * doesn't mean the thigh is missing too, any more than marking the thigh
 * absent would mean the pelvis is. Without this override, toggling the
 * whole pelvis group "not present" silently discarded the thigh's own
 * attachment coordinate as a side effect, hiding the entire femur in the
 * 3D view even though it was never itself marked absent -- see the fix
 * that added this for the full symptom (reported as "marking pelvis not
 * present makes the thigh disappear, which doesn't make sense").
 */
const BONE_GROUP_OVERRIDES: Partial<Record<PointName, Partial<Record<number, PointGroupId>>>> = {
  left_acetabulum: { 1: "left_leg" },
  right_acetabulum: { 1: "right_leg" },
};

/** Which group's presence toggle governs a specific bone at a joint -- see BONE_GROUP_OVERRIDES. */
export function groupForBone(point: PointName, boneIndex: number): PointGroupId {
  return BONE_GROUP_OVERRIDES[point]?.[boneIndex] ?? groupForPoint(point);
}

/**
 * Encodes a specific contributing bone's coordinate into a single string
 * id -- bone 0 (the joint's primary/first-listed bone) is just the plain
 * point name, unsuffixed, so anything already reading a joint by its
 * plain name (an older saved skeleton, a CSV without a bone column, a
 * single-bone point that never had this feature) keeps working exactly
 * as before. Shared by the backend sync payloads (backendCoordinates.ts)
 * and the 3D posing code (skeletonPieces.ts / SceneViewport.tsx), so both
 * agree on one scheme instead of each inventing their own.
 */
const BONE_ID_SUFFIX = "__bone";

export function boneLandmarkId(point: PointName, boneIndex: number): string {
  return boneIndex === 0 ? point : `${point}${BONE_ID_SUFFIX}${boneIndex + 1}`;
}

/** Reverses boneLandmarkId. Returns the base point and bone index (0 for an ordinary/primary id). */
export function parseBoneLandmarkId(id: string): { point: string; boneIndex: number } {
  const match = id.match(new RegExp(`^(.+)${BONE_ID_SUFFIX}(\\d+)$`));
  if (!match) return { point: id, boneIndex: 0 };
  return { point: match[1], boneIndex: Number(match[2]) - 1 };
}

/**
 * Resolves which landmark id a skeleton piece should actually read for one
 * of its two endpoints. Most pieces just want the joint's plain position
 * (boneLabel omitted). A piece that represents one specific bone at a
 * multi-bone joint (say, the forearm piece's end at the elbow, as opposed
 * to the upper-arm piece's end at that same elbow) names that bone via
 * boneLabel, so the two pieces read their own bone's entered position
 * instead of both collapsing onto the joint's first entry -- which is
 * what makes a disarticulated joint actually show a gap in the 3D view
 * instead of only being recorded in the data. Falls back to the plain
 * point if the label doesn't match (defensive, shouldn't happen with a
 * correctly-written piece list).
 */
export function pieceLandmarkId(point: PointName, boneLabel?: string): string {
  if (!boneLabel) return point;
  const index = POINT_BONE_LABELS[point]?.indexOf(boneLabel) ?? -1;
  return index >= 0 ? boneLandmarkId(point, index) : point;
}
