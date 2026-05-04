// API-key authentication for the public REST API.
//
// Auth header:   Authorization: Bearer sk_live_<...>
//
// Looked up against merchant_secrets.secret_key. Constant-time string
// compare on the matched row as defense-in-depth (the eq() filter already
// requires an exact match, but treating credential compares as
// constant-time is the right habit).
//
// Test-mode keys (sk_test_) are NOT yet supported — they are explicitly
// rejected here so behaviour is loud and testable. Phase 2 of the API
// upgrade adds proper test mode (separate keys + devnet/Amoy routing).

import { db } from './db.ts';
import { apiError } from './api-error.ts';

export type ApiAuth = { merchantId: string };

export async function requireApiKey(req: Request): Promise<ApiAuth | Response> {
  const auth =
    req.headers.get('authorization') ?? req.headers.get('Authorization');

  if (!auth || !/^bearer\s+/i.test(auth)) {
    return apiError(
      'authentication_error',
      'missing_api_key',
      'No API key provided. Pass `Authorization: Bearer sk_live_...`.',
      401,
    );
  }
  const key = auth.replace(/^bearer\s+/i, '').trim();

  if (key.startsWith('sk_test_')) {
    return apiError(
      'authentication_error',
      'test_mode_unsupported',
      'Test mode keys are not yet supported. Use a live API key (sk_live_...).',
      401,
    );
  }
  if (!key.startsWith('sk_live_')) {
    return apiError(
      'authentication_error',
      'invalid_api_key',
      'Invalid API key format.',
      401,
    );
  }
  if (key.length > 128) {
    return apiError(
      'authentication_error',
      'invalid_api_key',
      'Invalid API key.',
      401,
    );
  }

  const supabase = db();
  const { data, error } = await supabase
    .from('merchant_secrets')
    .select('merchant_id, secret_key')
    .eq('secret_key', key)
    .maybeSingle();

  if (error) {
    console.error('api key lookup failed', error.message);
    return apiError(
      'api_error',
      'auth_lookup_failed',
      'Could not validate API key.',
      500,
    );
  }
  if (!data) {
    return apiError(
      'authentication_error',
      'invalid_api_key',
      'Invalid API key provided.',
      401,
    );
  }
  if (!constantTimeEq(data.secret_key, key)) {
    return apiError(
      'authentication_error',
      'invalid_api_key',
      'Invalid API key provided.',
      401,
    );
  }

  return { merchantId: data.merchant_id };
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
