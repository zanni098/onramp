// Solana JSON-RPC proxy for the browser checkout.
//
// Why this exists: the checkout page needs a Solana RPC for exactly three
// read-only calls (latest blockhash, destination-ATA existence, version
// handshake) before Phantom signs and submits the transaction through its
// own RPC. Baking the Helius API key into the public JS bundle would leak
// it to every visitor; the public mainnet-beta RPC is rate-limited and
// flaky under load. This proxy keeps the key server-side (same
// HELIUS_API_KEY / SOLANA_RPC_URL secrets the verifier already uses) and
// forwards only a whitelist of harmless read methods.
//
// Deployed with verify_jwt=false: the checkout runs as an anonymous
// customer, and @solana/web3.js Connection cannot attach Supabase auth
// headers. Abuse is bounded by the method whitelist + per-IP rate limit.

import { corsHeaders, json, preflight } from '../_shared/cors.ts';
import { rateLimit } from '../_shared/ratelimit.ts';
import { clientIp } from '../_shared/auth.ts';
import { solanaRpcUrl } from '../_shared/rpc.ts';

// Read-only methods the browser checkout actually issues. Anything else
// (sendTransaction, airdrops, getProgramAccounts scans…) is rejected.
const ALLOWED_METHODS = new Set([
  'getLatestBlockhash',
  'getAccountInfo',
  'getVersion',
]);

const RL_MAX_PER_MIN = 60; // per IP — a checkout needs ~3 calls

interface RpcCall {
  jsonrpc?: string;
  id?: unknown;
  method?: string;
  params?: unknown;
}

function badRequest(reason: string): Response {
  return json({ error: reason }, 400);
}

Deno.serve(async (req: Request) => {
  const pf = preflight(req, 'public');
  if (pf) return pf;

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const ip = clientIp(req);
  const rl = await rateLimit(`solrpc:ip:${ip}`, RL_MAX_PER_MIN, 60);
  if (!rl.allowed) {
    return json({ error: 'rate_limited' }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid_json');
  }

  // web3.js sends single calls; tolerate batches but vet every entry.
  const calls: RpcCall[] = Array.isArray(body) ? body : [body as RpcCall];
  if (calls.length === 0 || calls.length > 5) {
    return badRequest('invalid_batch_size');
  }
  for (const c of calls) {
    if (!c || typeof c.method !== 'string' || !ALLOWED_METHODS.has(c.method)) {
      return badRequest(`method_not_allowed:${String(c?.method ?? '')}`);
    }
  }

  // Live checkout only proxies mainnet. (Test-mode sessions verify
  // server-side against devnet; the browser leg still goes through Phantom.)
  const upstream = solanaRpcUrl(false);

  try {
    const resp = await fetch(upstream, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('solana-rpc upstream error:', err);
    return json({ error: 'upstream_unavailable' }, 502);
  }
});
