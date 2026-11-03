# ISS Flyover

**Is the space station over your city right now?** Sign in, follow cities, and watch the International Space Station cross a live map. The page updates on its own, with no refreshing.

- **Live app:** https://dbs-p5.vercel.app
- **Data-flow chart:** [`docs/data-flow.md`](docs/data-flow.md) (drawn before any code)
- **Design system:** [`docs/design-system.md`](docs/design-system.md)

Assignment 5 (Live Data System) for Design, Build, Ship (MPCS 51238), Autumn 2026.

## How it works

```
Where the ISS At? API ──every 10 s──▶ Edge Function (iss-worker) ──only what changed──▶ Postgres ──Realtime──▶ Next.js page
        ▲                              ▲ called by pg_cron + pg_net,                                     (Clerk JWT + RLS)
        │                              │ secret key read from Vault
```

1. **Schedule:** `pg_cron` runs every 10 seconds and POSTs to the `iss-worker` Edge Function with `pg_net`. The secret key it sends comes from Supabase Vault, never from code.
2. **Worker** (`supabase/functions/iss-worker/`): fetches the ISS position, validates it (`logic.ts`), and writes:
   - `iss_positions`: one new row per run, skipped if the API repeats a reading (unique `source_ts`);
   - `city_status`: **only the cities whose "ISS overhead" flag flipped** (inside the footprint radius), a few rows a day;
   - `worker_runs`: one row per run, success or failure (`ok`, `rows_changed`, `error`).
3. **Realtime:** `iss_positions`, `city_status` and `worker_runs` are in the `supabase_realtime` publication, readable by signed-in users (grant + RLS), and pushed to every open page.
4. **Page** (`/live`): a Leaflet map that follows the ISS, with its footprint and a one-hour trail. Between updates the marker is dead-reckoned from its last speed and heading. The panel shows freshness, telemetry, and **your** cities, with live distance and "overhead now".

### Freshness states

| State | Rule | What you see |
|---|---|---|
| Loading | first data not here yet | skeleton, "Locating the ISS…" |
| Fresh | newest position < 30 s old and last run ok | green **Live**, "Updated 4 s ago" |
| Stale | ≥ 30 s old (3 missed runs) | amber **Stale**, map faded, marker frozen |
| Down | last `worker_runs.ok = false` | red **Source down** + the error |

Age is computed in the browser every second, so the page turns stale on its own even if pushes stop. All four states were forced on the live system (pausing cron, then revoking the worker's insert grant) and checked.

### Personal data and security

- Sign-in is **Clerk**. Supabase trusts Clerk's JWT (third-party auth), so `auth.jwt() ->> 'sub'` is the Clerk user id.
- `follows` has RLS: users can select, insert and delete **only their own rows**. Verified with two simulated users: B sees none of A's follows, and B can't insert as A.
- `anon` has no grants on any table. The worker uses the secret key (bypasses RLS) and checks the `apikey` header itself, so only the cron job can run it.

## Tech stack

Next.js 16 (App Router) + Tailwind CSS 4 · Clerk · Supabase (Postgres, RLS, Realtime, Edge Functions on Deno, pg_cron, pg_net, Vault) · Leaflet with Esri World Street Map tiles · Vercel (Hobby). `supabase/` is excluded in `tsconfig.json`, so the Next build doesn't type-check the Deno worker.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values (never commit .env.local)
npm run dev                  # http://localhost:3000
```

Environment variables (names only):

| Name | Where |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk dashboard → API keys |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API keys |
| `E2E_USER1_EMAIL` (tests only) | a Clerk test user |

The worker's keys (`SUPABASE_URL`, `SUPABASE_SECRET_KEYS`) are injected by Supabase on its servers. The cron job reads the key from Vault (`iss_worker_secret_key`).

## Tests

```bash
npm test            # Vitest: 50 unit tests
npm run test:e2e    # Playwright: signs in a test user and watches /live
PLAYWRIGHT_BASE_URL=https://dbs-p5.vercel.app npm run test:e2e   # same, against production
```

- `tests/iss-worker.test.ts` runs the worker's logic on **two real API responses saved 3 minutes apart** (`docs/samples/`). It checks the exact row saved; that a renamed or missing field, a non-number, or a rate-limit body **throws** instead of saving bad data; that the first run writes every city; that an unchanged position writes nothing; and that 3 minutes later **only Sydney flips**.
- `tests/freshness.test.ts`: the loading/fresh/stale/down rules. `tests/predict.test.ts`: dead reckoning, the date-line crossing, the caps.
- `tests/design-tokens.test.ts`: every text/control color pair meets WCAG AA, and hover states visibly change.
- `e2e/live.spec.ts` and `e2e/stability.spec.ts`: in a real browser, the map stays mounted, the ISS moves without a reload, there's no reload loop, and there are no console errors. Both pass against the Vercel deployment.

## Database

Migrations live in `supabase/migrations/` (applied through the Supabase MCP): tables + RLS + grants, 43 seeded cities, the Realtime publication, unique `source_ts`, pg_net/pg_cron, the 10 s schedule, and an hourly prune (positions > 24 h, runs > 7 days).

## Free tiers

A 10 s worker uses about 260k of Supabase's 500k monthly Edge Function calls. Writing only flipped cities keeps Realtime messages low (about 2 per run per open page, instead of 45). Clerk development keys rate-limit heavy use, so space out e2e runs. Supabase pauses free projects after a week without use.
