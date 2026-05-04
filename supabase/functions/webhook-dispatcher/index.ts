// POST /functions/v1/webhook-dispatcher
//
// Cron-triggered. Drains the webhook_deliveries queue. Designed to be invoked
// every ~10s by Supabase pg_cron / Scheduled Triggers. Multiple concurrent
// invocations are safe — locking via `for update skip locked` ensures each
// delivery is owned by exactly one runner at a time.
//
// Responsibilities:
//   1. Pick up queued deliveries whose next_attempt_at <= now().
//   2. Load the merchant's webhook_secret from merchant_secrets (service-role only).
//   3. Sign payload with HMAC-SHA256.
//   4. POST with 5s timeout, dedup-friendly Idempotency-Key header.
//   5. On 2xx -> delivered. On hard 4xx -> failed (terminal). On retryable
//      error -> increment attempt_count and reschedule with exp backoff.
//
// Bonus: also runs catch-up verification on sessions stuck in 'confirming'
// (e.g. customer closed the tab during the poll). Same idempotent code path
// as verify-payment, so this never causes double-fires.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { json, preflight } from '../_shared/cors.ts';
import { signPayload, signatureHeader } from '../_shared/hmac.ts';
import { verifySolanaPayment } from '../_shared/verify-solana.ts';
import { verifyPolygonPayment } from '../_shared/verify-polygon.ts';
import { solanaRpcUrl, polygonRpcUrl } from '../_shared/rpc.ts';

const HTTP_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 12;
const BATCH_SIZE = 25;
const POLYGON_CONFIRMATIONS = 64;
// Anything stuck in `delivering` longer than this means the dispatcher run
// that claimed it crashed mid-fetch (Supabase Edge cold-kill, OOM, network
// blip, etc.). Sweep it back to `queued` so the next tick can retry.
const STALE_DELIVERING_AFTER_MS = 2 * 60 * 1000;

const HARD_FAIL_4XX = new Set([400, 401, 403, 404, 405, 410, 411, 413, 414, 415, 422, 451]);

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  // CRON_SECRET gate: if the env var is set, the caller must present the
  // matching `x-cron-secret` header. The pg_cron job (defined in the
  // database) is updated by migration 0012 to send this header. Manual
  // invocation by a human or attacker without the secret is rejected.
  // We fail open if the env var is unset — to keep dev / first-deploy
  // working until the secret is rolled out.
  const requiredSecret = Deno.env.get('CRON_SECRET');
  if (requiredSecret) {
    const presented = req.headers.get('x-cron-secret');
    if (presented !== requiredSecret) {
      return json({ error: 'forbidden' }, 403);
    }
  }

  const supabase = db();

  const result = {
    swept: await sweepStaleDelivering(supabase),
    deliveries: await drainDeliveries(supabase),
    catchup: await catchupConfirming(supabase),
  };

  return json(result);
});

// ---------------------------------------------------------------------------
// Stale-row sweep: a dispatcher run that crashes after flipping `queued ->
// delivering` but before completing the fetch leaves the row stuck. Reset
// any such rows so the next tick's drainDeliveries can claim them again.
// ---------------------------------------------------------------------------

async function sweepStaleDelivering(supabase: ReturnType<typeof db>) {
  const cutoff = new Date(Date.now() - STALE_DELIVERING_AFTER_MS).toISOString();
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .update({ status: 'queued', updated_at: new Date().toISOString() })
    .eq('status', 'delivering')
    .lt('updated_at', cutoff)
    .select('id');
  if (error) return { reset: 0, error: error.message };
  return { reset: data?.length ?? 0 };
}

// ---------------------------------------------------------------------------
// Webhook delivery drain
// ---------------------------------------------------------------------------

async function drainDeliveries(supabase: ReturnType<typeof db>) {
  // Atomically claim a batch by flipping queued -> delivering.
  //
  // We can't use `for update skip locked` directly via PostgREST, so we use
  // a service-role RPC-style update with `returning *`. To prevent multiple
  // dispatchers grabbing the same row, we restrict by status='queued' and
  // depend on Postgres row-level locks under the UPDATE.
  const nowIso = new Date().toISOString();

  // Step 1: pick candidate ids.
  const { data: candidates } = await supabase
    .from('webhook_deliveries')
    .select('id')
    .eq('status', 'queued')
    .lte('next_attempt_at', nowIso)
    .order('next_attempt_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (!candidates || candidates.length === 0) {
    return { picked: 0, delivered: 0, retried: 0, failed: 0 };
  }

  const ids = candidates.map((c) => c.id);

  // Step 2: claim them. Only those still 'queued' will flip; if another
  // dispatcher grabbed one, the count won't include it.
  const { data: claimed } = await supabase
    .from('webhook_deliveries')
    .update({ status: 'delivering', updated_at: nowIso })
    .in('id', ids)
    .eq('status', 'queued')
    .select('*');

  if (!claimed || claimed.length === 0) {
    return { picked: 0, delivered: 0, retried: 0, failed: 0 };
  }

  let delivered = 0, retried = 0, failed = 0;

  // Process serially within this invocation. (Cron runs frequently; we don't
  // need parallelism here, and serial keeps log noise readable.)
  for (const d of claimed) {
    const outcome = await deliverOne(supabase, d);
    if (outcome === 'delivered') delivered++;
    else if (outcome === 'retried') retried++;
    else failed++;
  }

  return { picked: claimed.length, delivered, retried, failed };
}

