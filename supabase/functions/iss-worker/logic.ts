// Pure logic for the ISS worker: no Deno, no network, no database.
// index.ts does the I/O; this file decides what to save, so a test can run it
// on a saved API response (docs/samples/*.json) and check the result.

export const ISS_API_URL = "https://api.wheretheiss.at/v1/satellites/25544";

const EARTH_RADIUS_KM = 6371;

// A row for public.iss_positions (fetched_at is set by the database).
export type PositionRow = {
  source_ts: string;
  latitude: number;
  longitude: number;
  altitude_km: number;
  velocity_kmh: number;
  visibility: "daylight" | "eclipsed";
  footprint_km: number;
};

export type City = { id: string; lat: number; lon: number };

// A row for public.city_status.
export type CityStatus = {
  city_id: string;
  overhead: boolean;
  last_overhead_at: string | null;
};

// Turn the API's JSON into a row, or throw if anything is missing or wrong.
// Throwing is deliberate: the worker records the error in worker_runs and the
// page shows "down", instead of saving a bad position.
export function parsePosition(json: unknown): PositionRow {
  if (typeof json !== "object" || json === null) {
    throw new Error("ISS API response is not a JSON object");
  }
  const body = json as Record<string, unknown>;

  const num = (field: string): number => {
    const value = body[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`ISS API response is missing numeric field "${field}"`);
    }
    return value;
  };

  const latitude = num("latitude");
  const longitude = num("longitude");
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error(`ISS position out of range: ${latitude}, ${longitude}`);
  }

  const visibility = body.visibility;
  if (visibility !== "daylight" && visibility !== "eclipsed") {
    throw new Error(`ISS API response has unknown visibility "${visibility}"`);
  }

  if (body.units !== undefined && body.units !== "kilometers") {
    throw new Error(`ISS API response uses units "${body.units}", expected kilometers`);
  }

  return {
    source_ts: new Date(num("timestamp") * 1000).toISOString(),
    latitude,
    longitude,
    altitude_km: num("altitude"),
    velocity_kmh: num("velocity"),
    visibility,
    footprint_km: num("footprint"),
  };
}

// Great-circle distance between two points on Earth (haversine formula), in km.
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// The ISS is "overhead" when the city is inside its footprint circle.
// footprint_km is a diameter, so compare against half of it.
export function isOverhead(city: City, position: PositionRow): boolean {
  const distance = distanceKm(position.latitude, position.longitude, city.lat, city.lon);
  return distance <= position.footprint_km / 2;
}

// Compare each city's new overhead flag with the stored one, and return only
// the rows that changed. A city with no stored row counts as changed (first run).
// This is what keeps Realtime traffic low: unchanged cities are never written.
export function changedStatuses(
  cities: City[],
  stored: CityStatus[],
  position: PositionRow,
  now: string,
): CityStatus[] {
  const before = new Map(stored.map((s) => [s.city_id, s]));
  const changed: CityStatus[] = [];

  for (const city of cities) {
    const overhead = isOverhead(city, position);
    const previous = before.get(city.id);
    if (previous && previous.overhead === overhead) continue;

    changed.push({
      city_id: city.id,
      overhead,
      // Set when the ISS rises over the city; otherwise keep the old value.
      last_overhead_at: overhead ? now : (previous?.last_overhead_at ?? null),
    });
  }
  return changed;
}
