-- ISS Flyover: the live data the worker writes, and the follows each user owns.
-- Writers: the worker uses the secret key (service_role), which bypasses RLS.
-- Readers: signed-in users (Clerk JWT -> role authenticated). anon gets nothing.

-- Catalog of cities a user can follow. Seeded by a separate migration.
create table public.cities (
  id      text primary key,                 -- slug, e.g. 'chicago'
  name    text not null,
  country text not null,
  lat     double precision not null check (lat between -90 and 90),
  lon     double precision not null check (lon between -180 and 180)
);

-- One row per successful worker run: where the ISS was.
create table public.iss_positions (
  id           bigint generated always as identity primary key,
  source_ts    timestamptz not null,        -- API's "timestamp": when the position was computed
  fetched_at   timestamptz not null default now(),  -- when our worker saved it (drives freshness)
  latitude     double precision not null check (latitude between -90 and 90),
  longitude    double precision not null check (longitude between -180 and 180),
  altitude_km  double precision not null,
  velocity_kmh double precision not null,
  visibility   text not null check (visibility in ('daylight', 'eclipsed')),
  footprint_km double precision not null    -- diameter of the visibility circle on the ground
);
create index iss_positions_fetched_at on public.iss_positions (fetched_at desc);

-- Is the ISS overhead (inside its footprint) for each city? Written only when the flag flips.
create table public.city_status (
  city_id          text primary key references public.cities (id) on delete cascade,
  overhead         boolean not null,
  last_overhead_at timestamptz,             -- last time the ISS rose over this city
  changed_at       timestamptz not null default now()
);

-- One row per worker run, success or failure: the system's heartbeat.
create table public.worker_runs (
  id           bigint generated always as identity primary key,
  ran_at       timestamptz not null default now(),
  ok           boolean not null,
  rows_changed integer not null default 0,
  duration_ms  integer,
  error        text
);
create index worker_runs_ran_at on public.worker_runs (ran_at desc);

-- Which cities each user follows. user_id is the Clerk user id from the JWT.
create table public.follows (
  user_id    text not null default (auth.jwt() ->> 'sub'),
  city_id    text not null references public.cities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, city_id)
);

-- Row-level security on every table.
alter table public.cities        enable row level security;
alter table public.iss_positions enable row level security;
alter table public.city_status   enable row level security;
alter table public.worker_runs   enable row level security;
alter table public.follows       enable row level security;

-- Grants: anon gets nothing; signed-in users may only read the shared tables.
revoke all on table public.cities, public.iss_positions, public.city_status, public.worker_runs, public.follows from anon;
revoke all on table public.cities, public.iss_positions, public.city_status, public.worker_runs from authenticated;
grant select on table public.cities, public.iss_positions, public.city_status, public.worker_runs to authenticated;
revoke all on table public.follows from authenticated;
grant select, insert, delete on table public.follows to authenticated;

-- Shared live data: any signed-in user may read it.
create policy "Signed-in users can read cities"
  on public.cities for select to authenticated using (true);
create policy "Signed-in users can read ISS positions"
  on public.iss_positions for select to authenticated using (true);
create policy "Signed-in users can read city status"
  on public.city_status for select to authenticated using (true);
create policy "Signed-in users can read worker runs"
  on public.worker_runs for select to authenticated using (true);

-- Personal data: only your own follows.
create policy "Users can read their own follows"
  on public.follows for select to authenticated
  using ((select auth.jwt()) ->> 'sub' = user_id);
create policy "Users can follow cities for themselves"
  on public.follows for insert to authenticated
  with check ((select auth.jwt()) ->> 'sub' = user_id);
create policy "Users can unfollow their own cities"
  on public.follows for delete to authenticated
  using ((select auth.jwt()) ->> 'sub' = user_id);
