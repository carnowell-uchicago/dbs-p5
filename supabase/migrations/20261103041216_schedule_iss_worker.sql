-- Call the iss-worker Edge Function every 10 seconds.
-- The secret key is read from Vault each time, so it never appears in this file or in git.
-- (The student stored it with vault.create_secret(..., 'iss_worker_secret_key').)
select cron.schedule(
  'iss-worker-every-10s',
  '10 seconds',
  $$
  select net.http_post(
    url := 'https://dxwqwpbtuizagvkawlhl.supabase.co/functions/v1/iss-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'iss_worker_secret_key')
    ),
    timeout_milliseconds := 10000
  );
  $$
);
