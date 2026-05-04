-- 0012_cron_secret.sql
--
-- Adds a small `runtime_config` table for runtime-injected secrets that we
-- intentionally do NOT want in committed migrations (the cron->dispatcher
-- shared secret, in particular). The migration creates the table and
-- updates `invoke_webhook_dispatcher()` to read the secret from it; the
-- actual secret value is inserted out-of-band via direct SQL after the
-- migration is applied (and the same value is set as the Supabase Edge
-- Function secret `CRON_SECRET`).
--
-- Why this matters: until now `webhook-dispatcher` was anon-callable. Anyone
-- with the public Supabase anon key (which ships in every browser bundle)
-- could repeatedly POST to /functions/v1/webhook-dispatcher and force the
-- queue-drain code to run. That's a DoS vector against pg_net + Edge runtime
-- CPU. Now the dispatcher demands an `x-cron-secret` header that only the
-- legitimate cron job knows.

create table if not exists public.runtime_config (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

alter table public.runtime_config enable row level security;
-- No policies => no anon / authenticated access. Service role bypasses RLS.
revoke all     on public.runtime_config from anon, authenticated, public;
revoke select  on public.runtime_config from anon, authenticated;

-- Replace the dispatcher caller. The anon_key is public-by-design (it ships
-- in the browser bundle) so we keep it inlined; CRON_SECRET is not, so we
-- read it from runtime_config at call time.
create or replace function public.invoke_webhook_dispatcher()
returns void
language plpgsql
security definer
set search_path = public, pg_temp, extensions, net, cron
as $func$
declare
  fn_url      constant text := 'https://hkheayotxkyfgxjaoizj.functions.supabase.co';
  anon_key    constant text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhraGVheW90eGt5Zmd4amFvaXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTg5MjgsImV4cCI6MjA5MTA3NDkyOH0.eaMNsXuLVA6YOfaI6pO_Xt1DqgvU9j4XlvaqbiioOHI';
  v_secret    text;
begin
  -- Pull the dispatcher's expected shared secret from runtime_config.
  select value into v_secret
  from public.runtime_config
  where key = 'cron_secret';

  -- If the secret is missing the dispatcher's CRON_SECRET env will reject
  -- our request; that's the desired behaviour — surface the misconfiguration
  -- instead of silently letting anyone call the endpoint.
  perform net.http_post(
    url     := fn_url || '/webhook-dispatcher',
    headers := jsonb_build_object(
      'content-type',  'application/json',
      'authorization', 'Bearer ' || anon_key,
      'apikey',        anon_key,
      'x-cron-secret', coalesce(v_secret, '')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end;
$func$;

-- The function is SECURITY DEFINER and `revoke execute` from anon/authed was
-- applied in 0010; reaffirm so re-runs on a fresh DB land in the same place.
revoke execute on function public.invoke_webhook_dispatcher() from anon, authenticated, public;
