// POST /functions/v1/create-checkout-session
// Body: { product_id, network: 'solana' | 'polygon' }
//
// Server-authoritative session creation. The browser does NOT supply price,
// destination, token, or status. We derive everything from the merchant's
// configured profile + product row, freeze it into checkout_sessions, and
// return the row to the client for display + polling.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { json, preflight, corsHeaders } from '../_shared/cors.ts';
import {
  newReference,
  applyPolygonSuffix,
  randomPolygonSuffix,
} from '../_shared/reference.ts';
import { rateLimit } from '../_shared/ratelimit.ts';
import { clientIp } from '../_shared/auth.ts';

// Stablecoin registry — single source of truth for mint/contract addresses.
const TOKEN_REGISTRY = {
  solana: {
    USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  },
  polygon: {
    USDT: { mint: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
  },
} as const;

const SESSION_TTL_MINUTES = 15;

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { product_id?: string; network?: string; customer_email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const productId = body.product_id;
  const network = body.network as 'solana' | 'polygon' | undefined;
  const rawEmail = typeof body.customer_email === 'string' ? body.customer_email.trim() : '';
  if (rawEmail !== '') {
    if (rawEmail.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) {
      return json({ error: 'invalid_customer_email' }, 400);
    }
  }
  const customerEmail = rawEmail.length > 0 ? rawEmail : null;

  if (!productId || !network) return json({ error: 'missing_fields' }, 400);
  if (network !== 'solana' && network !== 'polygon') {
    return json({ error: 'unsupported_network' }, 400);
  }

  // Rate limit: 30 sessions / 60s per IP, AND 60 sessions / 60s per product
  // (prevents both general spam and a single product link being weaponised
  // to fill the merchant's session table). Fails open on RPC outage.
  const ip = clientIp(req);
  const ipRl = await rateLimit(`ccs:ip:${ip}`, 30, 60);
  if (!ipRl.allowed) return json({ error: 'rate_limited' }, 429);
  const prodRl = await rateLimit(`ccs:prod:${productId}`, 60, 60);
  if (!prodRl.allowed) return json({ error: 'rate_limited' }, 429);

  const supabase = db();

  // 1. Load product (server-side; we trust nothing the client says about price).
  const { data: product, error: pErr } = await supabase
    .from('products')
    .select('id, merchant_id, name, price_minor, price_usd, active')
    .eq('id', productId)
    .single();

  if (pErr || !product) return json({ error: 'product_not_found' }, 404);
  if (product.active === false) return json({ error: 'product_inactive' }, 410);

  // Derive amount_minor (prefer the integer column; fall back to legacy float).
  let baseAmountMinor: bigint;
  if (product.price_minor != null) {
    baseAmountMinor = BigInt(product.price_minor);
  } else if (product.price_usd != null) {
    // Round to whole cents (4 trailing zeros in 6-decimal minor units).
    const cents = Math.round(Number(product.price_usd) * 100);
    baseAmountMinor = BigInt(cents) * 10000n;
  } else {
    return json({ error: 'product_has_no_price' }, 422);
  }

  if (baseAmountMinor <= 0n) return json({ error: 'invalid_price' }, 422);

  // 2. Load merchant wallet for the requested network.
  const { data: profile, error: prErr } = await supabase
    .from('profiles')
    .select('id, solana_wallet, polygon_wallet')
    .eq('id', product.merchant_id)
    .single();

  if (prErr || !profile) return json({ error: 'merchant_not_found' }, 404);

  const destination =
    network === 'solana' ? profile.solana_wallet : profile.polygon_wallet;
  if (!destination) {
    return json({ error: 'merchant_wallet_not_configured' }, 422);
  }

  // 3. Pick token + reference + final amount_minor.
  const token = network === 'solana' ? 'USDC' : 'USDT';
  const tokenInfo =
    network === 'solana'
      ? TOKEN_REGISTRY.solana.USDC
      : TOKEN_REGISTRY.polygon.USDT;

  const reference = newReference();

  let amountMinor: bigint;
  if (network === 'polygon') {
    // Allocate a sub-cent suffix unique among the merchant's active sessions.
    amountMinor = await allocatePolygonAmount(
      supabase,
      product.merchant_id,
      baseAmountMinor,
    );
  } else {
    amountMinor = baseAmountMinor;
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString();

  // 4. Insert (service role; trigger enforces state-machine semantics on update).
  const { data: session, error: insErr } = await supabase
    .from('checkout_sessions')
    .insert({
      product_id: product.id,
      merchant_id: product.merchant_id,
      amount_minor: Number(amountMinor),
      currency: 'USD',
      network,
      token,
      token_mint: tokenInfo.mint,
      destination,
      reference,
      status: 'awaiting_payment',
      expires_at: expiresAt,
      customer_email: customerEmail,
    })
    .select('*')
    .single();

  if (insErr || !session) {
    return json({ error: 'session_create_failed', detail: insErr?.message }, 500);
  }

  return json({
    session_id: session.id,
    network: session.network,
    token: session.token,
    token_mint: session.token_mint,
    destination: session.destination,
    amount_minor: session.amount_minor,
    decimals: tokenInfo.decimals,
    reference: session.reference,
    expires_at: session.expires_at,
    status: session.status,
    product: {
      id: product.id,
      name: product.name,
    },
  });
});

// ---------------------------------------------------------------------------
// Polygon: allocate an amount_minor whose sub-cent suffix is unique among the
// merchant's currently-active sessions. Bounded retry; on exhaustion we fail
// loudly rather than reuse a suffix.
// ---------------------------------------------------------------------------

async function allocatePolygonAmount(
  supabase: ReturnType<typeof db>,
  merchantId: string,
  baseAmountMinor: bigint,
): Promise<bigint> {
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

// (Make corsHeaders side-effecting reference happy for tree-shakers.)
void corsHeaders;
