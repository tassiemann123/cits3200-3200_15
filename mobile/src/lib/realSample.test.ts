import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRot } from "./rotParser";

describe("bundled LN24 field sample", () => {
  it("loads all 12 colour-coded individuals", () => {
    const source = readFileSync(new URL("../../public/samples/LN24-East-Colour.rot", import.meta.url), "utf8");
    const result = parseRot(source, "LN24-East-Colour.rot");
    const bodies = result.layers.filter((layer) => /^BP\d+$/.test(layer.name));
    expect(result.warnings).toEqual([]);
    expect(bodies).toHaveLength(12);
    expect(bodies.reduce((sum, layer) => sum + layer.segments.length, 0)).toBeGreaterThan(180);
    expect(new Set(bodies.map((layer) => layer.color)).size).toBeGreaterThan(8);
  });
});
