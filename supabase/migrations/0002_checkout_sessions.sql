-- 0002_checkout_sessions.sql
-- Introduces the canonical payment lifecycle record + state machine constraints,
-- demotes `transactions` to a confirmed-payments ledger, and revokes write
-- privileges from anon/authenticated so only the service role can mutate
-- payment state.

------------------------------------------------------------------------------
-- 1. checkout_sessions: the source of truth for "someone is paying for X"
------------------------------------------------------------------------------

create table if not exists public.checkout_sessions (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products(id) on delete restrict,
  merchant_id        uuid not null references public.profiles(id) on delete restrict,

  -- Frozen at creation. Never read live from `products` / `profiles` again.
  amount_minor       bigint not null check (amount_minor > 0), -- e.g. USD cents * 10000
  currency           text   not null default 'USD',
  network            text   not null check (network in ('solana','polygon')),
  token              text   not null check (token   in ('USDC','USDT')),
  token_mint         text   not null,                          -- chain-specific id
  destination        text   not null,                          -- merchant wallet, frozen
  reference          text   not null unique,                   -- on-chain binding tag

  status             text   not null default 'awaiting_payment'
                     check (status in ('awaiting_payment','confirming','confirmed','failed','expired')),

  payer_address      text,
  tx_hash            text,
  confirmed_at       timestamptz,
  failure_reason     text,

  expires_at         timestamptz not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists checkout_sessions_status_idx
  on public.checkout_sessions (status, expires_at);

create index if not exists checkout_sessions_destination_idx
  on public.checkout_sessions (network, destination, status);

create unique index if not exists checkout_sessions_tx_hash_uidx
  on public.checkout_sessions (network, tx_hash)
  where tx_hash is not null;

------------------------------------------------------------------------------
-- 2. State-machine trigger: enforce legal transitions in the database itself.
--    Defense in depth — the Edge Function also enforces this.
------------------------------------------------------------------------------

create or replace function public.checkout_sessions_enforce_transition()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'UPDATE') then
    -- Allowed transitions:
    --   awaiting_payment -> confirming | failed | expired
    --   confirming       -> confirmed  | failed | expired
    --   confirmed/failed/expired -> (terminal, no further changes)
    if old.status = new.status then
      -- no-op status change; allow other column updates
      new.updated_at := now();
      return new;
    end if;

    if old.status in ('confirmed','failed','expired') then
      raise exception 'checkout_session % is terminal (status=%); cannot transition to %',
        old.id, old.status, new.status;
    end if;

    if old.status = 'awaiting_payment'
       and new.status not in ('confirming','failed','expired') then
      raise exception 'illegal transition % -> %', old.status, new.status;
    end if;

    if old.status = 'confirming'
       and new.status not in ('confirmed','failed','expired') then
      raise exception 'illegal transition % -> %', old.status, new.status;
    end if;

    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists checkout_sessions_transition on public.checkout_sessions;
create trigger checkout_sessions_transition
  before update on public.checkout_sessions
  for each row execute function public.checkout_sessions_enforce_transition();

------------------------------------------------------------------------------
-- 3. Audit log of state transitions (for disputes / debugging).
------------------------------------------------------------------------------

create table if not exists public.checkout_session_events (
  id          bigserial primary key,
  session_id  uuid not null references public.checkout_sessions(id) on delete cascade,
  from_status text,
  to_status   text not null,
  reason      text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create or replace function public.checkout_sessions_log_event()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.checkout_session_events (session_id, from_status, to_status)
    values (new.id, null, new.status);
  elsif (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    insert into public.checkout_session_events
      (session_id, from_status, to_status, reason)
    values (new.id, old.status, new.status, new.failure_reason);
  end if;
  return new;
end;
$$;

drop trigger if exists checkout_sessions_log on public.checkout_sessions;
create trigger checkout_sessions_log
  after insert or update on public.checkout_sessions
  for each row execute function public.checkout_sessions_log_event();

------------------------------------------------------------------------------
-- 4. transactions: ledger of *confirmed* on-chain payments.
--    Add the constraints we need for idempotency.
------------------------------------------------------------------------------

-- Bring the schema in line. These statements are written defensively so they
-- can be re-run on the existing prod DB.
alter table public.transactions
  add column if not exists session_id   uuid references public.checkout_sessions(id),
  add column if not exists amount_minor bigint,
  add column if not exists token_mint   text,
  add column if not exists confirmed_at timestamptz;

-- Idempotency: a given on-chain tx can only ever appear once.
create unique index if not exists transactions_network_tx_hash_uidx
  on public.transactions (network, tx_hash)
  where tx_hash is not null;

-- Status enum lockdown.
alter table public.transactions
  drop constraint if exists transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check
  check (status in ('confirmed','failed'));

------------------------------------------------------------------------------
-- 5. RLS lockdown: no client may write to payment state. Period.
------------------------------------------------------------------------------

alter table public.checkout_sessions enable row level security;
alter table public.checkout_session_events enable row level security;
alter table public.transactions enable row level security;

-- Nuke any prior permissive policies so we start clean.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('checkout_sessions','checkout_session_events','transactions')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- checkout_sessions:
--   - anon / authenticated may SELECT a session by id (the customer needs to poll it).
--     We rely on the unguessable uuid as the capability token.
--   - NO client INSERT/UPDATE/DELETE. Only service_role.
create policy checkout_sessions_select_public
  on public.checkout_sessions
  for select
  to anon, authenticated
  using (true);

-- transactions:
--   - merchants can read their own confirmed transactions.
--   - NO client writes.
create policy transactions_select_own
  on public.transactions
  for select
  to authenticated
  using (merchant_id = auth.uid());

-- service_role bypasses RLS by default; nothing else to do.

-- Revoke any lingering direct grants on these tables from anon/authenticated.
revoke insert, update, delete on public.checkout_sessions       from anon, authenticated;
revoke insert, update, delete on public.checkout_session_events from anon, authenticated;
revoke insert, update, delete on public.transactions            from anon, authenticated;

------------------------------------------------------------------------------
-- 6. products: switch to integer-minor pricing without breaking existing rows.
------------------------------------------------------------------------------

alter table public.products
  add column if not exists price_minor bigint,
  add column if not exists active      boolean not null default true,
  add column if not exists currency    text    not null default 'USD';

-- Backfill price_minor from legacy price_usd if present (USD cents * 10000 == 6dp)
update public.products
  set price_minor = round(price_usd * 1000000)::bigint
  where price_minor is null and price_usd is not null;

------------------------------------------------------------------------------
-- 7. merchant_secrets: secrets out of profiles, off the client read path.
------------------------------------------------------------------------------

create table if not exists public.merchant_secrets (
  merchant_id      uuid primary key references public.profiles(id) on delete cascade,
  secret_key       text not null,        -- API secret, plaintext (rotate via RPC)
  webhook_secret   text not null,        -- HMAC key for webhook signatures
  created_at       timestamptz not null default now(),
  rotated_at       timestamptz not null default now()
);

alter table public.merchant_secrets enable row level security;
-- No policies => no client access. Service role only.

-- Migrate existing secrets out of profiles, then drop the columns from the
-- client-readable view in a later migration.
insert into public.merchant_secrets (merchant_id, secret_key, webhook_secret)
  select id, coalesce(secret_key, encode(gen_random_bytes(32),'hex')),
            coalesce(webhook_secret, encode(gen_random_bytes(32),'hex'))
  from public.profiles
  on conflict (merchant_id) do nothing;
