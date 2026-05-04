// Thin client for our Supabase Edge Functions. Centralises URLs + headers so
// the rest of the app never builds them ad-hoc.
//
// IMPORTANT: this module talks to the *server-authoritative* payment API.
// Anything you read from these endpoints is trusted; anything stored in
// React state derived from elsewhere is NOT.

import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  // Don't crash the entire app on import, but make this loud during dev.
  // eslint-disable-next-line no-console
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set');
}

const FN_BASE = `${SUPABASE_URL}/functions/v1`;

export interface CheckoutSession {
  session_id: string;
  network: 'solana' | 'polygon';
  token: 'USDC' | 'USDT';
  token_mint: string;
  destination: string;
  amount_minor: number;
  decimals: number;
  reference: string;
  expires_at: string;
  status: SessionStatus;
  product: { id: string; name: string };
}

export type SessionStatus =
  | 'awaiting_payment'
  | 'confirming'
  | 'confirmed'
  | 'failed'
  | 'expired';

async function callFn<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; auth?: 'anon' | 'user' } = { method: 'POST' },
): Promise<T> {
  // For 'user' calls we send the merchant's session JWT so Edge Functions can
  // identify the merchant via Supabase's JWT verification.
  let bearer = SUPABASE_ANON;
  if (init.auth === 'user') {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('not_authenticated');
    bearer = data.session.access_token;
  }
  const resp = await fetch(`${FN_BASE}/${path}`, {
    method: init.method,
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_ANON,
      authorization: `Bearer ${bearer}`,
    },
    body: init.body == null ? undefined : JSON.stringify(init.body),
  });

  const text = await resp.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path}: invalid JSON response (${resp.status})`);
  }

  if (!resp.ok) {
    throw new Error(json?.error ?? `${path} failed (${resp.status})`);
  }
  return json as T;
}

async function postFn<T>(path: string, body: unknown): Promise<T> {
  return callFn<T>(path, { method: 'POST', body, auth: 'anon' });
}

async function postFnAuthed<T>(path: string, body: unknown): Promise<T> {
  return callFn<T>(path, { method: 'POST', body, auth: 'user' });
}

async function getFnAuthed<T>(path: string): Promise<T> {
  return callFn<T>(path, { method: 'GET', auth: 'user' });
}

export function createCheckoutSession(input: {
  product_id: string;
  network: 'solana' | 'polygon';
}): Promise<CheckoutSession> {
  return postFn<CheckoutSession>('create-checkout-session', input);
}

export interface VerifyPaymentResponse {
  status: SessionStatus | 'pending';
  reason?: string;
  payer_address?: string;
  tx_hash?: string;
}

export function verifyPayment(input: {
  session_id: string;
  tx_hash: string;
}): Promise<VerifyPaymentResponse> {
  return postFn<VerifyPaymentResponse>('verify-payment', input);
}

// ---------------------------------------------------------------------------
// Authenticated merchant config endpoints
// ---------------------------------------------------------------------------

export interface MerchantConfigUpdate {
  business_name?: string | null;
  solana_wallet?: string | null;
  polygon_wallet?: string | null;
  webhook_url?: string | null;
}

export interface PublicMerchantProfile {
  id: string;
  business_name: string | null;
  solana_wallet: string | null;
  polygon_wallet: string | null;
  webhook_url: string | null;
  public_key: string | null;
}

export function updateMerchantConfig(
  patch: MerchantConfigUpdate,
): Promise<{ profile: PublicMerchantProfile }> {
  return postFnAuthed('update-merchant-config', patch);
}

export interface MerchantSecrets {
  secret_key: string;
  webhook_secret: string;
  rotated_at: string;
}

export function getMerchantSecrets(): Promise<MerchantSecrets> {
  return getFnAuthed<MerchantSecrets>('get-merchant-secrets');
}

export function rotateWebhookSecret(): Promise<{ webhook_secret: string }> {
  return postFnAuthed('rotate-webhook-secret', {});
}

/**
 * Public read of a session row by id. Goes through a SECURITY DEFINER RPC
 * (`get_checkout_session(uuid)`) so an anon caller can only fetch a session
 * if they already know the unguessable UUID — they cannot enumerate the
 * table. Direct anon SELECT on `checkout_sessions` was revoked in 0011.
 */
export async function fetchSession(sessionId: string) {
  const { data, error } = await supabase.rpc('get_checkout_session', {
    p_id: sessionId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('session_not_found');
  return row;
}
