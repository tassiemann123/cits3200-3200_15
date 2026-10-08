import { describe, expect, it } from "vitest";
import { uniqueRecordName } from "./uniqueRecordName";

describe("CSV record names", () => {
  it("numbers repeated names without overwriting existing records", () => {
    const used = new Set(["skeleton a", "skeleton a (1)"]);
    expect(uniqueRecordName("Skeleton A", used)).toBe("Skeleton A (2)");
    expect(uniqueRecordName("Skeleton A", used)).toBe("Skeleton A (3)");
  });
});
