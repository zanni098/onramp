-- 0017_backfill_orphan_merchants.sql
--
-- Accounts created BEFORE the 0007 signup trigger (or while it was broken)
-- have no profiles row, a profiles row with NULL public_key, and/or no
-- merchant_secrets row. Symptom in the dashboard: "Public Key —" and a
-- `not_found` toast from get-merchant-secrets.
--
-- This backfills every orphan with server-generated credentials using the
-- exact same generation scheme as the current handle_new_user trigger
-- (0015 revision: secret_key + test_secret_key + webhook_secret).

-- 1. Profiles missing entirely.
insert into public.profiles (id, business_name, public_key)
select
  u.id,
  nullif(
    regexp_replace(
      coalesce(u.raw_user_meta_data->>'business_name', ''),
      '[\u0000-\u001f\u007f]', '', 'g'
    ),
    ''
  ),
  'pk_live_' || encode(extensions.gen_random_bytes(16), 'hex')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 2. Profiles that exist but never got a public key.
update public.profiles
   set public_key = 'pk_live_' || encode(extensions.gen_random_bytes(16), 'hex')
 where public_key is null;

-- 3. Merchants without a secrets row.
insert into public.merchant_secrets (merchant_id, secret_key, test_secret_key, webhook_secret)
select
  p.id,
  'sk_live_' || encode(extensions.gen_random_bytes(32), 'hex'),
  'sk_test_' || encode(extensions.gen_random_bytes(32), 'hex'),
  'whsec_'   || encode(extensions.gen_random_bytes(32), 'hex')
from public.profiles p
left join public.merchant_secrets s on s.merchant_id = p.id
where s.merchant_id is null;
