// Auth helper for Edge Functions: extract the merchant user_id from the
// caller's JWT. Functions deployed with verify_jwt=true (the Supabase
// default) already reject invalid tokens at the gateway, but we still need
// to know WHICH merchant is calling.

import { createClient } from 'jsr:@supabase/supabase-js@2';

export async function requireMerchant(req: Request): Promise<{ userId: string } | Response> {
  const auth = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const jwt = auth.slice('Bearer '.length);

  // Use the anon key + caller's JWT to resolve the user.
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(jwt);
  if (error || !data.user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  return { userId: data.user.id };
}

export function clientIp(req: Request): string {
  // Supabase / typical proxies set x-forwarded-for. Fall back to "unknown".
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const first = xff.split(',')[0].trim();
  return first || req.headers.get('x-real-ip') || 'unknown';
}
