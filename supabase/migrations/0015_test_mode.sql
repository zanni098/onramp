-- 0015_test_mode.sql
--
-- Test mode. Merchants now hold TWO API keys:
--   secret_key      — sk_live_<...>  (mainnet, real money)
--   test_secret_key — sk_test_<...>  (Solana devnet / Polygon Amoy)
--
-- Sessions, transactions, and webhook deliveries all carry an `is_test`
-- flag, frozen at creation time. Verify-payment and the dispatcher honour
-- the flag to pick the correct RPC + token mint per row. Webhook payloads
-- expose this as `livemode: <boolean>`.
--
-- Same merchant wallet addresses are used in both modes (a keypair derives
-- the same address regardless of cluster on both Solana and EVM).

-- 1. Add test_secret_key column to merchant_secrets.
alter table public.merchant_secrets
  add column if not exists test_secret_key text;

-- 2. Backfill: generate a fresh sk_test_<64hex> for every existing merchant
--    that doesn't have one.
update public.merchant_secrets
   set test_secret_key = 'sk_test_' || encode(extensions.gen_random_bytes(32), 'hex')
 where test_secret_key is null;

alter table public.merchant_secrets
  alter column test_secret_key set not null;

-- 3. Uniqueness across BOTH key namespaces. We can't enforce a single
--    UNIQUE across both columns, but each must be globally unique on its
--    own column, and the two prefixes (sk_live_ / sk_test_) guarantee
--    cross-column distinctness by construction.
create unique index if not exists merchant_secrets_test_secret_key_uq
  on public.merchant_secrets (test_secret_key);

-- 4. is_test flag on payment-bearing tables.
alter table public.checkout_sessions
  add column if not exists is_test boolean not null default false;

alter table public.transactions
  add column if not exists is_test boolean not null default false;

alter table public.webhook_deliveries
  add column if not exists is_test boolean not null default false;

-- 5. Trigger handle_new_user already exists (migration 0007 + 0009). Patch
--    it to also set test_secret_key on signup so future merchants are born
--    with both keys.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, business_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'business_name', 'merchant'))
  on conflict (id) do nothing;

  insert into public.merchant_secrets (
    merchant_id, secret_key, test_secret_key, webhook_secret
  ) values (
    new.id,
    'sk_live_' || encode(extensions.gen_random_bytes(32), 'hex'),
    'sk_test_' || encode(extensions.gen_random_bytes(32), 'hex'),
    encode(extensions.gen_random_bytes(32), 'hex')
  )
  on conflict (merchant_id) do nothing;

  return new;
end;
$$;

-- Re-revoke (was set in 0010). Re-asserting because CREATE OR REPLACE
-- preserves grants but we want to be defensive.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- 6. Index for is_test filtering. Queries like "list confirmed live txns"
--    are common; cheap partial-index keeps live-mode dashboards fast even
--    when test data dominates.
create index if not exists transactions_merchant_live_idx
  on public.transactions (merchant_id, created_at desc)
  where is_test = false;

create index if not exists checkout_sessions_merchant_live_idx
  on public.checkout_sessions (merchant_id, created_at desc)
  where is_test = false;
