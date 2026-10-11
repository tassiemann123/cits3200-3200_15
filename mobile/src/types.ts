/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG, 
 * RUAN VAN ZYL
 * 
 * Shared data types. The live app's model is SkeletonRecord (one entered
 * skeleton) grouped by WorkspaceGraveyard. SkeletonLayer, ProjectData,
 * ParseResult, Segment and ModelType belong to the earlier prototype's
 * import format and are only used by the legacy csvParser.ts / rotParser.ts
 * and the unused project functions in projectStorage.ts.
 */

import type { PointGroupId, PointName } from "./data/cfaSchema";

/** A position is stored as a vector in the form [x, y, z] -- CFA coordinates
 * or three.js scene depend usage depends on the context.
 */
export type Vec3 = [number, number, number];

/** CFA axes entered coordinates with [x, y, z] and z meaning depth, null empty 
 */
export type CoordinateDraft = [number | null, number | null, number | null];

/** The primary skeleton coordinates per landmark location -- see 
 * SkeletonRecord.coordinates 
 */
export type SkeletonCoordinates = Partial<Record<PointName, CoordinateDraft>>;

/** LEGACY type -- see header */
export type ModelType = "landmarks" | "male" | "female";

/** Model loading status -- used in SceneViewport */
export type ModelLoadState = "loading" | "ready" | "error";

export interface ViewerModel {
  name: string;
  url: string;
  origin: "bundled" | "imported";
  subtitle: string;
  attribution: string;
}

/** LEGACY -- prototype connection between points */
export interface Segment {
  from: Vec3;
  to: Vec3;
}

/** One entered landmark for display */
export interface Landmark {
  /** The landmark key (PointName or boneLandmarkID) */
  id: string;
  label: string;
  /** CFA coordinates */
  position: Vec3;
}

/** A skeleton entered in the app: its coordinates and identifiers */
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
  /** Whole groups marked as not present via the coordinate toggle */
  excludedGroups: PointGroupId[];
  notes: string;
  /** Graveyard that the record belongs to */
  graveyardId?: string;
  /** ID of the skeleton if/when synced to backend */
  backendId?: string;
  /** ISO timestamp of last complete backend sync */
  lastSyncedAt?: string;
}

/** LEGACY -- prototype import format -- see header */
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

/** LEGACY -- prototype import format -- see header */
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

/** LEGACY -- prototype import format -- see header */
export interface ParseResult {
  layers: SkeletonLayer[];
  warnings: string[];
}

/** Named site grouping of skeletons */
export interface WorkspaceGraveyard {
  id: string;
  name: string;
  backendId?: string;
  lastSyncedAt?: string;
}