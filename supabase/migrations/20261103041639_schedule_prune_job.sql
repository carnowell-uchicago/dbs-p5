-- Keep the tables small: positions for 24 hours (the trail), runs for 7 days (the audit log).
select cron.schedule(
  'iss-prune-hourly',
  '0 * * * *',
  $$
  delete from public.iss_positions where fetched_at < now() - interval '24 hours';
  delete from public.worker_runs   where ran_at     < now() - interval '7 days';
  $$
);
