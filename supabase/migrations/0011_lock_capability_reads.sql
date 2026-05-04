-- 0011_lock_capability_reads.sql
--
-- Pre-deploy audit found three P0 issues all caused by the same shape of
-- policy: `for select to anon using (true)`. Postgres RLS cannot enforce
-- "must be queried by id"; PostgREST happily lets a holder of the public
-- anon key dump every row. The intended security model — "the unguessable
-- UUID is the capability token" — only works if anon CANNOT enumerate the
-- table.
--
-- Fix: remove direct anon SELECT on capability-token tables and expose
-- per-id getter RPCs. Each takes the UUID as an argument, runs as
-- SECURITY DEFINER (bypassing RLS), and returns at most one row. An
-- attacker without the id can read nothing.
--
-- Also:
--   - Customer Checkout.tsx today reads `profiles` directly to discover
--     which networks the merchant supports. Anon profiles SELECT is
--     blocked by RLS, so this read returns 0 rows and BOTH network
--     buttons are permanently disabled — i.e. checkout is broken for
--     unauthenticated visitors. We expose a privacy-preserving boolean
--     getter (`get_merchant_supported_networks`) instead of leaking the
--     actual wallet addresses to the world.
--   - Reaffirm RLS on payment-state tables and revoke any direct write
--     grants that survived earlier migrations (defense-in-depth; RLS
--     already denied them).
--   - Drop dead duplicate policies on `profiles` left over from earlier
--     migrations.

-- ---------------------------------------------------------------------------
-- 1. checkout_sessions: drop the dump policy; add owner-scoped policy;
--    expose by-id getter for the customer browser.
-- ---------------------------------------------------------------------------

drop policy if exists checkout_sessions_select_public on public.checkout_sessions;
revoke select on public.checkout_sessions from anon;

-- Authenticated merchants need to see their own sessions for the dashboard
-- "active checkouts" stat. Service role bypasses RLS so Edge Functions are
-- unaffected.
drop policy if exists checkout_sessions_select_own on public.checkout_sessions;
create policy checkout_sessions_select_own
  on public.checkout_sessions
  for select
  to authenticated
  using (merchant_id = auth.uid());

grant select on public.checkout_sessions to authenticated;

create or replace function public.get_checkout_session(p_id uuid)
returns table (
  id              uuid,
  status          text,
  network         text,
  token           text,
  amount_minor    bigint,
  reference       text,
  destination     text,
  payer_address   text,
  tx_hash         text,
  confirmed_at    timestamptz,
  failure_reason  text,
  expires_at      timestamptz,
  product_id      uuid
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    id, status, network, token, amount_minor, reference, destination,
    payer_address, tx_hash, confirmed_at, failure_reason, expires_at, product_id
  from public.checkout_sessions
  where id = p_id
  limit 1;
$$;

revoke all on function public.get_checkout_session(uuid) from public;
grant execute on function public.get_checkout_session(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. products: drop the public-read policy; expose by-id getter.
--    Authenticated merchants keep `products: owner access` for dashboard CRUD.
-- ---------------------------------------------------------------------------

drop policy if exists "products: public read" on public.products;
revoke select on public.products from anon;

create or replace function public.get_product_for_checkout(p_id uuid)
returns table (
  id           uuid,
  merchant_id  uuid,
  name         text,
  description  text,
  price_minor  bigint,
  price_usd    numeric,
  active       boolean
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  -- Only return rows that are actually purchasable; an inactive product
  -- shouldn't expose its own existence to anonymous callers.
  select id, merchant_id, name, description, price_minor, price_usd, active
  from public.products
  where id = p_id and active = true
  limit 1;
$$;

revoke all on function public.get_product_for_checkout(uuid) from public;
grant execute on function public.get_product_for_checkout(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. profiles: revoke anon SELECT (kept previously by accident).
--    Expose ONLY a boolean "which networks does this merchant support"
--    so the checkout page can disable the right button without the world
--    being able to enumerate every merchant's payout wallet addresses.
-- ---------------------------------------------------------------------------

revoke select on public.profiles from anon;

-- Drop dead duplicate policies — `profiles_select_own` (added later) covers
-- authenticated owner reads. The two below were left over from the initial
-- migration and have identical effect.
drop policy if exists "profiles: owner read"   on public.profiles;
drop policy if exists "profiles: owner insert" on public.profiles;

create or replace function public.get_merchant_supported_networks(p_id uuid)
returns table (
  has_solana   boolean,
  has_polygon  boolean
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    (solana_wallet  is not null and solana_wallet  <> '') as has_solana,
    (polygon_wallet is not null and polygon_wallet <> '') as has_polygon
  from public.profiles
  where id = p_id
  limit 1;
$$;

revoke all on function public.get_merchant_supported_networks(uuid) from public;
grant execute on function public.get_merchant_supported_networks(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. merchant_secrets: revoke writes from anon + authenticated.
--    RLS-with-no-policy already blocks them, but the lingering grants are
--    a footgun if anyone ever adds a policy by mistake.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on public.merchant_secrets from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Sanity checks (these should all be the post-fix expected values).
-- ---------------------------------------------------------------------------

do $$
declare
  v_anon_select_sessions boolean;
  v_anon_select_products boolean;
  v_anon_select_profiles boolean;
  v_anon_writes_secrets  boolean;
begin
  v_anon_select_sessions := has_table_privilege('anon', 'public.checkout_sessions', 'SELECT');
  v_anon_select_products := has_table_privilege('anon', 'public.products',          'SELECT');
  v_anon_select_profiles := has_table_privilege('anon', 'public.profiles',          'SELECT');
  v_anon_writes_secrets  := has_table_privilege('anon', 'public.merchant_secrets',  'INSERT,UPDATE,DELETE');

  if v_anon_select_sessions then
    raise exception 'POST-FIX SANITY: anon still has SELECT on checkout_sessions';
  end if;
  if v_anon_select_products then
    raise exception 'POST-FIX SANITY: anon still has SELECT on products';
  end if;
  if v_anon_select_profiles then
    raise exception 'POST-FIX SANITY: anon still has SELECT on profiles';
  end if;
  if v_anon_writes_secrets then
    raise exception 'POST-FIX SANITY: anon still has writes on merchant_secrets';
  end if;
end $$;
