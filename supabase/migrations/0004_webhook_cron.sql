-- 0004_webhook_cron.sql
-- Schedule the webhook-dispatcher Edge Function to run every 10 seconds via
-- pg_cron + pg_net. Also includes verifier catch-up (the dispatcher does both).
--
-- Prereqs (Supabase usually has these enabled by default on hosted projects):
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
-- The dispatcher endpoint is anon-callable — it does service-role work
-- internally — but we still pass the anon key as a Bearer for completeness.
-- Replace the placeholder values with your project's URL + anon key, OR set
-- them via Supabase vault and read them in. For first deploy, the simplest
-- path is to paste them directly into pg_cron's command.

-- We schedule via a stored procedure so the URL/secret can be rotated by
-- updating one place rather than the cron entry.

create or replace function public.invoke_webhook_dispatcher()
returns void
language plpgsql
security definer
as $$
declare
  fn_url text;
  anon_key text;
begin
  -- Read from runtime config. Set with:
  --   alter database postgres set app.settings.functions_url = 'https://<ref>.functions.supabase.co';
  --   alter database postgres set app.settings.anon_key      = '<anon jwt>';
  fn_url   := current_setting('app.settings.functions_url', true);
  anon_key := current_setting('app.settings.anon_key',      true);

  if fn_url is null or anon_key is null then
    raise warning 'app.settings.functions_url / app.settings.anon_key not set; skipping cron tick';
    return;
  end if;

  perform net.http_post(
    url := fn_url || '/webhook-dispatcher',
    headers := jsonb_build_object(
      'content-type',  'application/json',
      'authorization', 'Bearer ' || anon_key,
      'apikey',        anon_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end;
$$;

-- Schedule every 10 seconds. pg_cron's minimum granularity is per-minute via
-- crontab strings; we use the seconds API where available.
do $$
begin
  -- Remove any prior schedule we own.
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'onramp-webhook-dispatcher';
exception when others then null;
end $$;

-- Run every 10 seconds. cron.schedule with an interval string (Supabase
-- supports this syntax).
select cron.schedule(
  'onramp-webhook-dispatcher',
  '10 seconds',
  $$ select public.invoke_webhook_dispatcher(); $$
);
