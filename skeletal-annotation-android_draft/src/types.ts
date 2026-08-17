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
  coordinates: SkeletonCoordinates;
  excludedGroups: PointGroupId[];
  notes: string;
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
