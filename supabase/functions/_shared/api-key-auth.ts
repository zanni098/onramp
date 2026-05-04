// API-key authentication for the public REST API.
//
// Auth header:   Authorization: Bearer sk_live_<...>   (live mode)
//                Authorization: Bearer sk_test_<...>   (test mode)
//
// Looked up against the matching column on merchant_secrets:
//   sk_live_<...> -> merchant_secrets.secret_key
//   sk_test_<...> -> merchant_secrets.test_secret_key
//
// Test mode runs on Solana devnet + Polygon Amoy; merchants use it to
// integrate without spending real money. Both keys for the same merchant
// resolve to the same merchant_id; the `isTest` flag is what downstream
// routing keys off (token mint, RPC URL, is_test flag on persisted rows).

import { db } from './db.ts';
import { apiError } from './api-error.ts';

export type ApiAuth = { merchantId: string; isTest: boolean };

export async function requireApiKey(req: Request): Promise<ApiAuth | Response> {
  const auth =
    req.headers.get('authorization') ?? req.headers.get('Authorization');

  if (!auth || !/^bearer\s+/i.test(auth)) {
    return apiError(
      'authentication_error',
      'missing_api_key',
      'No API key provided. Pass `Authorization: Bearer sk_live_...` or `sk_test_...`.',
      401,
    );
  }
  const key = auth.replace(/^bearer\s+/i, '').trim();

  const isTest = key.startsWith('sk_test_');
  const isLive = key.startsWith('sk_live_');
  if (!isTest && !isLive) {
    return apiError(
      'authentication_error',
      'invalid_api_key',
      'Invalid API key format. Expected sk_live_... or sk_test_...',
      401,
    );
  }
  if (key.length > 128) {
    return apiError('authentication_error', 'invalid_api_key', 'Invalid API key.', 401);
  }

  const column = isTest ? 'test_secret_key' : 'secret_key';

  const supabase = db();
  const { data, error } = await supabase
    .from('merchant_secrets')
    .select(`merchant_id, ${column}`)
    .eq(column, key)
    .maybeSingle();

  if (error) {
    console.error('api key lookup failed', error.message);
    return apiError('api_error', 'auth_lookup_failed', 'Could not validate API key.', 500);
  }
  if (!data) {
    return apiError('authentication_error', 'invalid_api_key', 'Invalid API key provided.', 401);
  }
  // deno-lint-ignore no-explicit-any
  const stored = (data as any)[column] as string;
  if (!constantTimeEq(stored, key)) {
    return apiError('authentication_error', 'invalid_api_key', 'Invalid API key provided.', 401);
  }

  return { merchantId: data.merchant_id, isTest };
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
