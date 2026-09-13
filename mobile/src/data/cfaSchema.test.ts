import { describe, expect, it } from "vitest";
import { ALL_CFA_POINTS, CFA_GROUPS, groupForPoint } from "./cfaSchema";

describe("CFA coordinate schema", () => {
  it("contains 25 unique landmarks across seven anatomical groups", () => {
    expect(CFA_GROUPS).toHaveLength(7);
    expect(ALL_CFA_POINTS).toHaveLength(25);
    expect(new Set(ALL_CFA_POINTS).size).toBe(25);
  });

  it("maps points back to their anatomical group", () => {
    expect(groupForPoint("manubrium")).toBe("head_torso");
    expect(groupForPoint("right_ankle")).toBe("right_leg");
  });
});
