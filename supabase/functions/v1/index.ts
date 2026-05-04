// /functions/v1/v1/<path>
//
// Public REST API. Auth: Authorization: Bearer sk_live_<...>.
// Errors: Stripe-style envelope { error: { type, code, message, param? } }.
// Idempotency: Idempotency-Key header on POST endpoints.
// Pagination: ?limit=N&starting_after=<id>; max 100, default 20.
//
// Endpoints:
//   POST /checkout_sessions
//   GET  /checkout_sessions/:id
//   GET  /transactions
//   GET  /transactions/:id
//
// Response objects mirror the dashboard EFs but reformatted to a stable
// public shape (`object` discriminator, snake_case, ISO timestamps, no
// internal columns leaked).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { json, preflight } from '../_shared/cors.ts';
import { apiError } from '../_shared/api-error.ts';
import { requireApiKey } from '../_shared/api-key-auth.ts';
import {
  checkIdempotency,
  hashRequest,
  isValidIdempotencyKey,
  storeIdempotency,
} from '../_shared/idempotency.ts';
import { rateLimit } from '../_shared/ratelimit.ts';
import {
  applyPolygonSuffix,
  newReference,
  randomPolygonSuffix,
} from '../_shared/reference.ts';
import { tokenFor, type Network } from '../_shared/tokens.ts';

const SESSION_TTL_MINUTES = 15;
const PAGINATION_DEFAULT = 20;
const PAGINATION_MAX = 100;

