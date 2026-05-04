// Stripe-style Idempotency-Key support.
//
// When a POST endpoint receives `Idempotency-Key: <key>`, we:
//   1. Compute a SHA-256 hash of (method, path, body).
//   2. Look up (merchant_id, key) in idempotency_keys.
//   3. If miss      -> caller proceeds; on success, store (status, body).
//      If hit+match -> return cached response.
//      If hit+diff  -> 409 idempotency_error (same key, different body).
//
// Race notes: storage is best-effort INSERT (PK is (merchant_id, key)).
// Two concurrent requests with the same key + same body race to insert;
// whichever loses the PK race silently fails and the cached row from the
// winner serves both clients on the next read. Two concurrent requests
// with same key + DIFFERENT body race; loser still completes its action,
// but a third request with that key will see the winner's hash and 409.
// This is the same trade-off Stripe documents.

import { db } from './db.ts';

const MAX_KEY_LEN = 255;

export type CachedResponse = { status: number; body: unknown };

export type IdempotencyCheck =
  | { kind: 'miss' }
  | { kind: 'hit'; response: CachedResponse }
  | { kind: 'conflict' };

export function isValidIdempotencyKey(key: string): boolean {
  return key.length >= 1 && key.length <= MAX_KEY_LEN;
}

export async function hashRequest(
  method: string,
  path: string,
  body: string,
): Promise<string> {
  const buf = new TextEncoder().encode(`${method} ${path}\n${body}`);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function checkIdempotency(
  merchantId: string,
  key: string,
  requestHash: string,
): Promise<IdempotencyCheck> {
  const supabase = db();
  const { data, error } = await supabase
    .from('idempotency_keys')
    .select('request_hash, response_status, response_body')
    .eq('merchant_id', merchantId)
    .eq('key', key)
    .maybeSingle();
  if (error) {
    // Treat lookup error as miss; better to occasionally double-execute than
    // to refuse all writes during a transient DB blip.
    console.warn('idempotency lookup failed; treating as miss', error.message);
    return { kind: 'miss' };
  }
  if (!data) return { kind: 'miss' };
  if (data.request_hash !== requestHash) return { kind: 'conflict' };
  return {
    kind: 'hit',
    response: {
      status: data.response_status,
      body: data.response_body,
    },
  };
}

export async function storeIdempotency(
  merchantId: string,
  key: string,
  requestHash: string,
  status: number,
  body: unknown,
): Promise<void> {
  const supabase = db();
  // Best effort. PK collision = some other in-flight request stored first;
  // either way the cache is now warm.
  const { error } = await supabase.from('idempotency_keys').insert({
    merchant_id: merchantId,
    key,
    request_hash: requestHash,
    response_status: status,
    response_body: body,
  });
  if (error && !/duplicate key/i.test(error.message)) {
    console.warn('idempotency store failed', error.message);
  }
}
