import { describe, it, expect } from "vitest";
import { boneMap } from "./skeletonMesh";
import { ALL_CFA_POINTS } from "../data/cfaSchema";
import { buildLandmarksAndSegments, defaultSurveyCoordinates } from "./skeletonMesh";


describe("boneMap", () => {
  it("only references valid point names", () => {
    const validNames = new Set(ALL_CFA_POINTS);
    for (const [from, to] of boneMap) {
      expect(validNames.has(from)).toBe(true);
      expect(validNames.has(to)).toBe(true);
    }
  });
});


describe("buildLandmarksAndSegments", () => {
  it("produces one landmark per coordinate given", () => {
    const { landmarks } = buildLandmarksAndSegments(defaultSurveyCoordinates);
    const numberOfCoordinatesGiven = Object.keys(defaultSurveyCoordinates).length;
    expect(landmarks.length).toBe(numberOfCoordinatesGiven);
  });

  it("skips a bone if one of its two joints is missing", () => {
    const incomplete = { ...defaultSurveyCoordinates };
    delete incomplete.left_wrist; // pretend this joint's data is missing

    const { segments } = buildLandmarksAndSegments(incomplete);
    const full = buildLandmarksAndSegments(defaultSurveyCoordinates);

    // with left_wrist missing, we should have fewer segments than the full skeleton
    expect(segments.length).toBeLessThan(full.segments.length);
  });
});