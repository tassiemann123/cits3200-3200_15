import type { PointName } from './data/cfaSchema';

// XYZ coordinate for a single point, or null if not yet entered.
export type Coord = [number, number, number] | null;

// All 25 CFA points for one skeleton.
export type SkeletonCoordinates = Partial<Record<PointName, Coord>>;

// One "project" = one skeleton being recorded, matching the client's
// mental model of one individual per record.
export interface Project {
  id: string;
  name: string;
  coordinates: SkeletonCoordinates;
  // Group labels (e.g. "Left arm") the user has toggled OFF, meaning
  // that body part is genuinely absent from this skeleton (not just
  // "not yet measured" - a distinct, intentional exclusion).
  excludedGroups: string[];
}