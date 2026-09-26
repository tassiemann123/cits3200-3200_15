import type { PointGroupId, PointName } from "./data/cfaSchema";

export type Vec3 = [number, number, number];

export type CoordinateDraft = [number | null, number | null, number | null];

export type SkeletonCoordinates = Partial<Record<PointName, CoordinateDraft>>;

export type ModelType = "landmarks" | "male" | "female";

export type ModelLoadState = "loading" | "ready" | "error";

export interface ViewerModel {
  name: string;
  url: string;
  origin: "bundled" | "imported";
  subtitle: string;
  attribution: string;
}

export interface Segment {
  from: Vec3;
  to: Vec3;
}

export interface Landmark {
  id: string;
  label: string;
  position: Vec3;
}

export interface SkeletonRecord {
  id: string;
  name: string;
  /**
   * Primary coordinate per landmark. For an ordinary single-bone point
   * this is the only coordinate. For a multi-bone joint (see
   * boneLabelsFor in cfaSchema.ts) this is specifically the FIRST
   * contributing bone -- the 3D view and everything else that only ever
   * needs "the" position of a joint keeps reading this field exactly as
   * before, unchanged by the multi-bone feature.
   */
  coordinates: SkeletonCoordinates;
  /**
   * Coordinates for a multi-bone joint's remaining contributing bones
   * (index 0 = second bone, index 1 = third bone, for the one 3-bone
   * joint). Only present once a bone has actually been expanded and
   * edited independently -- until then it's treated as identical to the
   * primary coordinate in `coordinates` above, matching how the CFA
   * described the UI auto-duplicating the first entry.
   */
  extraBoneCoordinates?: Partial<Record<PointName, CoordinateDraft[]>>;
  /**
   * Bones explicitly marked "not present" at a multi-bone joint, keyed as
   * `${point}:${boneIndex}` (boneIndex 0-based across all contributing
   * bones, so the primary bone is index 0). This is deliberately separate
   * from excludedGroups, which marks a whole anatomical region absent --
   * this instead flags a single bone missing at one joint, e.g. a
   * disarticulated shoulder where only the clavicle was recovered.
   */
  excludedBones?: string[];
  excludedGroups: PointGroupId[];
  notes: string;
  graveyardId?: string;
  backendId?: string;
  lastSyncedAt?: string;
}

export interface SkeletonLayer {
  id: string;
  name: string;
  sourceName: string;
  color: string;
  visible: boolean;
  locked: boolean;
  modelType: ModelType;
  segments: Segment[];
  landmarks: Landmark[];
  notes: string;
}

export interface ProjectData {
  version: 1;
  name: string;
  createdAt: string;
  updatedAt: string;
  layers: SkeletonLayer[];
  camera?: {
    position: Vec3;
    target: Vec3;
  };
}

export interface ParseResult {
  layers: SkeletonLayer[];
  warnings: string[];
}

export interface WorkspaceGraveyard {
  id: string;
  name: string;
  backendId?: string;
  lastSyncedAt?: string;
}