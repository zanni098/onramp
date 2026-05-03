-- 0007_signup_trigger.sql
--
-- Server-side merchant onboarding. Replaces the unsafe client-side flow where
-- Register.tsx generated "secrets" with `crypto.randomUUID()` and inserted
-- them directly into `profiles` — a path that lets a malicious signup pick
-- arbitrary secret values and that breaks entirely once 0006 drops those
-- columns from `profiles`.
--
-- After this migration:
--   - profiles row is created automatically on auth.users insert.
--   - public_key is server-generated.
--   - merchant_secrets row (secret_key, webhook_secret) is server-generated
--     using pgcrypto's gen_random_bytes (cryptographically strong).
--   - business_name is taken from raw_user_meta_data.business_name and
--     sanitized server-side.
--   - Nothing else from raw_user_meta_data is trusted.
--
-- The trigger runs SECURITY DEFINER with a locked search_path so it cannot
-- be hijacked by a search_path attack from a malicious caller.

create extension if not exists pgcrypto;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_name text;
  v_public_key    text;
  v_secret_key    text;
  v_webhook_secret text;
begin
  -- Only the business_name is trusted from user metadata, and only after
  -- sanitization. Everything else is server-generated.
  v_business_name := nullif(
    regexp_replace(
      coalesce(new.raw_user_meta_data->>'business_name', ''),
      -- Strip control chars (0x00-0x1F, 0x7F).
      '[\u0000-\u001f\u007f]', '', 'g'
    ),
    ''
  );
  if v_business_name is not null and char_length(v_business_name) > 80 then
    v_business_name := substring(v_business_name from 1 for 80);
  end if;

  v_public_key     := 'pk_live_' || encode(gen_random_bytes(16), 'hex');
  v_secret_key     := 'sk_live_' || encode(gen_random_bytes(32), 'hex');
  v_webhook_secret := 'whsec_'   || encode(gen_random_bytes(32), 'hex');

  insert into public.profiles (id, business_name, public_key)
  values (new.id, v_business_name, v_public_key)
  on conflict (id) do nothing;

  insert into public.merchant_secrets (merchant_id, secret_key, webhook_secret)
  values (new.id, v_secret_key, v_webhook_secret)
  on conflict (merchant_id) do nothing;

  return new;
end;
$$;

-- Drop any existing trigger of this name (defensive — Supabase projects
-- often have a stub `on_auth_user_created` trigger from initial setup).
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Only the trigger function (running as definer) and the service role can
-- insert into profiles or merchant_secrets. Migration 0006 already revoked
-- direct writes from anon/authenticated; reaffirm.
revoke insert on public.profiles         from anon, authenticated;
revoke insert on public.merchant_secrets from anon, authenticated;
