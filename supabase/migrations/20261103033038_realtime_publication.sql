-- Realtime gate 1 of 3: put the live tables in the publication Realtime listens to.
-- (Gate 2 is the select grant, gate 3 the RLS select policy; both are in create_iss_tables.)
-- follows is not added: only its owner changes it, and the page already knows.
alter publication supabase_realtime add table public.iss_positions, public.city_status, public.worker_runs;
