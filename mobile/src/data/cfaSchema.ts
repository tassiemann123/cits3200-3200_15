export const CFA_GROUPS = [
  {
    id: "head_torso",
    label: "Head & torso",
    points: ["head_proximal", "centre_of_head", "chin", "manubrium", "sacral_promontory"],
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