// Public checkout URL base. Configurable via env so non-prod deploys point
// at the right host. Falls back to the production URL.
function checkoutUrl(sessionId: string): string {
  const base = (Deno.env.get('PUBLIC_CHECKOUT_BASE') ?? 'https://onramp-delta.vercel.app').replace(/\/+$/, '');
  return `${base}/checkout/${sessionId}`;
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  // ---- Routing -----------------------------------------------------------
  // Supabase EF URL: https://<proj>.supabase.co/functions/v1/v1/<path>
  // Inside the runtime, pathname looks like "/v1/<path>".
  const url = new URL(req.url);
  let path = url.pathname.replace(/^\/v1/, '');
  if (path === '') path = '/';

  // ---- Auth (all endpoints require a live API key) -----------------------
  const auth = await requireApiKey(req);
  if (auth instanceof Response) return auth;
  const { merchantId, isTest } = auth;

  // ---- Per-merchant rate limit: 600 req / 60s ----------------------------
  const rl = await rateLimit(`api:m:${merchantId}`, 600, 60);
  if (!rl.allowed) {
    return apiError(
      'rate_limit_error',
      'rate_limited',
      'Too many requests. Try again shortly.',
      429,
    );
  }

  try {
    // POST /checkout_sessions
    if (req.method === 'POST' && path === '/checkout_sessions') {
      return await handleCreateCheckoutSession(req, merchantId, isTest);
    }
    // GET /checkout_sessions/:id
    {
      const m = req.method === 'GET' && path.match(/^\/checkout_sessions\/([^/]+)$/);
      if (m) return await handleGetCheckoutSession(merchantId, isTest, m[1]);
    }
    // GET /transactions
    if (req.method === 'GET' && path === '/transactions') {
      return await handleListTransactions(req, merchantId, isTest);
    }
    // GET /transactions/:id
    {
      const m = req.method === 'GET' && path.match(/^\/transactions\/([^/]+)$/);
      if (m) return await handleGetTransaction(merchantId, isTest, m[1]);
    }

    return apiError(
      'invalid_request_error',
      'unknown_endpoint',
      `Unknown endpoint: ${req.method} ${path}`,
      404,
    );
  } catch (err) {
    console.error('v1 unhandled', err);
    return apiError(
      'api_error',
      'internal_error',
      'Internal server error.',
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// POST /checkout_sessions
// ---------------------------------------------------------------------------
async function handleCreateCheckoutSession(
  req: Request,
  merchantId: string,
  isTest: boolean,
): Promise<Response> {
  const rawBody = await req.text();
  let body: Record<string, unknown> = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return apiError('invalid_request_error', 'invalid_json', 'Request body is not valid JSON.', 400);
    }
  }

  // Idempotency-Key handling (optional but recommended).
  const idemKey = req.headers.get('idempotency-key') ?? req.headers.get('Idempotency-Key');
  let requestHash: string | null = null;
  if (idemKey) {
    if (!isValidIdempotencyKey(idemKey)) {
      return apiError(
        'invalid_request_error',
        'invalid_idempotency_key',
        'Idempotency-Key must be 1..255 characters.',
        400,
      );
    }
    requestHash = await hashRequest(req.method, '/checkout_sessions', rawBody);
    const hit = await checkIdempotency(merchantId, idemKey, requestHash);
    if (hit.kind === 'hit') {
      return json(hit.response.body, hit.response.status);
    }
    if (hit.kind === 'conflict') {
      return apiError(
        'idempotency_error',
        'idempotency_key_in_use',
        'This Idempotency-Key was previously used with a different request body.',
        409,
      );
    }
  }

  // Input shape.
  const productId = typeof body.product_id === 'string' ? body.product_id : null;
  const network = body.network as string | undefined;
  const customerEmailRaw = typeof body.customer_email === 'string' ? body.customer_email.trim() : null;

  if (customerEmailRaw !== null && customerEmailRaw !== '') {
    if (customerEmailRaw.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmailRaw)) {
      return apiError('invalid_request_error', 'invalid_field', 'customer_email is not a valid email address.', 400, 'customer_email');
    }
  }
  const customerEmail = customerEmailRaw && customerEmailRaw.length > 0 ? customerEmailRaw : null;

  if (!productId) {
    return apiError('invalid_request_error', 'missing_field', 'Missing required field: product_id.', 400, 'product_id');
  }
  if (!isUuid(productId)) {
    return apiError('invalid_request_error', 'invalid_field', 'product_id must be a UUID.', 400, 'product_id');
  }
  if (network !== 'solana' && network !== 'polygon') {
    return apiError(
      'invalid_request_error',
      'invalid_field',
      'network must be one of: solana, polygon.',
      400,
      'network',
    );
  }

  const supabase = db();

  // Load product, scoped to this merchant.
  const { data: product, error: pErr } = await supabase
    .from('products')
    .select('id, merchant_id, name, price_minor, price_usd, active')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (pErr) {
    return apiError('api_error', 'product_lookup_failed', 'Could not load product.', 500);
  }
  if (!product) {
    return apiError('not_found_error', 'product_not_found', `No such product: ${productId}.`, 404);
  }
  if (product.active === false) {
    return apiError('invalid_request_error', 'product_inactive', 'Product is inactive.', 422);
  }

  // Derive amount_minor.
  let baseAmountMinor: bigint;
  if (product.price_minor != null) {
    baseAmountMinor = BigInt(product.price_minor);
  } else if (product.price_usd != null) {
    const cents = Math.round(Number(product.price_usd) * 100);
    baseAmountMinor = BigInt(cents) * 10000n;
  } else {
    return apiError('invalid_request_error', 'product_has_no_price', 'Product has no price set.', 422);
  }
  if (baseAmountMinor <= 0n) {
    return apiError('invalid_request_error', 'invalid_price', 'Product price is invalid.', 422);
  }

  // Load merchant wallet.
  const { data: profile, error: prErr } = await supabase
    .from('profiles')
    .select('id, solana_wallet, polygon_wallet')
    .eq('id', merchantId)
    .single();
  if (prErr || !profile) {
    return apiError('api_error', 'merchant_lookup_failed', 'Could not load merchant.', 500);
  }
  const destination = network === 'solana' ? profile.solana_wallet : profile.polygon_wallet;
  if (!destination) {
    return apiError(
      'invalid_request_error',
      'merchant_wallet_not_configured',
      `Merchant has no ${network} wallet configured.`,
      422,
    );
  }

  // Token + reference + final amount_minor (mode-aware).
  const tokenInfo = tokenFor(isTest ? 'test' : 'live', network as Network);
  const token = tokenInfo.symbol;

  const reference = newReference();

  let amountMinor: bigint;
  if (network === 'polygon') {
    try {
      amountMinor = await allocatePolygonAmount(merchantId, baseAmountMinor);
    } catch (err) {
      return apiError('api_error', 'amount_allocation_failed', String(err), 500);
    }
  } else {
    amountMinor = baseAmountMinor;
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString();

  // Insert.
  const { data: session, error: insErr } = await supabase
    .from('checkout_sessions')
    .insert({
      product_id: product.id,
      merchant_id: merchantId,
      amount_minor: Number(amountMinor),
      currency: 'USD',
      network,
      token,
      token_mint: tokenInfo.mint,
      destination,
      reference,
      status: 'awaiting_payment',
      expires_at: expiresAt,
      is_test: isTest,
      customer_email: customerEmail,
    })
    .select('*')
    .single();

  if (insErr || !session) {
    return apiError('api_error', 'session_create_failed', insErr?.message ?? 'Could not create session.', 500);
  }

  const respBody = serializeCheckoutSession(session, tokenInfo.decimals, product.name);
  // Override livemode flag from the request mode (defensive — the row's
  // is_test was set above, but the serializer reads from `s.is_test`).
  respBody.livemode = !isTest;
  if (idemKey && requestHash) {
    await storeIdempotency(merchantId, idemKey, requestHash, 200, respBody);
  }
  return json(respBody, 200);
}

async function allocatePolygonAmount(merchantId: string, baseAmountMinor: bigint): Promise<bigint> {
  const supabase = db();
  for (let attempt = 0; attempt < 12; attempt++) {
    const suffix = randomPolygonSuffix();
    const candidate = applyPolygonSuffix(baseAmountMinor, suffix);
    const { data } = await supabase
      .from('checkout_sessions')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('network', 'polygon')
      .eq('amount_minor', Number(candidate))
      .in('status', ['awaiting_payment', 'confirming'])
      .limit(1);
    if (!data || data.length === 0) return candidate;
  }
  throw new Error('failed to allocate unique polygon amount suffix');
}

// ---------------------------------------------------------------------------
// GET /checkout_sessions/:id
// ---------------------------------------------------------------------------
async function handleGetCheckoutSession(
  merchantId: string,
  isTest: boolean,
  id: string,
): Promise<Response> {
  if (!isUuid(id)) {
    return apiError('invalid_request_error', 'invalid_id', 'Invalid checkout_session id.', 400);
  }
  const supabase = db();
  const { data: session, error } = await supabase
    .from('checkout_sessions')
    .select('*, products!inner(id,name)')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .eq('is_test', isTest)
    .maybeSingle();
  if (error) {
    return apiError('api_error', 'session_lookup_failed', 'Could not load session.', 500);
  }
  if (!session) {
    return apiError('not_found_error', 'session_not_found', `No such checkout_session: ${id}.`, 404);
  }
  const decimals = tokenDecimals(session.token);
  // Joined product comes back as nested array/object depending on supabase version.
  const productName = Array.isArray(session.products)
    ? session.products[0]?.name
    : (session.products as { name?: string } | null)?.name;
  return json(serializeCheckoutSession(session, decimals, productName ?? null), 200);
}

// ---------------------------------------------------------------------------
// GET /transactions
// ---------------------------------------------------------------------------
async function handleListTransactions(
  req: Request,
  merchantId: string,
  isTest: boolean,
): Promise<Response> {
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get('limit');
  let limit = PAGINATION_DEFAULT;
  if (limitRaw) {
    const parsed = parseInt(limitRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > PAGINATION_MAX) {
      return apiError(
        'invalid_request_error',
        'invalid_limit',
        `limit must be an integer between 1 and ${PAGINATION_MAX}.`,
        400,
        'limit',
      );
    }
    limit = parsed;
  }
  const startingAfter = url.searchParams.get('starting_after');
  if (startingAfter && !isUuid(startingAfter)) {
    return apiError(
      'invalid_request_error',
      'invalid_cursor',
      'starting_after must be a valid transaction id.',
      400,
      'starting_after',
    );
  }

  const supabase = db();
  // Resolve cursor created_at if provided.
  let cursorCreatedAt: string | null = null;
  if (startingAfter) {
    const { data: cur } = await supabase
      .from('transactions')
      .select('created_at')
      .eq('id', startingAfter)
      .eq('merchant_id', merchantId)
      .eq('is_test', isTest)
      .maybeSingle();
    if (!cur) {
      return apiError('not_found_error', 'cursor_not_found', 'starting_after refers to an unknown transaction.', 404);
    }
    cursorCreatedAt = cur.created_at as string;
  }

  let q = supabase
    .from('transactions')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('is_test', isTest)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (cursorCreatedAt) q = q.lt('created_at', cursorCreatedAt);

  const { data, error } = await q;
  if (error) {
    return apiError('api_error', 'list_failed', 'Could not list transactions.', 500);
  }
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return json(
    {
      object: 'list',
      data: page.map(serializeTransaction),
      has_more: hasMore,
      next_cursor: hasMore ? page[page.length - 1].id : null,
    },
    200,
  );
}

// ---------------------------------------------------------------------------
// GET /transactions/:id
// ---------------------------------------------------------------------------
async function handleGetTransaction(
  merchantId: string,
  isTest: boolean,
  id: string,
): Promise<Response> {
  if (!isUuid(id)) {
    return apiError('invalid_request_error', 'invalid_id', 'Invalid transaction id.', 400);
  }
  const supabase = db();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .eq('is_test', isTest)
    .maybeSingle();
  if (error) {
    return apiError('api_error', 'transaction_lookup_failed', 'Could not load transaction.', 500);
  }
  if (!data) {
    return apiError('not_found_error', 'transaction_not_found', `No such transaction: ${id}.`, 404);
  }
  return json(serializeTransaction(data), 200);
}

// ---------------------------------------------------------------------------
// Serializers — define the public shape exactly once.
// ---------------------------------------------------------------------------
function serializeCheckoutSession(
  s: Record<string, unknown>,
  decimals: number,
  productName: string | null,
) {
  return {
    object: 'checkout_session',
    id: s.id,
    url: checkoutUrl(s.id as string),
    status: s.status,
    amount: Number(s.amount_minor),
    decimals,
    currency: s.currency,
    network: s.network,
    token: s.token,
    token_mint: s.token_mint,
    destination: s.destination,
    reference: s.reference,
    tx_hash: s.tx_hash ?? null,
    payer_address: s.payer_address ?? null,
    confirmed_at: s.confirmed_at ?? null,
    failure_reason: s.failure_reason ?? null,
    expires_at: s.expires_at,
    created_at: s.created_at,
    customer_email: s.customer_email ?? null,
    product: { id: s.product_id, name: productName },
    livemode: !s.is_test,
  };
}

function serializeTransaction(t: Record<string, unknown>) {
  return {
    object: 'transaction',
    id: t.id,
    checkout_session_id: t.session_id ?? null,
    product_id: t.product_id ?? null,
    amount: t.amount_minor != null ? Number(t.amount_minor) : null,
    amount_usd: t.amount_usd != null ? Number(t.amount_usd) : null,
    currency: 'USD',
    network: t.network,
    token_mint: t.token_mint ?? null,
    tx_hash: t.tx_hash ?? null,
    payer_address: t.payer_address ?? null,
    status: t.status,
    confirmed_at: t.confirmed_at ?? null,
    created_at: t.created_at,
    livemode: !t.is_test,
  };
}

// ---------------------------------------------------------------------------
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function tokenDecimals(token: unknown): number {
  if (token === 'USDC' || token === 'USDT') return 6;
  return 6; // safe default for current stable set; extend when adding tokens
}
