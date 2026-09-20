import { describe, expect, it } from "vitest";
import type { SkeletonRecord } from "../types";
import { toBackendLandmarks } from "./backendCoordinates";

function record(overrides: Partial<SkeletonRecord> = {}): SkeletonRecord {
  return {
    id: "test-record",
    name: "Test skeleton",
    coordinates: {},
    excludedGroups: [],
    notes: "",
    ...overrides,
  };
}

describe("toBackendLandmarks", () => {
  it("returns only complete coordinate triples", () => {
    const output = toBackendLandmarks(record({
      coordinates: {
        head_proximal: [1.2, 2.3, 3.4],
        chin: [4.5, null, 6.7],
      },
    }));

    expect(output).toEqual([{
      id: "head_proximal",
      label: "Head Proximal",
      position: [1.2, 2.3, 3.4],
    }]);
  });

  it("omits coordinates in groups marked not present", () => {
    const output = toBackendLandmarks(record({
      coordinates: { left_elbow: [1, 2, 3] },
      excludedGroups: ["left_arm"],
    }));

    expect(output).toEqual([]);
  });
});
