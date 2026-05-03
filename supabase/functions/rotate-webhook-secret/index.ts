// POST /functions/v1/rotate-webhook-secret
//
// Generates a fresh 32-byte hex webhook secret for the authenticated merchant.
// Returns the new secret ONCE in the response. Once the merchant closes the
// dashboard, the only way to see it again is to rotate again.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { json, preflight, corsHeadersFor, originAllowed } from '../_shared/cors.ts';
import { requireMerchant } from '../_shared/auth.ts';

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

  const newSecret = randomHex(32);

  const supabase = db();
  const { error } = await supabase
    .from('merchant_secrets')
    .update({ webhook_secret: newSecret, rotated_at: new Date().toISOString() })
    .eq('merchant_id', auth.userId);

  if (error) return json({ error: 'rotate_failed', detail: error.message }, 500);
  return json({ webhook_secret: newSecret });
});

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let s = '';
  for (const b of buf) s += b.toString(16).padStart(2, '0');
  return s;
}
