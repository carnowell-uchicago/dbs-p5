// The page's four states, decided from timestamps (src/lib/freshness.ts).
import { describe, expect, it } from "vitest";
import { formatAge, freshness } from "../src/lib/freshness";

const now = Date.parse("2026-11-03T12:00:00Z");
const secondsAgo = (s: number) => new Date(now - s * 1000).toISOString();

describe("freshness", () => {
  it("is loading until the first fetch finishes", () => {
    expect(freshness({ loaded: false, latestFetchedAt: null, lastRunOk: null, now }).state).toBe("loading");
  });

  it("is fresh when the newest position is under 30 s old and the last run worked", () => {
    expect(freshness({ loaded: true, latestFetchedAt: secondsAgo(4), lastRunOk: true, now })).toEqual({ state: "fresh", ageS: 4 });
    expect(freshness({ loaded: true, latestFetchedAt: secondsAgo(29), lastRunOk: true, now }).state).toBe("fresh");
  });

  it("is stale at 30 s (3 missed 10 s runs), e.g. when cron stops and nothing reports an error", () => {
    expect(freshness({ loaded: true, latestFetchedAt: secondsAgo(30), lastRunOk: true, now })).toEqual({ state: "stale", ageS: 30 });
  });

  it("is stale when there is no position at all", () => {
    expect(freshness({ loaded: true, latestFetchedAt: null, lastRunOk: null, now }).state).toBe("stale");
  });

  it("is down when the last run failed, even if the data is still young", () => {
    expect(freshness({ loaded: true, latestFetchedAt: secondsAgo(5), lastRunOk: false, now }).state).toBe("down");
    expect(freshness({ loaded: true, latestFetchedAt: secondsAgo(300), lastRunOk: false, now }).state).toBe("down");
  });
});

describe("formatAge", () => {
  it("reads naturally", () => {
    expect([formatAge(null), formatAge(4), formatAge(125), formatAge(7300)]).toEqual(["never", "4 s ago", "2 min ago", "2 h ago"]);
  });
});
