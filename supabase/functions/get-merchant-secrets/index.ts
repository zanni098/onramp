// GET /functions/v1/get-merchant-secrets
//
// Returns the authenticated merchant's secrets (api secret_key, webhook_secret).
// Replaces reading them out of the profiles table on the client.

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
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, headers);
  }

  const auth = await requireMerchant(req);
  if (auth instanceof Response) return auth;

  const supabase = db();
  const { data, error } = await supabase
    .from('merchant_secrets')
    .select('secret_key, webhook_secret, rotated_at')
    .eq('merchant_id', auth.userId)
    .single();

  if (error) {
    return json({ error: 'not_found', detail: error.message }, 404);
  }
  return json(data);
});
