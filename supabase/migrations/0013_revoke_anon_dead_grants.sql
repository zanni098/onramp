-- 0013_revoke_anon_dead_grants.sql
--
-- Defense-in-depth cleanup. RLS already denies these reads/writes (anon has
-- no matching policies, default-deny), but the leftover table grants trip
-- supabase advisor warnings (pg_graphql_anon_table_exposed) and are
-- inconsistent with the documented "anon has zero rights on payment tables"
-- security model. REVOKE-only migration: pure tightening, no functional change.
--
-- Verified before applying:
--   * transactions / webhook_deliveries: read by SPA only via authenticated
--     session; never accessed with anon key.
--   * products: public checkout reads via SECURITY DEFINER RPC
--     get_product_for_checkout(uuid); dashboard writes use authenticated.

revoke select on table public.transactions      from anon;
revoke select on table public.webhook_deliveries from anon;

revoke insert, update, delete on table public.products from anon;
