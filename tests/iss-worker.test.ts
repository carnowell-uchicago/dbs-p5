// Runs the worker's logic on two real API responses saved 3 minutes apart
// (docs/samples/iss-call-1.json and -2.json) and checks what it would save.
import { describe, expect, it } from "vitest";
import call1 from "../docs/samples/iss-call-1.json";
import call2 from "../docs/samples/iss-call-2.json";
import {
  changedStatuses,
  distanceKm,
  parsePosition,
  type City,
} from "../supabase/functions/iss-worker/logic";

const cities: City[] = [
  { id: "sydney", lat: -33.87, lon: 151.21 },
  { id: "auckland", lat: -36.85, lon: 174.76 },
  { id: "chicago", lat: 41.88, lon: -87.63 },
];

const T1 = "2026-11-03T01:26:37.000Z";
const T2 = "2026-11-03T01:29:41.000Z";

describe("parsePosition", () => {
  it("turns a saved API response into an iss_positions row", () => {
    expect(parsePosition(call1)).toEqual({
      source_ts: "2026-11-03T01:26:37.000Z", // timestamp 1793669197 in seconds
      latitude: -48.662945101452,
      longitude: 152.39378201109,
      altitude_km: 435.62203808183,
      velocity_kmh: 27540.945644389,
      visibility: "daylight",
      footprint_km: 4586.1024631728,
    });
  });

  it("throws if the API renames a field, instead of saving a bad row", () => {
    const { latitude, ...rest } = call1;
    const renamed = { ...rest, lat: latitude };
    expect(() => parsePosition(renamed)).toThrow('missing numeric field "latitude"');
  });

  it("throws on a non-numeric value or an unknown visibility", () => {
    expect(() => parsePosition({ ...call1, altitude: "435" })).toThrow('"altitude"');
    expect(() => parsePosition({ ...call1, visibility: "night" })).toThrow("visibility");
  });

  it("throws on an error body like a rate-limit response", () => {
    expect(() => parsePosition({ error: "Too many requests", status: 429 })).toThrow();
    expect(() => parsePosition(null)).toThrow("not a JSON object");
  });
});

describe("distanceKm", () => {
  it("matches a known distance (Chicago to New York is about 1,145 km)", () => {
    expect(distanceKm(41.88, -87.63, 40.71, -74.01)).toBeCloseTo(1145, -1);
  });
});

describe("changedStatuses: save only what changed", () => {
  const pos1 = parsePosition(call1);
  const pos2 = parsePosition(call2);

  it("first run with nothing stored writes every city", () => {
    expect(changedStatuses(cities, [], pos1, T1)).toEqual([
      { city_id: "sydney", overhead: true, last_overhead_at: T1 }, // 1,648 km < 2,293 km radius
      { city_id: "auckland", overhead: true, last_overhead_at: T1 }, // 2,236 km
      { city_id: "chicago", overhead: false, last_overhead_at: null }, // 15,381 km
    ]);
  });

  it("the same position again writes nothing", () => {
    const stored = changedStatuses(cities, [], pos1, T1);
    expect(changedStatuses(cities, stored, pos1, T2)).toEqual([]);
  });

  it("3 minutes later only Sydney flips; Auckland and Chicago are not rewritten", () => {
    const stored = changedStatuses(cities, [], pos1, T1);
    expect(changedStatuses(cities, stored, pos2, T2)).toEqual([
      // The ISS moved away (2,452 km). last_overhead_at keeps the time it was last overhead.
      { city_id: "sydney", overhead: false, last_overhead_at: T1 },
    ]);
  });
});
