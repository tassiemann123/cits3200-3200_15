import { ALL_CFA_POINTS, boneLabelsFor, boneLandmarkId, groupForBone, parseBoneLandmarkId, pointLabel, type PointName } from "../data/cfaSchema";
import type { CoordinateDraft, Landmark, SkeletonRecord } from "../types";

/**
 * The backend's joint_name column is just free text, so a multi-bone
 * joint's extra bones are encoded into it with boneLandmarkId (see
 * cfaSchema.ts) -- the same id scheme the 3D posing code uses, so a
 * skeleton piece and a synced backend coordinate always agree on what
 * "this bone's own position" means. Bone 0 is always the plain,
 * unsuffixed point name, exactly as before this feature existed, so any
 * skeleton synced before multi-bone joints existed keeps loading
 * correctly, and the backend itself needs no changes.
 */
export const backendJointName = boneLandmarkId;
export const parseBackendJointName = parseBoneLandmarkId;

function coordinateFor(record: SkeletonRecord, point: PointName, boneIndex: number): CoordinateDraft | undefined {
  if (boneIndex === 0) return record.coordinates[point];
  return record.extraBoneCoordinates?.[point]?.[boneIndex - 1] ?? record.coordinates[point];
}

export function toBackendLandmarks(record: SkeletonRecord): Landmark[] {
  return ALL_CFA_POINTS.flatMap((point) => {
    const boneLabels = boneLabelsFor(point);

    if (!boneLabels) {
      if (record.excludedGroups.includes(groupForBone(point, 0))) return [];
      const coordinate = record.coordinates[point];
      if (!coordinate?.every((value) => value !== null && Number.isFinite(value))) return [];
      return [{
        id: point,
        label: pointLabel(point),
        position: [coordinate[0] as number, coordinate[1] as number, coordinate[2] as number],
      }];
    }

    // Each bone's OWN group governs it here (almost always the joint's
    // own group, except left/right_acetabulum's "Thigh (proximal)" bone
    // -- see groupForBone) -- so marking the pelvis not present doesn't
    // also discard the thigh's own attachment coordinate as a side effect.
    return boneLabels.flatMap((boneLabel, boneIndex) => {
      if (record.excludedGroups.includes(groupForBone(point, boneIndex))) return [];
      if ((record.excludedBones ?? []).includes(`${point}:${boneIndex}`)) return [];
      const coordinate = coordinateFor(record, point, boneIndex);
      if (!coordinate?.every((value) => value !== null && Number.isFinite(value))) return [];
      return [{
        id: backendJointName(point, boneIndex),
        label: `${pointLabel(point)} · ${boneLabel}`,
        position: [coordinate[0] as number, coordinate[1] as number, coordinate[2] as number],
      }];
    });
  });
}
