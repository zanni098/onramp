// POST /functions/v1/verify-payment
// Body: { session_id, tx_hash }
//
// Drives the checkout_session state machine for a single candidate tx_hash.
// Idempotent and safe to call repeatedly from the browser poll loop OR the
// cron verifier — they share this code path.
//
// Flow:
//   1. Load session by id; reject if terminal or expired.
//   2. If a tx_hash is already attached to the session and matches, re-run the
//      verifier (in case we previously got 'pending').
//   3. Otherwise attach the candidate tx_hash and transition to 'confirming'.
//   4. Run the chain-specific verifier.
//   5. On 'confirmed': insert into transactions (UNIQUE network/tx_hash) and
//      flip session to 'confirmed' in the SAME logical step. On conflict
//      (replay), we still flip the session — this is the idempotency key.
//      A webhook delivery is enqueued.
//   6. On 'failed': flip session to 'failed' with reason. Terminal.
//   7. On 'pending': leave session in 'confirming'; client retries.
//
// The endpoint NEVER trusts the client beyond the (session_id, tx_hash) pair.
// Everything else (amount, destination, token, reference) comes from the DB.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { json, preflight } from '../_shared/cors.ts';
import { verifySolanaPayment } from '../_shared/verify-solana.ts';
import { verifyPolygonPayment } from '../_shared/verify-polygon.ts';
import { rateLimit } from '../_shared/ratelimit.ts';
import { clientIp } from '../_shared/auth.ts';
import { solanaRpcUrl, polygonRpcUrl } from '../_shared/rpc.ts';
import { enqueueEmailsForConfirmedSession } from '../_shared/email-enqueue.ts';

const POLYGON_CONFIRMATIONS = 64;

// Tight shape validators — reject obviously bogus input before we burn an
// RPC call. Both networks fit comfortably under 128 chars.
const SOLANA_SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/; // base58, 64..88 typical
const EVM_TX_RE = /^0x[0-9a-fA-F]{64}$/;

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { session_id?: string; tx_hash?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const sessionId = body.session_id;
  const txHash = (body.tx_hash ?? '').trim();
  if (!sessionId || !txHash) return json({ error: 'missing_fields' }, 400);

  // UUID shape check (cheap; rejects most bogus session ids).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return json({ error: 'invalid_session_id' }, 400);
  }

  // Per-IP rate limit on verify attempts: 60/min. Stops attackers from
  // burning our verifier RPC budget by spamming garbage tx hashes.
  const ip = clientIp(req);
  const ipRl = await rateLimit(`vp:ip:${ip}`, 60, 60);
  if (!ipRl.allowed) return json({ error: 'rate_limited' }, 429);

  // Per-session rate limit: 30/min. A well-behaved client polls every 3s
  // (= 20/min); 30 leaves headroom but caps abuse.
  const sessRl = await rateLimit(`vp:sess:${sessionId}`, 30, 60);
  if (!sessRl.allowed) return json({ error: 'rate_limited' }, 429);

  const supabase = db();

  // 1. Load session.
  const { data: session, error: sErr } = await supabase
    .from('checkout_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sErr || !session) return json({ error: 'session_not_found' }, 404);

  // Terminal? Return current state without re-running.
  if (['confirmed', 'failed', 'expired'].includes(session.status)) {
    return json({ status: session.status, session });
  }

  // Expired but not yet swept by cron — handle inline.
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await markTerminal(supabase, session.id, session.status, 'expired', 'expired');
    return json({ status: 'expired' });
  }

  // Network-specific tx_hash shape check.
  const shapeOk =
    session.network === 'solana'
      ? SOLANA_SIG_RE.test(txHash)
      : EVM_TX_RE.test(txHash);
  if (!shapeOk) return json({ error: 'invalid_tx_hash' }, 400);

  // 2. Bind tx_hash to session if not already bound.
  if (session.tx_hash && session.tx_hash !== txHash) {
    return json(
      { error: 'tx_hash_conflict', detail: 'session already bound to a different tx' },
      409,
    );
  }
  if (!session.tx_hash) {
    const { error: bindErr } = await supabase
      .from('checkout_sessions')
      .update({ tx_hash: txHash, status: 'confirming' })
      .eq('id', session.id)
      .eq('status', 'awaiting_payment'); // CAS: only flip from awaiting_payment
    if (bindErr) {
      return json({ error: 'bind_failed', detail: bindErr.message }, 500);
    }
    session.tx_hash = txHash;
    session.status = 'confirming';
  }

  // 3. Run chain-specific verifier.
  let result;
  try {
    if (session.network === 'solana') {
      const rpcUrl = solanaRpcUrl(!!session.is_test);
      result = await verifySolanaPayment({
        txHash,
        expectedDestination: session.destination,
        expectedTokenMint: session.token_mint,
        expectedAmountMinor: BigInt(session.amount_minor),
        expectedReference: session.reference,
        rpcUrl,
      });
    } else if (session.network === 'polygon') {
      const rpcUrl = polygonRpcUrl(!!session.is_test);
      result = await verifyPolygonPayment({
        txHash,
        expectedDestination: session.destination,
        expectedTokenContract: session.token_mint,
        expectedAmountMinor: BigInt(session.amount_minor),
        confirmations: POLYGON_CONFIRMATIONS,
        rpcUrl,
      });
    } else {
      return json({ error: 'unsupported_network' }, 400);
    }
  } catch (err) {
    // RPC outage etc. — leave the session in 'confirming' for retry. Do not
    // mark failed on transient errors; that would be a self-inflicted wound.
    return json(
      { status: 'pending', detail: 'verifier_transient_error', error: String(err) },
      200,
    );
  }

  // 4. Apply result.
  if (result.status === 'pending') {
    return json({ status: 'pending' });
  }

  if (result.status === 'failed') {
    await markTerminal(
      supabase,
      session.id,
      session.status,
      'failed',
      result.reason,
    );
    return json({ status: 'failed', reason: result.reason });
  }

  // result.status === 'confirmed'
  // 5. Idempotent ledger insert.
  const { error: txInsErr } = await supabase
    .from('transactions')
    .insert({
      session_id: session.id,
      merchant_id: session.merchant_id,
      product_id: session.product_id,
      amount_usd: Number(session.amount_minor) / 10 ** tokenDecimals(session.token),
      amount_minor: session.amount_minor,
      network: session.network,
      token_mint: session.token_mint,
      tx_hash: txHash,
      payer_address: result.payerAddress,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      is_test: !!session.is_test,
    });

  if (txInsErr && !/duplicate key/i.test(txInsErr.message)) {
    return json({ error: 'ledger_insert_failed', detail: txInsErr.message }, 500);
  }

  // 5b. Enqueue email receipts (idempotent: dedupes on session_id + kind).
  //     This is fire-and-forget for the response — failure to enqueue an
  //     email row should NOT fail the whole confirmation. Worst case: the
  //     receipt is missed for this session; the merchant still gets paid
  //     and the webhook still fires.
  try {
    const confirmedAtIso = new Date().toISOString();
    await enqueueEmailsForConfirmedSession(
      supabase,
      session,
      result.payerAddress,
      txHash,
      confirmedAtIso,
    );
  } catch (e) {
    console.warn('email enqueue failed (non-fatal)', String(e));
  }

  // 6. Enqueue webhook delivery BEFORE flipping the session to confirmed.
  //    If this fails for any reason other than "merchant has no webhook URL",
  //    we abort and leave the session in 'confirming'. The catchup verifier
  //    on the dispatcher cron will retry the whole confirm path on the next
  //    tick. This guarantees we never end up with a confirmed session and a
  //    silently-dropped webhook — both happen, or neither does.
  const enqRes = await enqueueWebhook(supabase, session, result.payerAddress, txHash);
  if (enqRes === 'error') {
    return json({ error: 'webhook_enqueue_failed' }, 500);
  }

  // 7. Flip session to confirmed (CAS on 'confirming' to avoid double-fire).
  const { error: confirmErr } = await supabase
    .from('checkout_sessions')
    .update({
      status: 'confirmed',
      payer_address: result.payerAddress,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', session.id)
    .eq('status', 'confirming');

  if (confirmErr) {
    return json({ error: 'confirm_failed', detail: confirmErr.message }, 500);
  }

  return json({
    status: 'confirmed',
    payer_address: result.payerAddress,
    tx_hash: txHash,
  });
});

