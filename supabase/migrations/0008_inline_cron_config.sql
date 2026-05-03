-- 0008_inline_cron_config.sql
--
-- The dispatcher function originally read functions_url and anon_key from
-- app.settings.*, which requires superuser to ALTER DATABASE SET. Supabase
-- denies that even to the `postgres` role. Both values are public (the
-- functions URL is a DNS name, the anon JWT is shipped to every browser),
-- so we inline them directly. To rotate the anon key, redefine this
-- function in a new migration.

create or replace function public.invoke_webhook_dispatcher()
returns void
language plpgsql
security definer
as $func$
declare
  fn_url   constant text := 'https://hkheayotxkyfgxjaoizj.functions.supabase.co';
  anon_key constant text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhraGVheW90eGt5Zmd4amFvaXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTg5MjgsImV4cCI6MjA5MTA3NDkyOH0.eaMNsXuLVA6YOfaI6pO_Xt1DqgvU9j4XlvaqbiioOHI';
begin
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
$func$;
