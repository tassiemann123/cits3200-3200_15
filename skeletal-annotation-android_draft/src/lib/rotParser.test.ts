import { describe, expect, it } from "vitest";
import { parseRot } from "./rotParser";

describe("parseRot", () => {
  it("parses XZY polylines, RGB colours and circle markers", () => {
    const result = parseRot(`# test\n# BP151 XZY\n1 2 3 -241 135 69\n1 2 3 0\n2 2 3 241 135 69\n3 2 3 241 135 69\n`);
    expect(result.warnings).toEqual([]);
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].name).toBe("BP151");
    expect(result.layers[0].color).toBe("#F18745");
    expect(result.layers[0].segments).toHaveLength(2);
    expect(result.layers[0].segments[0].from).toEqual([1, 2, -3]);
  });

  it("keeps grave geometry as a locked layer", () => {
    const result = parseRot(`# Fossa top outline\n0 1 2 0\n1 1 2 7\n`);
    expect(result.layers[0].name).toBe("Grave outline");
    expect(result.layers[0].locked).toBe(true);
  });
});
