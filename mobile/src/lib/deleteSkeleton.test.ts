import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteSkeleton } from "./backendApi";

afterEach(() => vi.unstubAllGlobals());

describe("delete saved skeleton", () => {
  function mockResponse(status: number) {
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => status === 200 ? { status: "deleted" } : { detail: "Cannot delete" },
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("deletes only the selected skeleton, not its shared graveyard", async () => {
    const fetchMock = mockResponse(200);
    await deleteSkeleton("skeleton-2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/skeletons/skeleton-2"), expect.objectContaining({ method: "DELETE" }));
  });

  it("allows a locally saved copy to be removed if already deleted remotely", async () => {
    mockResponse(404);
    await expect(deleteSkeleton("gone")).resolves.toBeUndefined();
  });

  it("reports backend failures so the local record can be retained", async () => {
    mockResponse(500);
    await expect(deleteSkeleton("keep")).rejects.toThrow("Cannot delete");
  });
});
