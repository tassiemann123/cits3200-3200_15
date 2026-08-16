// The 25 official CFA (Centre for Forensic Anthropology) coordinate points,
// grouped exactly like the client's paper recording form. This is the
// single source of truth for the coordinate entry UI - if the schema ever
// changes, update it here only.

export type PointName =
  | 'head_proximal' | 'centre_of_head' | 'chin' | 'manubrium' | 'sacral_promontory'
  | 'left_shoulder' | 'left_elbow' | 'left_wrist' | 'left_fingertips'
  | 'left_ilium_superior' | 'left_ischium' | 'left_acetabulum'
  | 'left_knee' | 'left_ankle' | 'left_toes'
  | 'right_shoulder' | 'right_elbow' | 'right_wrist' | 'right_fingertips'
  | 'right_ilium_superior' | 'right_ischium' | 'right_acetabulum'
  | 'right_knee' | 'right_ankle' | 'right_toes';

export interface PointGroup {
  label: string;
  points: PointName[];
}

export const CFA_GROUPS: PointGroup[] = [
  { label: 'Head / torso', points: ['head_proximal', 'centre_of_head', 'chin', 'manubrium', 'sacral_promontory'] },
  { label: 'Left arm', points: ['left_shoulder', 'left_elbow', 'left_wrist', 'left_fingertips'] },
  { label: 'Left pelvis', points: ['left_ilium_superior', 'left_ischium', 'left_acetabulum'] },
  { label: 'Left leg', points: ['left_knee', 'left_ankle', 'left_toes'] },
  { label: 'Right arm', points: ['right_shoulder', 'right_elbow', 'right_wrist', 'right_fingertips'] },
  { label: 'Right pelvis', points: ['right_ilium_superior', 'right_ischium', 'right_acetabulum'] },
  { label: 'Right leg', points: ['right_knee', 'right_ankle', 'right_toes'] },
];

export function pointLabel(name: PointName): string {
  return name.replace(/_/g, ' ');
}