// Postgres-backed token-bucket rate limiter for Edge Functions.
//
// Backed by the rl_consume(p_key, p_max, p_window_seconds) RPC defined in
// migration 0005_ratelimit.sql. The RPC is atomic (advisory lock + upsert),
// safe under concurrent invocation.

import { db } from './db.ts';

export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = db();
  const { data, error } = await supabase.rpc('rl_consume', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Fail OPEN on rate-limiter outage. (Failing closed would let an attacker
    // DoS the rate limiter to lock everyone out. Log loudly instead.)
    console.warn('rate limiter error, failing open:', error.message);
    return { allowed: true, remaining: max };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: !!row?.allowed,
    remaining: typeof row?.remaining === 'number' ? row.remaining : 0,
  };
}
