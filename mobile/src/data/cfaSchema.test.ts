import { describe, expect, it } from "vitest";
import { ALL_CFA_POINTS, CFA_GROUPS, groupForPoint, groupForBone } from "./cfaSchema";

describe("CFA coordinate schema", () => {
  it("contains 24 unique landmarks across nine anatomical groups", () => {
    expect(CFA_GROUPS).toHaveLength(9);
    expect(ALL_CFA_POINTS).toHaveLength(24);
    expect(new Set(ALL_CFA_POINTS).size).toBe(24);
  });

  it("maps points back to their anatomical group", () => {
    expect(groupForPoint("manubrium")).toBe("spine_ribcage");
    expect(groupForPoint("right_ankle")).toBe("right_leg");
    expect(groupForBone("manubrium", 0)).toBe("spine_ribcage");
    expect(groupForBone("manubrium", 1)).toBe("left_arm");
    expect(groupForBone("manubrium", 2)).toBe("right_arm");
  });
});
