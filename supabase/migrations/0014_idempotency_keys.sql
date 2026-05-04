-- 0014_idempotency_keys.sql
--
-- Stripe-style Idempotency-Key support for the public REST API. When a
-- merchant POSTs with `Idempotency-Key: <key>`, we cache the response keyed
-- by (merchant_id, key). A second request with the SAME key + SAME body
-- returns the cached response. A second request with the SAME key +
-- DIFFERENT body returns a 409 idempotency conflict.
--
-- Stored: status code + JSON body. TTL handled by a cleanup function the
-- caller may schedule (24h is a reasonable retention; Stripe uses 24h).

create table if not exists public.idempotency_keys (
  merchant_id     uuid        not null references public.profiles(id) on delete cascade,
  key             text        not null check (length(key) between 1 and 255),
  request_hash    text        not null,
  response_status int         not null,
  response_body   jsonb       not null,
  created_at      timestamptz not null default now(),
  primary key (merchant_id, key)
);

create index if not exists idempotency_keys_created_at_idx
  on public.idempotency_keys (created_at);

alter table public.idempotency_keys enable row level security;
-- No policies => default-deny. Service-role only.

revoke all on table public.idempotency_keys from anon, authenticated, public;

-- Cleanup helper: delete rows older than 24h. Schedule via pg_cron later if
-- the table grows; for now, manual / on-demand.
create or replace function public.cleanup_idempotency_keys()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted int;
begin
  delete from public.idempotency_keys
   where created_at < now() - interval '24 hours';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke execute on function public.cleanup_idempotency_keys() from anon, authenticated, public;
