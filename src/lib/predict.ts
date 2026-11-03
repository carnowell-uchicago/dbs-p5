// Dead reckoning: estimate where the ISS is *between* the worker's 10 s updates,
// from the velocity between the last two real positions. Used only to move the
// map marker smoothly; telemetry always shows the real, measured values.

export type Fix = { latitude: number; longitude: number; source_ts: string };

export const MAX_GAP_S = 60; // last two fixes further apart than this: don't trust the velocity
export const MAX_AHEAD_S = 30; // never predict further ahead than this

// Wrap a longitude into [-180, 180).
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

// Position `aheadS` seconds after `latest`, or null if we shouldn't predict.
export function predict(previous: Fix | null, latest: Fix, aheadS: number): { latitude: number; longitude: number } | null {
  if (!previous) return null;
  const dtS = (Date.parse(latest.source_ts) - Date.parse(previous.source_ts)) / 1000;
  if (dtS <= 0 || dtS > MAX_GAP_S) return null;

  const t = Math.min(Math.max(aheadS, 0), MAX_AHEAD_S);
  const dLat = latest.latitude - previous.latitude;
  // Take the short way around: going from 179° to -179° is +2°, not -358°.
  const dLon = wrapLon(latest.longitude - previous.longitude);

  return {
    latitude: Math.max(-90, Math.min(90, latest.latitude + (dLat / dtS) * t)),
    longitude: wrapLon(latest.longitude + (dLon / dtS) * t),
  };
}
