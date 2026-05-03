-- 0009_fix_signup_trigger_search_path.sql
--
-- Migration 0007 set `search_path = public, pg_temp` on handle_new_user for
-- security, but pgcrypto lives in the `extensions` schema on Supabase
-- (not `public`). As a result every signup failed with:
--
--   ERROR: function gen_random_bytes(integer) does not exist (SQLSTATE 42883)
--   "Database error saving new user"
--
-- Fix by schema-qualifying every extension function call so the locked
-- search_path stays locked (defense against search_path attacks) while
-- still resolving the symbol.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_name  text;
  v_public_key     text;
  v_secret_key     text;
  v_webhook_secret text;
begin
  v_business_name := nullif(
    regexp_replace(
      coalesce(new.raw_user_meta_data->>'business_name', ''),
      '[\u0000-\u001f\u007f]', '', 'g'
    ),
    ''
  );
  if v_business_name is not null and char_length(v_business_name) > 80 then
    v_business_name := substring(v_business_name from 1 for 80);
  end if;

  v_public_key     := 'pk_live_' || encode(extensions.gen_random_bytes(16), 'hex');
  v_secret_key     := 'sk_live_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_webhook_secret := 'whsec_'   || encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.profiles (id, business_name, public_key)
  values (new.id, v_business_name, v_public_key)
  on conflict (id) do nothing;

  insert into public.merchant_secrets (merchant_id, secret_key, webhook_secret)
  values (new.id, v_secret_key, v_webhook_secret)
  on conflict (merchant_id) do nothing;

  return new;
end;
$$;
