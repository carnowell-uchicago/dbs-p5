-- pg_net lets SQL make HTTP requests; pg_cron runs SQL on a schedule.
-- Together they call the iss-worker Edge Function every 10 seconds.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
