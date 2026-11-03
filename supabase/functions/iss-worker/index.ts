// ISS worker: Supabase Cron calls this every 10 seconds.
// Each run: fetch the ISS position -> save it if new -> upsert only the cities
// whose "overhead" flag flipped -> record the run in worker_runs.
// The decisions live in logic.ts (tested with saved API responses); this file does the I/O.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  changedStatuses,
  ISS_API_URL,
  parsePosition,
  type City,
  type CityStatus,
} from "./logic.ts";

// Supabase injects these on its servers. The secret key bypasses RLS and is never in our code.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET_KEY: string = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;

const db = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  // verify_jwt is off (secret keys aren't JWTs), so check the caller ourselves:
  // only someone holding the secret key (our cron job, via Vault) may run the worker.
  if (!SECRET_KEY || req.headers.get("apikey") !== SECRET_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const started = Date.now();
  try {
    // 1. Fetch from the source. Give up after 5 s so a hung API can't stall the run.
    const response = await fetch(ISS_API_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`ISS API returned HTTP ${response.status}`);
    const position = parsePosition(await response.json());

    // 2. Save the position, unless this exact reading (same source_ts) is already stored.
    const saved = await db
      .from("iss_positions")
      .upsert(position, { onConflict: "source_ts", ignoreDuplicates: true })
      .select("id");
    if (saved.error) throw new Error(`saving position: ${saved.error.message}`);
    const positionsSaved = saved.data.length; // 1 if new, 0 if a repeat

    // 3. Compare every city's overhead flag with what's stored; write only the flips.
    const [cities, stored] = await Promise.all([
      db.from("cities").select("id, lat, lon"),
      db.from("city_status").select("city_id, overhead, last_overhead_at"),
    ]);
    if (cities.error) throw new Error(`reading cities: ${cities.error.message}`);
    if (stored.error) throw new Error(`reading city_status: ${stored.error.message}`);

    const now = new Date().toISOString();
    const flips = changedStatuses(cities.data as City[], stored.data as CityStatus[], position, now);
    if (flips.length > 0) {
      const upserted = await db
        .from("city_status")
        .upsert(flips.map((f) => ({ ...f, changed_at: now })));
      if (upserted.error) throw new Error(`saving city_status: ${upserted.error.message}`);
    }

    // 4. Record the run.
    const rowsChanged = positionsSaved + flips.length;
    await recordRun({ ok: true, rows_changed: rowsChanged, started });
    console.log(
      `ok: ISS at ${position.latitude.toFixed(2)}, ${position.longitude.toFixed(2)} ` +
        `(${position.visibility}); positions saved ${positionsSaved}; ` +
        `flipped ${flips.length}${flips.length ? ` [${flips.map((f) => `${f.city_id}=${f.overhead}`).join(", ")}]` : ""}; ` +
        `${Date.now() - started} ms`,
    );
    return Response.json({ ok: true, rows_changed: rowsChanged, flipped: flips });
  } catch (err) {
    // Any failure (API down, bad JSON, DB error) is recorded, so the page can show "down".
    const message = err instanceof Error ? err.message : String(err);
    console.error(`failed: ${message}`);
    await recordRun({ ok: false, rows_changed: 0, started, error: message });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});

async function recordRun(run: { ok: boolean; rows_changed: number; started: number; error?: string }) {
  const { error } = await db.from("worker_runs").insert({
    ok: run.ok,
    rows_changed: run.rows_changed,
    duration_ms: Date.now() - run.started,
    error: run.error ?? null,
  });
  if (error) console.error(`could not record run: ${error.message}`);
}
