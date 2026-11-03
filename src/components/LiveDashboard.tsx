"use client";

import { useSession } from "@clerk/nextjs";
import type { LatLngTuple } from "leaflet";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
// Same distance formula the worker uses to decide "overhead", so the two never disagree.
import { distanceKm } from "../../supabase/functions/iss-worker/logic";
import { formatAge, freshness, type Freshness } from "@/lib/freshness";
import { useSupabase } from "@/lib/supabase/client";
import type { City, CityStatus, IssPosition, WorkerRun } from "@/lib/supabase/database.types";
import type { MapCity } from "./IssMap";

// Leaflet needs `window`, so the map renders in the browser only.
const IssMap = dynamic(() => import("./IssMap"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse rounded-2xl bg-space-800/60" />,
});

const TRAIL_POINTS = 360; // 1 hour at one point per 10 s (about 2/3 of an orbit)

export default function LiveDashboard() {
  const { session } = useSession();
  const supabase = useSupabase();

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Map<string, CityStatus>>(new Map());
  const [positions, setPositions] = useState<IssPosition[]>([]); // oldest first
  const [lastRun, setLastRun] = useState<WorkerRun | null>(null);
  const [connection, setConnection] = useState<string>("connecting");
  const [actionError, setActionError] = useState<string | null>(null);
  // null until the browser's clock starts (prerendering must not freeze a time into the HTML).
  const [now, setNow] = useState<number | null>(null);

  // 1. Initial load: everything the page needs, read with the signed-in user's token.
  //    Runs again when "Try again" bumps reloadKey.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    Promise.all([
      supabase.from("cities").select("*").order("name"),
      supabase.from("follows").select("city_id"),
      supabase.from("city_status").select("*"),
      supabase.from("iss_positions").select("*").order("fetched_at", { ascending: false }).limit(TRAIL_POINTS),
      supabase.from("worker_runs").select("*").order("ran_at", { ascending: false }).limit(1),
    ]).then(([c, f, s, p, r]) => {
      if (cancelled) return;
      const error = c.error ?? f.error ?? s.error ?? p.error ?? r.error;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setCities(c.data ?? []);
      setFollowed(new Set((f.data ?? []).map((row) => row.city_id)));
      setStatuses(new Map((s.data ?? []).map((row) => [row.city_id, row])));
      setPositions((p.data ?? []).reverse());
      setLastRun(r.data?.[0] ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [session, supabase, reloadKey]);

  // 2. Realtime: the database pushes each new row to this page over a websocket.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const channel = supabase.channel("iss-live");
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "iss_positions" }, (payload) => {
        const row = payload.new as IssPosition;
        setPositions((prev) => [...prev.slice(-(TRAIL_POINTS - 1)), row]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "city_status" }, (payload) => {
        const row = payload.new as CityStatus;
        if (row?.city_id) setStatuses((prev) => new Map(prev).set(row.city_id, row));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "worker_runs" }, (payload) => {
        setLastRun(payload.new as WorkerRun);
      });

    (async () => {
      // Send the Clerk token before joining, so the channel never joins as anonymous
      // (anonymous would get no rows, with no error).
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel.subscribe((status) => setConnection(status));
    })();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [session, supabase]);

  // 3. A 1-second clock, so "Updated 4 s ago" counts up and the badge turns stale by itself.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const latest = positions[positions.length - 1] ?? null;
  const previous = positions[positions.length - 2] ?? null;
  const fresh = freshness({ loaded, latestFetchedAt: latest?.fetched_at ?? null, lastRunOk: lastRun?.ok ?? null, now });

  const trail = useMemo<LatLngTuple[]>(() => positions.map((p) => [p.latitude, p.longitude]), [positions]);

  // The person's cities, nearest to the ISS first.
  const myCities = useMemo(() => {
    return cities
      .filter((c) => followed.has(c.id))
      .map((c) => ({
        ...c,
        status: statuses.get(c.id) ?? null,
        distance: latest ? distanceKm(latest.latitude, latest.longitude, c.lat, c.lon) : null,
      }))
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }, [cities, followed, statuses, latest]);

  const mapCities = useMemo<MapCity[]>(
    () => myCities.map((c) => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon, overhead: c.status?.overhead ?? false })),
    [myCities],
  );

  // 4. Follow / unfollow. RLS fills in and checks user_id, so we only send the city.
  async function follow(cityId: string) {
    setActionError(null);
    setFollowed((prev) => new Set(prev).add(cityId)); // optimistic
    const { error } = await supabase.from("follows").insert({ city_id: cityId });
    if (error) {
      setFollowed((prev) => { const next = new Set(prev); next.delete(cityId); return next; });
      setActionError(`Couldn't follow that city: ${error.message}`);
    }
  }

  async function unfollow(cityId: string) {
    setActionError(null);
    setFollowed((prev) => { const next = new Set(prev); next.delete(cityId); return next; });
    const { error } = await supabase.from("follows").delete().eq("city_id", cityId);
    if (error) {
      setFollowed((prev) => new Set(prev).add(cityId));
      setActionError(`Couldn't unfollow that city: ${error.message}`);
    }
  }

  if (loadError) {
    return (
      <div className="panel mx-auto mt-16 max-w-md p-6 text-center">
        <p className="text-lg font-semibold text-down">Couldn&apos;t load the live data</p>
        <p className="mt-2 font-mono text-sm text-dim">{loadError}</p>
        <button onClick={() => { setLoadError(null); setReloadKey((k) => k + 1); }} className="mt-4 rounded-full bg-cyan px-5 py-2 font-semibold text-space-950 hover:bg-white">
          Try again
        </button>
      </div>
    );
  }

  return (
    // Desktop: exactly one screen tall (minus header and footer); the city list
    // scrolls inside its panel, so the map never stretches. Phones: map 60vh, page scrolls.
    <div className="mx-auto grid w-full max-w-7xl gap-4 p-4 sm:p-6 lg:h-[calc(100dvh-6.5rem)] lg:min-h-[34rem] lg:grid-cols-[1fr_22rem]">
      <section className="relative flex h-[60vh] flex-col lg:h-full">
        <IssMap position={latest} previous={previous} trail={trail} cities={mapCities} live={fresh.state === "fresh"} />
        {fresh.state === "loading" && (
          <p className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center font-mono text-sm text-star">
            Locating the ISS…
          </p>
        )}
      </section>

      <aside className="flex min-h-0 flex-col gap-4">
        <FreshnessPanel state={fresh.state} ageS={fresh.ageS} lastRun={lastRun} connection={connection} />
        <Telemetry position={latest} loading={!loaded} />
        <CitiesPanel
          loading={!loaded}
          myCities={myCities}
          others={cities.filter((c) => !followed.has(c.id))}
          onFollow={follow}
          onUnfollow={unfollow}
          error={actionError}
        />
      </aside>
    </div>
  );
}

