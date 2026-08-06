export type Vec3 = [number, number, number];

export type ModelType = "landmarks" | "male" | "female";

export interface Segment {
  from: Vec3;
  to: Vec3;
}

export interface Landmark {
  id: string;
  label: string;
  position: Vec3;
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
