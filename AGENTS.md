# AGENTS.md: Assignment 5, Live Data System

**Course:** Design, Build, Ship (MPCS 51238), Autumn 2026
**Due:** Tuesday, November 3, 2026, 5:30 PM
**Source of truth:** `Design, Build, Ship - Assignment 5 - Live Data System.pdf` in this folder. If this file and the PDF disagree, the PDF wins. Tell the student about the conflict.

This is the project's only context file. Do not create a `CLAUDE.md`. If one shows up, move anything useful from it into this file, delete it, and remind the student to run `/context` to confirm that `AGENTS.md` loaded.

---

## 0. How you must work

This is graded coursework, and **the student is the one being graded**. The brief says a one-shot submission is marked incomplete, and the student has to explain the system in class (Section 6). So **build with the student one step at a time, and teach as you go.**

### Hard rules

1. **One step at a time** (Section 4). At the end of each step, stop and:
   - summarize what you did and list the files you changed,
   - give that step's **Ask Your Agent** (explanation, diagram, or quiz), or offer it,
   - wait for the student to confirm before starting the next step.
2. **The student makes the decisions:** the live source, what users follow, the data model, the polling interval, the UI/UX, and the freshness thresholds. Offer options and trade-offs, recommend one, and let them choose.
3. **Never read, print, or ask for secrets.** Don't open `.env`, `.env.local`, or `.env.*` (a deny rule is in `.claude/settings.json`), and don't work around it with `cat`, `grep`, `printenv`, and so on. Give the student the **variable name** and where to find the value; the student types it in.
4. **Never hard-code keys.** The worker reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` / secret key from `Deno.env`, which Supabase injects on its servers. The page reads `process.env.*`. Before every commit, check that no secret is staged.
5. **STUDENT tasks** (Section 3) are done only by the student. Don't fake them, simulate them, or claim they happened.
6. **Commit often and push.** The git history is graded. Commit after each meaningful unit of work, with clear messages. Run `git status` before every commit: no `.env*` except `.env.example`. Never force-push or rewrite history. After the initial commit, do feature work on branches; the student merges.
7. **Stay on free tiers.** Poll every **10 s or slower** (≈260k of the 500k monthly Edge Function calls). Upsert **only changed rows** so Realtime messages stay low. Clerk development keys only.
8. **Be honest.** If a test fails, a deploy breaks, or you aren't sure something works, say so and show the output. Never weaken a test or turn off RLS to make something pass.
9. **Keep it simple** enough that the student can defend it line by line.

---

## Status and next steps (update this at the end of every session)

**2026-11-02 (evening), one day before the deadline.** Folder has the PDF, this file, and `.claude/settings.json`. Not yet a git repo.

**Environment check (agent):** node 26, npm, git are installed. **Missing:** `gh`, `supabase` CLI, `clerk` CLI, `vercel` CLI, `deno`. The Supabase MCP isn't connected in this folder yet.

**Step 1 in progress:** called the ISS API twice, 3 min apart (`docs/samples/iss-call-*.json`); now explaining the fields.

**Waiting on the student:** GitHub repo name, D4 to D6.

---

## 1. Requirements checklist (all graded)

- [ ] **Live source:** one source that changes on its own. The agent called it twice, a few minutes apart, and showed the diff.
- [ ] **Data-flow chart:** a high-level chart, made **before** worker or page code (`docs/data-flow.md`, Mermaid).
- [ ] **Worker:** a Supabase Edge Function in `supabase/functions/`, run by Supabase Cron every ~10 s. It upserts only changed rows and writes a row to a `worker_runs` table on every run (time, ok/error, rows changed).
- [ ] **Worker test:** runs the worker's logic on a saved copy of the source response (a fixture) and checks what it would save. The student can explain what it checks.
- [ ] **Live page:** updates without a refresh via Supabase Realtime and shows how fresh the data is. It has these states: **loading**, **fresh**, **stale** (older than a few missed runs), and **down** (the last run failed).
- [ ] **Personal:** each user chooses what they follow. RLS on the follows table: users see and change only their own rows.
- [ ] **Deployed:** page on Vercel with env vars set, worker running. A classmate signs in, follows something, and watches it update.
- [ ] **UI/UX:** designed states, clear freshness, a sensible flow.
- [ ] `tsconfig.json` **excludes `supabase`** so the Next.js build doesn't type-check the Deno code.
- [ ] `README.md` and a commit history that shows progress.

## 2. Project facts and decisions

| # | Decision (STUDENT) | Choice |
|---|---|---|
| D1 | Extend Assignment 4 (`../p4`, a Pokémon work timer) or start a new app? | **New app in p5** (copy A4's Clerk+Supabase patterns) |
| D2 | Live source, and what a user "follows" (stations, teams, regions, routes…) | **ISS flyover**: `api.wheretheiss.at`; users follow **cities**; live Leaflet/OSM map that pans with the ISS |
| D3 | GitHub repo, and the Supabase project and Clerk app (reuse A4's or new) | **Reuse A4's** Supabase project `dxwqwpbtuizagvkawlhl` and Clerk app (shared user pool; separate tables). GitHub repo name: _pending_ |
| D4 | Polling interval (default 10 s; slower if the source updates slowly or rate-limits) | _pending_ |
| D5 | Freshness thresholds: fresh < ?, stale after ? missed runs | _pending_ |
| D6 | Page design and look | _pending_ |

- **Vercel URL:** _tbd_
- **GitHub URL:** _tbd_
- **Supabase project ref:** _tbd_

### Planned data model (to be confirmed with the student after D2)

- `iss_positions`: one row inserted per run (lat, lon, altitude, velocity, visibility, footprint, source timestamp). Drives the map, the trail, and freshness. Worker-only writes; authenticated users can read; added to Realtime. Prune rows older than ~24 h.
- `cities`: a small seeded catalog (name, lat, lon). Read-only for users.
- `city_status`: `(city_id, overhead bool, last_overhead_at)`. The worker upserts a row **only when `overhead` flips** (ISS within the footprint radius). This is the "only what changed" story. Added to Realtime.
- Live distance to each followed city is computed **client-side** from the latest position (no per-city write every run).
- `follows`: `(user_id text default auth.jwt()->>'sub', item_id)`. RLS: own rows only, for select, insert, and delete.
- `worker_runs`: `id, ran_at, ok, rows_changed, error`. Authenticated users can read it (it drives freshness and "down"). Added to Realtime.

### Environment variables (names only)

- Page (`.env.local` and Vercel): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Worker: injected by Supabase automatically (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEYS`). Never in code or in git.