interface DeliveryRow {
  id: string;
  merchant_id: string;
  event: string;
  payload: unknown;
  url: string;
  attempt_count: number;
}

async function deliverOne(
  supabase: ReturnType<typeof db>,
  d: DeliveryRow,
): Promise<'delivered' | 'retried' | 'failed'> {
  // Look up the merchant's webhook secret. Stored in merchant_secrets, NOT
  // in any table the client can read.
  const { data: secrets } = await supabase
    .from('merchant_secrets')
    .select('webhook_secret')
    .eq('merchant_id', d.merchant_id)
    .single();

  if (!secrets?.webhook_secret) {
    await markFailed(supabase, d.id, 'no webhook_secret on file', null);
    return 'failed';
  }

  const body = JSON.stringify(d.payload);
  const ts = Math.floor(Date.now() / 1000);
  const sig = await signPayload(secrets.webhook_secret, body, ts);

  let statusCode: number | null = null;
  let errStr: string | null = null;

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
    try {
      const resp = await fetch(d.url, {
        method: 'POST',
        signal: ac.signal,
        // SSRF mitigation: do NOT follow redirects. The validator already
        // blocks loopback / RFC-1918 / metadata IPs at the URL string,
        // but a cooperating attacker could still register a public host
        // that 302-redirects into private space. Treat redirects as
        // delivery failures so the merchant has to fix their endpoint
        // rather than us silently proxying into their VPC.
        redirect: 'manual',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Onramp-Webhooks/1.0',
          'idempotency-key': d.id,
          'onramp-event': d.event,
          'onramp-signature': signatureHeader(ts, sig),
          'onramp-timestamp': String(ts),
        },
        body,
      });
      statusCode = resp.status;
      // A redirect response with redirect:'manual' arrives here as 0 (Deno)
      // or 3xx. Treat 3xx as a hard fail so the merchant sees it and fixes
      // their endpoint.
      if (statusCode >= 300 && statusCode < 400) {
        errStr = `merchant endpoint returned redirect ${statusCode}; SSRF guard rejects it`;
      }
      // Drain body to free the connection; ignore content.
      try { await resp.text(); } catch { /* ignore */ }
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    errStr = e instanceof Error ? e.message : String(e);
  }

  // Decide outcome.
  if (statusCode != null && statusCode >= 200 && statusCode < 300) {
    await supabase
      .from('webhook_deliveries')
      .update({
        status: 'delivered',
        attempt_count: d.attempt_count + 1,
        last_status_code: statusCode,
        last_error: null,
        signature: sig,
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', d.id);
    return 'delivered';
  }

  if (statusCode != null && HARD_FAIL_4XX.has(statusCode)) {
    await markFailed(supabase, d.id, `merchant returned ${statusCode}`, statusCode);
    return 'failed';
  }

  // 3xx responses are caught above as errStr; treat as hard fail (merchant
  // misconfiguration, not a transient issue worth retrying).
  if (statusCode != null && statusCode >= 300 && statusCode < 400) {
    await markFailed(supabase, d.id, errStr ?? `merchant returned ${statusCode}`, statusCode);
    return 'failed';
  }

  // Retryable: 5xx, 408, 425, 429, network/timeout.
  const nextAttempt = d.attempt_count + 1;
  if (nextAttempt >= MAX_ATTEMPTS) {
    await markFailed(
      supabase,
      d.id,
      `gave up after ${nextAttempt} attempts (${statusCode ?? errStr ?? 'unknown'})`,
      statusCode,
    );
    return 'failed';
  }

  const delayMs = backoffMs(nextAttempt);
  const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();

  await supabase
    .from('webhook_deliveries')
    .update({
      status: 'queued',
      attempt_count: nextAttempt,
      last_status_code: statusCode,
      last_error: errStr ?? `status ${statusCode}`,
      signature: sig,
      next_attempt_at: nextAttemptAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', d.id);

  return 'retried';
}

async function markFailed(
  supabase: ReturnType<typeof db>,
  id: string,
  reason: string,
  statusCode: number | null,
) {
  await supabase
    .from('webhook_deliveries')
    .update({
      status: 'failed',
      last_status_code: statusCode,
      last_error: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
}

// Exponential backoff with full jitter, capped.
//
//   attempt 1: ~1 min
//   attempt 2: ~2 min
//   attempt 3: ~4 min
//   ...
//   capped at 24h.
function backoffMs(attempt: number): number {
  const baseMin = Math.min(60 * Math.pow(2, attempt - 1), 24 * 60);
  const jitter = 0.8 + Math.random() * 0.4; // ±20%
  return Math.floor(baseMin * 60_000 * jitter);
}

// ---------------------------------------------------------------------------
// Catch-up verifier: any session stuck in 'confirming' that the client never
// finished polling for. Idempotent — uses the same logic as verify-payment.
// ---------------------------------------------------------------------------

async function catchupConfirming(supabase: ReturnType<typeof db>) {
  const { data: stuck } = await supabase
    .from('checkout_sessions')
    .select('*')
    .eq('status', 'confirming')
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: true })
    .limit(50);

  if (!stuck || stuck.length === 0) return { checked: 0, confirmed: 0, failed: 0 };

  let confirmed = 0, failed = 0;
  for (const s of stuck) {
    if (!s.tx_hash) continue;
    try {
      const result =
        s.network === 'solana'
          ? await verifySolanaPayment({
            txHash: s.tx_hash,
            expectedDestination: s.destination,
            expectedTokenMint: s.token_mint,
            expectedAmountMinor: BigInt(s.amount_minor),
            expectedReference: s.reference,
            rpcUrl: solanaRpcUrl(!!s.is_test),
          })
          : await verifyPolygonPayment({
            txHash: s.tx_hash,
            expectedDestination: s.destination,
            expectedTokenContract: s.token_mint,
            expectedAmountMinor: BigInt(s.amount_minor),
            confirmations: POLYGON_CONFIRMATIONS,
            rpcUrl: polygonRpcUrl(!!s.is_test),
          });

      if (result.status === 'confirmed') {
        // Insert ledger row idempotently.
        const { error: txErr } = await supabase.from('transactions').insert({
          session_id: s.id,
          merchant_id: s.merchant_id,
          product_id: s.product_id,
          amount_usd: Number(s.amount_minor) / 10 ** tokenDecimals(s.token),
          amount_minor: s.amount_minor,
          network: s.network,
          token_mint: s.token_mint,
          tx_hash: s.tx_hash,
          payer_address: result.payerAddress,
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          is_test: !!s.is_test,
        });

        if (!txErr || /duplicate key/i.test(txErr.message)) {
          // Enqueue webhook BEFORE flipping the session, with idempotency
          // dedupe so we don't double-fire if a previous run partially
          // succeeded. If the webhook insert errors (and the merchant has a
          // URL configured), DO NOT flip the session — leave it in
          // 'confirming' for the next catchup tick.
          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .select('webhook_url')
            .eq('id', s.merchant_id)
            .single();
          let canFlip = true;
          if (profErr) {
            canFlip = false;
          } else if (prof?.webhook_url) {
            const { data: existing } = await supabase
              .from('webhook_deliveries')
              .select('id')
              .eq('merchant_id', s.merchant_id)
              .eq('event', 'payment.confirmed')
              .contains('payload', { session_id: s.id })
              .limit(1);
            if (!existing || existing.length === 0) {
              const { error: insErr } = await supabase.from('webhook_deliveries').insert({
                merchant_id: s.merchant_id,
                event: 'payment.confirmed',
                url: prof.webhook_url,
                status: 'queued',
                is_test: !!s.is_test,
                next_attempt_at: new Date().toISOString(),
                payload: {
                  event: 'payment.confirmed',
                  session_id: s.id,
                  product_id: s.product_id,
                  amount_minor: s.amount_minor,
                  amount_usd: Number(s.amount_minor) / 10 ** tokenDecimals(s.token),
                  currency: 'USD',
                  network: s.network,
                  token: s.token,
                  reference: s.reference,
                  tx_hash: s.tx_hash,
                  payer_address: result.payerAddress,
                  livemode: !s.is_test,
                  timestamp: new Date().toISOString(),
                },
              });
              if (insErr) canFlip = false;
            }
          }

          if (canFlip) {
            await supabase
              .from('checkout_sessions')
              .update({
                status: 'confirmed',
                payer_address: result.payerAddress,
                confirmed_at: new Date().toISOString(),
              })
              .eq('id', s.id)
              .eq('status', 'confirming');
            confirmed++;
          }
        }
      } else if (result.status === 'failed') {
        await supabase
          .from('checkout_sessions')
          .update({ status: 'failed', failure_reason: result.reason })
          .eq('id', s.id)
          .eq('status', 'confirming');
        failed++;
      }
      // 'pending' -> leave it alone for the next cron tick.
    } catch (_e) {
      // Transient RPC errors: ignore, retry next tick.
    }
  }

  return { checked: stuck.length, confirmed, failed };
}

function tokenDecimals(token: string): number {
  switch (token) {
    case 'USDC':
    case 'USDT':
      return 6;
    default:
      throw new Error(`unknown token: ${token}`);
  }
}

// RPC URL resolution moved to ../_shared/rpc.ts (mode-aware).
