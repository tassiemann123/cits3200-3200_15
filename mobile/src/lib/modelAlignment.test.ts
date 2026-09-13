import { describe, expect, it } from "vitest";
import type { Landmark, Vec3 } from "../types";
import { calculateModelAlignment } from "./modelAlignment";

function landmark(label: string, position: Vec3): Landmark {
  return { id: label, label, position };
}

describe("calculateModelAlignment", () => {
  it("uses the measured diagonal span and points the model head toward point 1", () => {
    const alignment = calculateModelAlignment([
      landmark("Point 1", [-1, 1, -1]),
      landmark("Point 2", [0, 1.2, 0]),
      landmark("Point 3", [1, 1, 1]),
    ], [1, 4, 0.5]);

    expect(alignment.targetLongAxis[0]).toBeCloseTo(-Math.SQRT1_2);
    expect(alignment.targetLongAxis[2]).toBeCloseTo(-Math.SQRT1_2);
    expect(alignment.targetLength).toBeCloseTo(Math.sqrt(8));
    expect(alignment.uniformScale).toBeCloseTo(Math.sqrt(8) / 4);
    expect(alignment.targetCenter[0]).toBeCloseTo(0);
    expect(alignment.targetCenter[1]).toBeCloseTo(1.1);
    expect(alignment.targetCenter[2]).toBeCloseTo(0);
  });

  it("detects the source model axes from its actual bounds", () => {
    const alignment = calculateModelAlignment([
      landmark("Head", [0, 0, 1]),
      landmark("Foot", [0, 0, -1]),
    ], [6, 2, 1]);

    expect(alignment.sourceLongAxis).toEqual([1, 0, 0]);
    expect(alignment.sourceWidthAxis).toEqual([0, 1, 0]);
    expect(alignment.uniformScale).toBeCloseTo(1 / 3);
  });
});