// ---------------------------------------------------------------------------
async function markTerminal(
  supabase: ReturnType<typeof db>,
  sessionId: string,
  fromStatus: string,
  toStatus: 'failed' | 'expired',
  reason: string,
) {
  await supabase
    .from('checkout_sessions')
    .update({ status: toStatus, failure_reason: reason })
    .eq('id', sessionId)
    .eq('status', fromStatus);
}

// Returns:
//   'queued'  — row inserted, dispatcher will pick it up
//   'no-url'  — merchant has no webhook configured (legitimate skip)
//   'error'   — unexpected DB error; caller should NOT flip the session
async function enqueueWebhook(
  supabase: ReturnType<typeof db>,
  session: {
    id: string;
    merchant_id: string;
    product_id: string;
    amount_minor: number;
    network: string;
    token: string;
    reference: string;
  },
  payerAddress: string,
  txHash: string,
): Promise<'queued' | 'no-url' | 'error'> {
  // Look up webhook URL for the merchant. (Secret stays in merchant_secrets;
  // dispatcher loads it at send time.)
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('webhook_url')
    .eq('id', session.merchant_id)
    .single();

  if (profErr) return 'error';
  if (!profile?.webhook_url) return 'no-url';

  const payload = {
    event: 'payment.confirmed',
    session_id: session.id,
    product_id: session.product_id,
    amount_minor: session.amount_minor,
    amount_usd: session.amount_minor / 10 ** tokenDecimals(session.token),
    currency: 'USD',
    network: session.network,
    token: session.token,
    reference: session.reference,
    tx_hash: txHash,
    payer_address: payerAddress,
    timestamp: new Date().toISOString(),
  };

  // Idempotency hint: a previous failed-then-retried flow could have
  // already enqueued the same payment. We use the session_id to dedupe
  // by checking for an existing queued/delivering/delivered row first.
  const { data: existing } = await supabase
    .from('webhook_deliveries')
    .select('id')
    .eq('merchant_id', session.merchant_id)
    .eq('event', 'payment.confirmed')
    .contains('payload', { session_id: session.id })
    .limit(1);
  if (existing && existing.length > 0) return 'queued';

  const { error: insErr } = await supabase.from('webhook_deliveries').insert({
    merchant_id: session.merchant_id,
    event: 'payment.confirmed',
    payload,
    url: profile.webhook_url,
    status: 'queued',
    next_attempt_at: new Date().toISOString(),
  });
  if (insErr) return 'error';
  return 'queued';
}

// Decimals lookup. USDC and USDT are both 6dp on the chains we support; if
// you add a new token, extend this map. Calling with an unknown token throws
// rather than silently returning a wrong dollar figure.
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
