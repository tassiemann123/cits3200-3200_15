import { describe, expect, it } from "vitest";
import type { BackendSkeleton } from "./backendApi";
import { backendSkeletonToRecord, recordToCoordinatePayloads } from "./backendApi";

describe("backend API mapping", () => {
  it("maps complete, present coordinates to Ivy's API schema", () => {
    expect(recordToCoordinatePayloads({
      id: "local-1",
      name: "Skeleton 1",
      coordinates: {
        centre_of_head: [1.2, 2.3, 3.4],
        chin: [4.5, null, 6.7],
        left_elbow: [7.8, 8.9, 9.1],
      },
      excludedGroups: ["left_arm"],
      notes: "",
    })).toEqual([{
      joint_name: "centre_of_head",
      x: 1.2,
      y: 2.3,
      z: 3.4,
    }]);
  });

  it("maps a backend skeleton into an editable local record", () => {
    const skeleton: BackendSkeleton = {
      skeleton_id: "backend-1",
      graveyard_id: "graveyard-1",
      name: "Remote skeleton",
      description: "Remote notes",
      pos_x: null,
      pos_y: null,
      pos_z: null,
      created_at: "2026-08-27T00:00:00Z",
      updated_at: "2026-08-27T00:00:00Z",
      coordinates: [{
        coordinate_id: "coordinate-1",
        skeleton_id: "backend-1",
        joint_name: "chin",
        x: 1,
        y: 2,
        z: 3,
      }],
    };

    const record = backendSkeletonToRecord(skeleton);
    expect(record.name).toBe("Remote skeleton");
    expect(record.notes).toBe("Remote notes");
    expect(record.backendId).toBe("backend-1");
    expect(record.coordinates.chin).toEqual([1, 2, 3]);
  });
});
