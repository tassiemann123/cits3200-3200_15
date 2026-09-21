import { describe, expect, it } from "vitest";
import { parseCoordinateInput, toggleCoordinateSign } from "./coordinateInput";
import { parseCoordinateCsv, serialiseCoordinateCsv } from "./coordinateCsv";
import { recordToCoordinatePayloads } from "./backendApi";
import type { SkeletonRecord } from "../types";

describe("signed coordinate entry", () => {
  it("handles values that JavaScript formats in scientific notation", () => {
    expect(parseCoordinateInput(toggleCoordinateSign(String(0.0000001)))).toBe(-0.0000001);
    expect(parseCoordinateInput("1e-")).toBeNull();
    expect(parseCoordinateInput("1e999")).toBeNull();
  });
  it.each([["400", 400], ["-400", -400], ["0.400", 0.4], ["-0.004", -0.004], ["-.5", -0.5], ["-0.", -0], ["12.", 12]])("parses %s without changing units", (text, value) => {
    expect(parseCoordinateInput(text as string)).toBe(value);
  });
  it.each(["", "-", ".", "-.", "12foo", "1.2.3", "Infinity", "0x10", "1,200"])("does not save incomplete or invalid input %s", (text) => {
    expect(parseCoordinateInput(text)).toBeNull();
  });
  it.each([["", "-"], ["-", ""], ["400", "-400"], ["-400", "400"], ["0.004", "-0.004"], ["-0.", "0."]])("toggles %s to %s", (text, expected) => {
    expect(toggleCoordinateSign(text)).toBe(expected);
  });
  it("preserves negative decimals through local storage, CSV and API payloads", () => {
    const record: SkeletonRecord = {
      id: "negative-test", name: "Negative test", excludedGroups: [], notes: "",
      coordinates: { head_proximal: [-400, -0.004, 200] },
    };
    const restored = JSON.parse(JSON.stringify(record)) as SkeletonRecord;
    const csv = parseCoordinateCsv(serialiseCoordinateCsv(restored, "Test graveyard"));
    expect(csv.records[0].coordinates.head_proximal).toEqual([-400, -0.004, 200]);
    expect(recordToCoordinatePayloads(restored)[0]).toMatchObject({ x: -400, y: -0.004, z: 200 });
  });
});
