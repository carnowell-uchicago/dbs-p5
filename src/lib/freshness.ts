// How current is the data on screen? Decided in the browser from timestamps,
// so the badge drifts to "stale" on its own even if Realtime stops pushing.
// Thresholds chosen by the student (D5): the worker runs every 10 s, so
// 30 s old = 3 missed runs.
export const RUN_INTERVAL_S = 10;
export const STALE_AFTER_S = 30;

export type Freshness = "loading" | "fresh" | "stale" | "down";

export function freshness(input: {
  loaded: boolean; // has the first fetch finished?
  latestFetchedAt: string | null; // newest iss_positions.fetched_at
  lastRunOk: boolean | null; // newest worker_runs.ok
  now: number; // Date.now()
}): { state: Freshness; ageS: number | null } {
  if (!input.loaded) return { state: "loading", ageS: null };

  const ageS = input.latestFetchedAt
    ? Math.max(0, Math.floor((input.now - Date.parse(input.latestFetchedAt)) / 1000))
    : null;

  // "Down" beats "stale": the worker ran and told us it failed.
  if (input.lastRunOk === false) return { state: "down", ageS };
  // No position at all, or too old: we haven't heard from the worker recently.
  if (ageS === null || ageS >= STALE_AFTER_S) return { state: "stale", ageS };
  return { state: "fresh", ageS };
}

// "4 s ago", "2 min ago", "3 h ago".
export function formatAge(ageS: number | null): string {
  if (ageS === null) return "never";
  if (ageS < 60) return `${ageS} s ago`;
  if (ageS < 3600) return `${Math.floor(ageS / 60)} min ago`;
  return `${Math.floor(ageS / 3600)} h ago`;
}
