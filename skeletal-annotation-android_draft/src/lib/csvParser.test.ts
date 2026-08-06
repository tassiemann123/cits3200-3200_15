import { describe, expect, it } from "vitest";
import { parseCsv } from "./csvParser";

describe("parseCsv", () => {
  it("groups skeletons and connects numbered field landmarks", () => {
    const csv = `skeleton_id,joint_name,x,y,z\nBP1,1,1,3,2\nBP1,2,2,3,2\nBP2,1,5,7,6\n`;
    const result = parseCsv(csv);
    expect(result.layers).toHaveLength(2);
    expect(result.layers[0].segments).toHaveLength(1);
    expect(result.layers[0].landmarks[0].position).toEqual([1, 2, -3]);
  });

  it("reports missing columns", () => {
    expect(parseCsv("x,y,z\n1,2,3").warnings[0]).toContain("skeleton_id");
  });
});
