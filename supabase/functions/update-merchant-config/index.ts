// POST /functions/v1/update-merchant-config
// Body: { business_name?, solana_wallet?, polygon_wallet?, webhook_url? }
//
// Authenticated. Merchants update their own profile through THIS endpoint
// only — direct writes to the `profiles` table are revoked from anon and
// authenticated in migration 0006.
//
// Validation:
//   - solana_wallet : base58 32-byte system account
//   - polygon_wallet: 0x + 40 hex; if mixed-case, EIP-55 checksum verified
//   - webhook_url   : https only, no loopback / private / metadata IPs
//   - business_name : trimmed, ≤80 chars, control chars stripped

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { json, preflight, corsHeadersFor, originAllowed } from '../_shared/cors.ts';
import { requireMerchant } from '../_shared/auth.ts';
import {
  isValidSolanaAddress,
  isValidEvmAddress,
  verifyEvmChecksum,
  validateWebhookUrl,
  sanitizeBusinessName,
} from '../_shared/validators.ts';

serve(async (req) => {
  const pre = preflight(req, 'dashboard');
  if (pre) return pre;
  const headers = corsHeadersFor(req, 'dashboard');
  if (!originAllowed(req, 'dashboard')) {
    return json({ error: 'origin_not_allowed' }, 403, headers);
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);

  const auth = await requireMerchant(req);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const updates: Record<string, string | null> = {};

  if ('business_name' in body) {
    const v = sanitizeBusinessName(body.business_name);
    if (v === null && body.business_name !== null) {
      return json({ error: 'invalid_business_name' }, 422);
    }
    updates.business_name = v;
  }

  if ('solana_wallet' in body) {
    const v = body.solana_wallet;
    if (v === null || v === '') {
      updates.solana_wallet = null;
    } else if (typeof v === 'string' && isValidSolanaAddress(v)) {
      updates.solana_wallet = v;
    } else {
      return json({ error: 'invalid_solana_wallet' }, 422);
    }
  }

  if ('polygon_wallet' in body) {
    const v = body.polygon_wallet;
    if (v === null || v === '') {
      updates.polygon_wallet = null;
    } else if (typeof v === 'string' && isValidEvmAddress(v)) {
      const stripped = v.slice(2);
      const isMixed =
        stripped !== stripped.toLowerCase() && stripped !== stripped.toUpperCase();
      if (isMixed && !(await verifyEvmChecksum(v))) {
        return json({ error: 'invalid_polygon_wallet_checksum' }, 422);
      }
      updates.polygon_wallet = v.toLowerCase();
    } else {
      return json({ error: 'invalid_polygon_wallet' }, 422);
    }
  }

  if ('webhook_url' in body) {
    const v = body.webhook_url;
    if (v === null || v === '') {
      updates.webhook_url = null;
    } else if (typeof v === 'string') {
      const r = validateWebhookUrl(v);
      if (!r.ok) return json({ error: `invalid_webhook_url:${r.reason}` }, 422);
      updates.webhook_url = r.url;
    } else {
      return json({ error: 'invalid_webhook_url' }, 422);
    }
  }

  if (Object.keys(updates).length === 0) {
    return json({ error: 'no_updates' }, 400);
  }

  const supabase = db();
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', auth.userId)
    .select('id, business_name, solana_wallet, polygon_wallet, webhook_url, public_key')
    .single();

  if (error) return json({ error: 'update_failed', detail: error.message }, 500);
  return json({ profile: data });
});
