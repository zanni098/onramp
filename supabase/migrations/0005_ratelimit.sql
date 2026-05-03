-- 0005_ratelimit.sql
-- Postgres-backed token bucket. Atomic via advisory locks per key.

create table if not exists public.rate_limit_buckets (
  key            text primary key,
  window_start   timestamptz not null default now(),
  count          int         not null default 0,
  updated_at     timestamptz not null default now()
);

-- Service role only.
alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from anon, authenticated;

-- Atomic consume. Returns (allowed boolean, remaining int).
create or replace function public.rl_consume(
  p_key text,
  p_max int,
  p_window_seconds int
)
returns table (allowed boolean, remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now    timestamptz := now();
  v_row    public.rate_limit_buckets%rowtype;
  v_lock   bigint;
begin
  -- Hash key to a 64-bit advisory lock id; collisions don't matter for safety.
  v_lock := ('x' || substr(md5(p_key), 1, 16))::bit(64)::bigint;
  perform pg_advisory_xact_lock(v_lock);

  select * into v_row from public.rate_limit_buckets where key = p_key for update;

  if not found then
    insert into public.rate_limit_buckets (key, window_start, count)
      values (p_key, v_now, 1)
      returning * into v_row;
    return query select true, p_max - 1;
    return;
  end if;

  -- If window expired, reset.
  if v_now - v_row.window_start > make_interval(secs => p_window_seconds) then
    update public.rate_limit_buckets
       set window_start = v_now,
           count        = 1,
           updated_at   = v_now
     where key = p_key
     returning * into v_row;
    return query select true, p_max - 1;
    return;
  end if;

  if v_row.count >= p_max then
    return query select false, 0;
    return;
  end if;

  update public.rate_limit_buckets
     set count = count + 1,
         updated_at = v_now
   where key = p_key
   returning * into v_row;

  return query select true, p_max - v_row.count;
end;
$$;