const STATE_STYLE: Record<Freshness, { dot: string; label: string; text: string }> = {
  loading: { dot: "bg-dim", label: "Connecting", text: "text-dim" },
  fresh: { dot: "bg-fresh shadow-[0_0_10px_var(--color-fresh)]", label: "Live", text: "text-fresh" },
  stale: { dot: "bg-stale shadow-[0_0_10px_var(--color-stale)]", label: "Stale", text: "text-stale" },
  down: { dot: "bg-down shadow-[0_0_10px_var(--color-down)]", label: "Source down", text: "text-down" },
};

function FreshnessPanel({ state, ageS, lastRun, connection }: { state: Freshness; ageS: number | null; lastRun: WorkerRun | null; connection: string }) {
  const style = STATE_STYLE[state];
  return (
    <section className="panel p-4" aria-live="polite" aria-label="Data freshness">
      <div className="flex items-center justify-between">
        <p className={`flex items-center gap-2 font-semibold ${style.text}`}>
          <span aria-hidden className={`inline-block size-3 rounded-full ${style.dot} ${state === "fresh" ? "animate-pulse" : ""}`} />
          {style.label}
        </p>
        <p className="font-mono text-sm text-star">{state === "loading" ? "…" : `Updated ${formatAge(ageS)}`}</p>
      </div>
      <p className="mt-2 text-sm text-dim">
        {state === "loading" && "Fetching the latest position…"}
        {state === "fresh" && "New position every 10 seconds. The map moves on its own."}
        {state === "stale" && "No new position for 3+ runs. The worker may be paused; showing the last known position."}
        {state === "down" && (
          <>
            The last update failed{lastRun ? ` at ${new Date(lastRun.ran_at).toLocaleTimeString()}` : ""}. Showing the last known
            position.
            {lastRun?.error && <span className="mt-1 block font-mono text-xs text-down/90">{lastRun.error}</span>}
          </>
        )}
      </p>
      {connection !== "SUBSCRIBED" && state !== "loading" && (
        <p className="mt-2 font-mono text-xs text-stale">Live connection: {connection.toLowerCase().replaceAll("_", " ")}</p>
      )}
    </section>
  );
}

