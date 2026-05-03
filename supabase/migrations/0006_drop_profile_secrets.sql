-- 0006_drop_profile_secrets.sql
-- Apply ONLY after the dashboard has been updated to read secrets via the
-- get-merchant-secrets / rotate-webhook-secret Edge Functions (Step 7).
--
-- This is the point of no return: secrets stop being readable from the
-- browser. From here on, only service-role code in Edge Functions can read
-- merchant_secrets, and rotation is a server-only concern.

-- Sanity: ensure migration 0002 already populated merchant_secrets.
do $$
declare
  v_orphans int;
begin
  select count(*) into v_orphans
  from public.profiles p
  left join public.merchant_secrets s on s.merchant_id = p.id
  where s.merchant_id is null;
  if v_orphans > 0 then
    raise exception
      'Refusing to drop profile secrets: % profiles have no merchant_secrets row',
      v_orphans;
  end if;
end $$;

alter table public.profiles
  drop column if exists secret_key,
  drop column if exists webhook_secret;

-- public_key stays on profiles — it's not secret.

-- Tighten RLS on profiles.update so authenticated merchants can no longer
-- write the columns we now treat as server-validated. We do this by replacing
-- the catch-all UPDATE policy (if any) with a narrow one that only allows
-- updating columns the merchant is permitted to set directly. Anything
-- requiring server validation (wallets, webhook_url, business_name) goes
-- through the update-merchant-config Edge Function.

-- Drop existing UPDATE policies on profiles (defensive).
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE'
  loop
    execute format('drop policy %I on public.profiles', r.policyname);
  end loop;
end $$;

-- No client UPDATE on profiles. All writes go through Edge Functions.
revoke insert, update, delete on public.profiles from anon, authenticated;

-- (SELECT remains: a merchant can read their own row. RLS policy below.)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles'
      and policyname='profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      to authenticated
      using (id = auth.uid());
  end if;
end $$;
