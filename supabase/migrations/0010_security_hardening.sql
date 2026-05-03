-- 0010_security_hardening.sql
--
-- Addresses the Supabase security advisor findings after the main production
-- deploy. None of these are active exploits — most are defense-in-depth on
-- surfaces that are already RLS-locked. But each one narrows the blast
-- radius if something else goes wrong.
--
-- Items:
--   1. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authed.
--      These were auto-granted by Postgres when the functions were created in
--      the `public` schema and PostgREST exposes them as RPC endpoints.
--   2. Lock search_path on existing SECURITY DEFINER / trigger functions so
--      they can't be hijacked by a crafted search_path at call time.
--   3. Revoke SELECT on tables that have no business being readable by
--      anon or any signed-in user other than the owning merchant. These
--      were already blocked by RLS-with-no-policy (fail-closed), but this
--      also removes them from the auto-generated GraphQL schema.
--   4. Add a merchant-scoped read policy on `checkout_session_events` so
--      the dashboard can render a real event timeline.

-- ---------------------------------------------------------------------------
-- 1. Revoke EXECUTE on SECURITY DEFINER functions
-- ---------------------------------------------------------------------------
-- handle_new_user: trigger on auth.users. Calling as RPC would deref NULL
--   NEW and error anyway, but there's no reason to expose it at all.
-- invoke_webhook_dispatcher: intended to be called only by pg_cron
--   (which runs as the postgres role). Calling it as anon/authed lets a
--   stranger trigger arbitrary pg_net HTTP calls.
-- rl_consume: only our Edge Functions (service_role) should consume the
--   token bucket. Anon callers could drain another party's bucket.

revoke execute on function public.handle_new_user()
  from anon, authenticated, public;

revoke execute on function public.invoke_webhook_dispatcher()
  from anon, authenticated, public;

revoke execute on function public.rl_consume(text, integer, integer)
  from anon, authenticated, public;

-- The trigger still fires (postgres owns it and the trigger runs regardless
-- of EXECUTE grants on the function body). Cron still invokes the
-- dispatcher (runs as postgres). Edge Functions use service_role.

-- ---------------------------------------------------------------------------
-- 2. Lock search_path on existing functions
-- ---------------------------------------------------------------------------
-- pg_net objects live in the `net` schema on Supabase; pg_cron in `cron`;
-- pgcrypto in `extensions`. We have to include these so dispatcher can
-- resolve net.http_post.

alter function public.checkout_sessions_enforce_transition()
  set search_path = public, pg_temp;

alter function public.checkout_sessions_log_event()
  set search_path = public, pg_temp;

alter function public.invoke_webhook_dispatcher()
  set search_path = public, pg_temp, extensions, net, cron;

-- ---------------------------------------------------------------------------
-- 3. Tighten direct table grants (removes GraphQL schema visibility too)
-- ---------------------------------------------------------------------------
-- merchant_secrets: read only via the get-merchant-secrets Edge Function.
-- rate_limit_buckets: internal to rl_consume; never touched by clients.
-- checkout_session_events: the merchant reads their own events through
--   the policy added below, and nobody else needs access.

revoke select on public.merchant_secrets       from anon, authenticated;
revoke select on public.rate_limit_buckets     from anon, authenticated;
revoke select on public.checkout_session_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Add a read policy so merchants can see their own session events
-- ---------------------------------------------------------------------------
-- Grant SELECT back to `authenticated` *only* via a policy that scopes to
-- the calling user's merchant_id. Without this, even the owning merchant
-- can't see their event timeline (RLS-on + no-policy = deny-all).

grant select on public.checkout_session_events to authenticated;

drop policy if exists "merchants read own events" on public.checkout_session_events;
create policy "merchants read own events"
  on public.checkout_session_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.checkout_sessions s
      where s.id = checkout_session_events.session_id
        and s.merchant_id = auth.uid()
    )
  );
