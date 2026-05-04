-- Phase 3: email receipts via Resend.
--
-- Goal: when a payment confirms, we send up to 2 emails:
--   1. customer receipt    — only if checkout_sessions.customer_email is set
--   2. merchant notification — always (uses auth.users.email of the owner)
--
-- Design mirrors webhook_deliveries: durable queue, exponential backoff,
-- drained by the same cron as webhook-dispatcher (no new EF, no new cron).
-- Hard failures (4xx from Resend) are terminal; transient (5xx, network)
-- retry up to MAX_ATTEMPTS with jitter.

-- 1. customer_email on checkout_sessions ------------------------------------
alter table public.checkout_sessions
  add column if not exists customer_email text;

alter table public.checkout_sessions
  drop constraint if exists checkout_sessions_customer_email_format;
alter table public.checkout_sessions
  add constraint checkout_sessions_customer_email_format
  check (
    customer_email is null
    or (length(customer_email) <= 254 and customer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  );

-- IMPORTANT: do NOT expose customer_email via public/anon paths.
-- We update the SECURITY DEFINER RPC get_checkout_session below to omit it.

-- 2. email_deliveries queue --------------------------------------------------
create table if not exists public.email_deliveries (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references public.profiles(id) on delete cascade,
  session_id      uuid references public.checkout_sessions(id) on delete set null,
  -- Logical kind so the dispatcher can pick the right Resend template.
  -- 'customer_receipt'      -> sent to checkout_sessions.customer_email
  -- 'merchant_notification' -> sent to the auth user's email
  kind            text not null check (kind in ('customer_receipt', 'merchant_notification')),
  to_email        text not null check (length(to_email) <= 254),
  -- Pre-rendered subject/html/text. We render at enqueue-time so the cron
  -- doesn't need to re-derive amounts/decimals/etc later.
  subject         text not null,
  html            text not null,
  "text"          text not null,
  status          text not null default 'queued'
                    check (status in ('queued', 'sending', 'sent', 'failed')),
  attempt_count   int  not null default 0,
  last_status_code int,
  last_error      text,
  provider_id     text,                   -- Resend message id (if delivered)
  next_attempt_at timestamptz not null default now(),
  delivered_at    timestamptz,
  is_test         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Cron pickup index: fast lookup of the next due queued row.
create index if not exists email_deliveries_pickup_idx
  on public.email_deliveries (next_attempt_at)
  where status = 'queued';

-- Stale-delivering sweep index (mirrors webhook_deliveries layout).
create index if not exists email_deliveries_delivering_idx
  on public.email_deliveries (updated_at)
  where status = 'sending';

-- Per-merchant ops view.
create index if not exists email_deliveries_merchant_idx
  on public.email_deliveries (merchant_id, created_at desc);

-- updated_at auto-bump.
create or replace function public.tg_touch_email_deliveries()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_touch_email_deliveries on public.email_deliveries;
create trigger trg_touch_email_deliveries
  before update on public.email_deliveries
  for each row execute function public.tg_touch_email_deliveries();

-- Lock down: NO anon / authenticated grants. Only service-role touches this.
revoke all on public.email_deliveries from anon, authenticated;

-- 3. Refresh public-readable session RPC -----------------------------------
-- The RPC was created in 0011 (& touched in 0015). Drop & recreate with the
-- explicit column list — customer_email is intentionally absent so it never
-- leaks via the anon-callable getter on the checkout page.
drop function if exists public.get_checkout_session(uuid);
create function public.get_checkout_session(p_id uuid)
returns table (
  id uuid,
  product_id uuid,
  merchant_id uuid,
  amount_minor bigint,
  currency text,
  network text,
  token text,
  token_mint text,
  destination text,
  reference text,
  status text,
  expires_at timestamptz,
  tx_hash text,
  payer_address text,
  failure_reason text,
  confirmed_at timestamptz,
  is_test boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.product_id, s.merchant_id, s.amount_minor, s.currency, s.network,
    s.token, s.token_mint, s.destination, s.reference, s.status, s.expires_at,
    s.tx_hash, s.payer_address, s.failure_reason, s.confirmed_at, s.is_test,
    s.created_at, s.updated_at
  from public.checkout_sessions s
  where s.id = p_id;
$$;
grant execute on function public.get_checkout_session(uuid) to anon, authenticated;
