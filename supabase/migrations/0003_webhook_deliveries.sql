-- 0003_webhook_deliveries.sql
-- Queue + audit log for outbound webhook deliveries to merchants.

create table if not exists public.webhook_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  merchant_id        uuid not null references public.profiles(id) on delete cascade,
  event              text not null,
  payload            jsonb not null,
  url                text not null,

  status             text not null default 'queued'
                     check (status in ('queued','delivering','delivered','failed')),
  attempt_count      int  not null default 0,
  next_attempt_at    timestamptz not null default now(),

  signature          text,                       -- HMAC-SHA256 hex of last attempt
  last_status_code   int,
  last_error         text,
  delivered_at       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists webhook_deliveries_due_idx
  on public.webhook_deliveries (status, next_attempt_at)
  where status in ('queued','delivering');

create index if not exists webhook_deliveries_merchant_idx
  on public.webhook_deliveries (merchant_id, created_at desc);

alter table public.webhook_deliveries enable row level security;

-- Merchants may read their own delivery history. No client writes.
create policy webhook_deliveries_select_own
  on public.webhook_deliveries
  for select
  to authenticated
  using (merchant_id = auth.uid());

revoke insert, update, delete on public.webhook_deliveries from anon, authenticated;
