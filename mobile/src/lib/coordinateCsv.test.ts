import { describe, expect, it } from "vitest";
import type { SkeletonRecord } from "../types";
import { parseCoordinateCsv, serialiseCoordinateCsv } from "./coordinateCsv";

function record(overrides: Partial<SkeletonRecord> = {}): SkeletonRecord {
  return {
    id: "record-1",
    name: "Skeleton, A",
    coordinates: {},
    excludedGroups: [],
    notes: "",
    ...overrides,
  };
}

describe("coordinate CSV transfer", () => {
  it("exports only complete, present coordinates with backend headers", () => {
    const csv = serialiseCoordinateCsv(record({
      coordinates: {
        centre_of_head: [1.25, 2, -3],
        chin: [4, null, 6],
        left_shoulder: [7, 8, 9],
      },
      excludedGroups: ["left_arm"],
    }));

    expect(csv).toBe(
      "skeleton_id,joint_name,x,y,z\r\n\"Skeleton, A\",centre_of_head,1.25,2,-3\r\n",
    );
  });

  it("round-trips exported coordinates", () => {
    const original = record({ coordinates: { head_proximal: [1, 2, 3], right_toes: [-4, 5.5, 6] } });
    const result = parseCoordinateCsv(serialiseCoordinateCsv(original));

    expect(result.warnings).toEqual([]);
    expect(result.records).toEqual([{
      name: "Skeleton, A",
      coordinates: { head_proximal: [1, 2, 3], right_toes: [-4, 5.5, 6] },
    }]);
  });

  it("accepts display labels and reports invalid rows", () => {
    const result = parseCoordinateCsv(
      "skeleton_id,joint_name,x,y,z\nBP1,Centre Of Head,1,2,3\nBP1,Unknown,4,5,6\nBP1,Chin,,8,9\n",
    );

    expect(result.records[0].coordinates.centre_of_head).toEqual([1, 2, 3]);
    expect(result.warnings).toHaveLength(2);
  });
});
