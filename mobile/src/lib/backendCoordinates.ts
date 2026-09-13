import { ALL_CFA_POINTS, groupForPoint, pointLabel } from "../data/cfaSchema";
import type { Landmark, SkeletonRecord } from "../types";

export function toBackendLandmarks(record: SkeletonRecord): Landmark[] {
  return ALL_CFA_POINTS.flatMap((point) => {
    const coordinate = record.coordinates[point];
    if (record.excludedGroups.includes(groupForPoint(point)) || !coordinate) return [];
    if (!coordinate.every((value) => value !== null && Number.isFinite(value))) return [];
    return [{
      id: point,
      label: pointLabel(point),
      position: [coordinate[0] as number, coordinate[1] as number, coordinate[2] as number],
    }];
  });
}