## 3. Who does what

### STUDENT only

- Make decisions D1 to D6, and approve the data-flow chart and the data model.
- Create or choose the GitHub repo; run `gh auth login` / git credentials if needed.
- Install CLIs if wanted (`brew install supabase/tap/supabase gh`, Clerk CLI), and log in to anything that needs a browser.
- Restart Claude Code, run `/mcp`, and authenticate the **Supabase MCP** (read-write, scoped to the project).
- Supabase dashboard: create the project if new; Clerk third-party auth; check that the `pg_cron` and `pg_net` extensions are allowed.
- Clerk dashboard: the app and the Supabase integration (if not reused from A4).
- Put values in `.env.local` and in Vercel's environment variables.
- Import the repo in Vercel and deploy. Merge PRs.
- Set usage limits and spending alerts on Supabase, Vercel, and Clerk.
- Ask a classmate to sign in and test, and check the result.
- Do the Ask Your Agent prompts, take the quiz, and submit both URLs in Google Classroom.

### AGENT (with the student watching and approving)

- Call the source twice and show the diff; explain the fields.
- Draw the data-flow chart.
- Scaffold the code or copy it from A4, write migrations (applied through the MCP and saved in `supabase/migrations/`), and set up RLS, grants, and the Realtime publication.
- Write the Edge Function, its fixture test, and the cron schedule (through the MCP), then deploy it and call it once.
- Build the page, the Realtime subscription, the freshness states, and the follow UI.
- Run the security advisors, read the logs, commit and push, and write the README.

## 4. Steps (one at a time; stop after each)

1. **Choose a live source.** Call it twice, a few minutes apart, and diff. *Ask: "Explain this response: what each field means, how often it changes, and which fields my app needs."*
2. **Give the agent access.** Supabase MCP (read-write), the Clerk CLI, and Vercel through GitHub. *Ask: "List the MCP servers and CLIs you can use… then check that each one works."*
3. **Plan the data flow.** A Mermaid chart in `docs/data-flow.md`, made before any code. *Ask: "Walk me through the chart…"*
4. **Build the worker.** Migrations, then the Edge Function (fetch → diff against the DB → upsert changed rows → insert into `worker_runs`). Deploy it, call it once, and show the rows. Then schedule it with `pg_cron` + `pg_net` (`'10 seconds'`). Then the fixture test. *Ask: "Show me the worker's logs from its last three runs, and explain each line."*
5. **Make the page live.** Follows UI with RLS. Realtime needs: table in the `supabase_realtime` publication + `grant select` + an RLS select policy. Freshness badge with loading, fresh, stale, and down states. *Ask: "Trace one update for me, from the source to my screen…"*
6. **Deploy and test.** Vercel, env vars, worker confirmed running, a classmate test. *Ask: "Quiz me on how my system works, one question at a time…"*

## 5. Technical guardrails

- Next.js (App Router) + Tailwind + Clerk + Supabase. Read `node_modules/next/dist/docs/` before writing Next.js code; this version may differ from your training data.
- Clerk → Supabase: third-party auth, using `accessToken: () => getToken()` on the client (Realtime needs `supabase.realtime.setAuth`).
- Put the worker's pure logic (parse + diff) in a module with no Deno-only imports so it can be tested with a fixture.
- Cron calls the function with `net.http_post`. Keep any key it needs in Supabase Vault, never in a committed migration.
- Don't break A4 if we extend it.

## 6. Be Ready to Explain (quizzed in class)

1. Tracing a data change: what happens in the worker, the DB, and on screen.
2. The data flow, and what breaks if one part changes.
3. Freshness: how someone knows the data is current.
4. Agentic workflow: what the tests check, and what was found in the logs.

### Agentic workflow log

- 2026-11-02: Read the PDF, inspected A4 for conventions, wrote this plan.

## 7. Submission (student)

Vercel URL + GitHub URL in Google Classroom.
