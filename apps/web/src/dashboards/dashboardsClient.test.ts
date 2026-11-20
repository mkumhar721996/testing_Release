import { afterEach, describe, expect, it, vi } from "vitest";
import { getExecutiveSummary } from "./dashboardsClient";

const summary = {
  headcount: 248,
  leaveDaysTaken: 1312,
  leaveYear: { from: "2026-01-01", to: "2026-11-20" },
  hasData: true,
};

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("getExecutiveSummary", () => {
  it("returns the summary on 200 from /dashboards/executive with credentials", async () => {
    const fetchMock = stubFetch(200, summary);
    expect(await getExecutiveSummary()).toEqual({ kind: "ok", summary });
    expect(fetchMock).toHaveBeenCalledWith("/dashboards/executive", { credentials: "include" });
  });

  it("returns forbidden on 403", async () => {
    stubFetch(403);
    expect(await getExecutiveSummary()).toEqual({ kind: "forbidden" });
  });

  it("rejects on any other failure", async () => {
    stubFetch(500);
    await expect(getExecutiveSummary()).rejects.toThrow();
  });
});