function Telemetry({ position, loading }: { position: IssPosition | null; loading: boolean }) {
  const rows: [string, string][] = position
    ? [
        ["Latitude", `${position.latitude.toFixed(2)}°`],
        ["Longitude", `${position.longitude.toFixed(2)}°`],
        ["Altitude", `${Math.round(position.altitude_km)} km`],
        ["Speed", `${Math.round(position.velocity_kmh).toLocaleString()} km/h`],
        ["Sunlight", position.visibility === "daylight" ? "☀ Sunlit" : "☾ In Earth's shadow"],
      ]
    : [];
  return (
    <section className="panel p-4" aria-label="ISS telemetry">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan">Telemetry</h2>
      {loading ? (
        <div className="mt-3 space-y-2" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-space-800" />)}
        </div>
      ) : !position ? (
        <p className="mt-3 text-sm text-dim">No position recorded yet.</p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-y-1.5 font-mono text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-dim">{label}</dt>
              <dd className="text-right text-star">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

type MyCity = City & { status: CityStatus | null; distance: number | null };

function CitiesPanel(props: {
  loading: boolean;
  myCities: MyCity[];
  others: City[];
  onFollow: (id: string) => void;
  onUnfollow: (id: string) => void;
  error: string | null;
}) {
  const [choice, setChoice] = useState("");
  return (
    <section className="panel flex min-h-0 flex-1 flex-col p-4" aria-label="Your cities">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan">Your cities</h2>

      {props.loading ? (
        <div className="mt-3 space-y-2" aria-hidden>
          {[0, 1].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-space-800" />)}
        </div>
      ) : props.myCities.length === 0 ? (
        <p className="mt-3 text-sm text-dim">Follow a city below to see how far the ISS is from it, and when it passes overhead.</p>
      ) : (
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {props.myCities.map((city) => (
            <li
              key={city.id}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${city.status?.overhead ? "bg-fresh/15 ring-1 ring-fresh/60" : "bg-space-800/70"}`}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {city.name} <span className="text-xs font-normal text-dim">{city.country}</span>
                </p>
                <p className="font-mono text-xs text-dim">
                  {city.distance !== null && `${Math.round(city.distance).toLocaleString()} km away · `}
                  {city.status?.overhead ? (
                    <span className="font-semibold text-fresh">Overhead now</span>
                  ) : city.status?.last_overhead_at ? (
                    `last overhead ${new Date(city.status.last_overhead_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                  ) : (
                    "not overhead yet"
                  )}
                </p>
              </div>
              <button
                onClick={() => props.onUnfollow(city.id)}
                className="shrink-0 rounded-full px-2 py-1 text-dim hover:bg-white/10 hover:text-star focus-visible:outline-2 focus-visible:outline-cyan"
                aria-label={`Unfollow ${city.name}`}
                title="Unfollow"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (choice) props.onFollow(choice);
          setChoice("");
        }}
      >
        <label htmlFor="city-picker" className="sr-only">City to follow</label>
        <select
          id="city-picker"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          disabled={props.loading || props.others.length === 0}
          className="min-w-0 flex-1 rounded-full border border-cyan/30 bg-space-950 px-3 py-2 text-sm text-star focus-visible:outline-2 focus-visible:outline-cyan"
        >
          <option value="">Add a city…</option>
          {props.others.map((c) => (
            <option key={c.id} value={c.id}>{c.name}, {c.country}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!choice}
          className="rounded-full bg-magenta px-4 py-2 text-sm font-semibold text-space-950 hover:bg-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-magenta"
        >
          Follow
        </button>
      </form>
      {props.error && <p role="alert" className="mt-2 text-sm text-down">{props.error}</p>}
    </section>
  );
}
