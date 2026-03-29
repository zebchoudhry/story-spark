-- pg_cron and pg_net should already be available
-- Schedule ingest-stories at 5am UTC daily
SELECT cron.schedule(
  'ingest-stories-daily',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ezpjcjhkzffpfhhfnqfv.supabase.co/functions/v1/ingest-stories',
    headers := jsonb_build_object(
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INGEST_SECRET' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule discover-sources at 6am UTC daily
SELECT cron.schedule(
  'discover-sources-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ezpjcjhkzffpfhhfnqfv.supabase.co/functions/v1/discover-sources',
    headers := jsonb_build_object(
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INGEST_SECRET' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);