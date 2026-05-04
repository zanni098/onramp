// CORS helpers.
//
// Two modes:
//
// 1. PUBLIC ('*'): customer-facing endpoints embedded on arbitrary merchant
//    sites — create-checkout-session, verify-payment, fetchSession. The
//    Origin can't be predicted; we allow anyone.
//
// 2. ALLOWLIST: authed dashboard-only endpoints — update-merchant-config,
//    get-merchant-secrets, rotate-webhook-secret. Reject any Origin not in
//    DASHBOARD_ORIGINS (comma-separated env). Falls back to a sensible local
//    dev list only when DASHBOARD_ORIGINS is unset (so prod misconfig fails
//    closed for unknown origins instead of silently allowing everything).

const DEV_FALLBACK_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]);

function dashboardOrigins(): Set<string> {
  const raw = Deno.env.get('DASHBOARD_ORIGINS') ?? '';
  const set = new Set(
    raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0),
  );
  if (set.size === 0) return DEV_FALLBACK_ORIGINS;
  return set;
}

const COMMON_HEADERS = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
} as const;

/** Public CORS — allow any origin. Use for customer-embedded endpoints. */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  ...COMMON_HEADERS,
};

/** Resolve allow-list-aware headers for the given request. */
export function corsHeadersFor(
  req: Request,
  mode: 'public' | 'dashboard',
): Record<string, string> {
  if (mode === 'public') return corsHeaders;

  const origin = req.headers.get('origin') ?? '';
  const allowed = dashboardOrigins();
  if (origin && allowed.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      ...COMMON_HEADERS,
    };
  }
  // Disallowed: omit the Allow-Origin header so the browser blocks the
  // response. (Returning a 403 in preflight also works; the browser surfaces
  // the CORS error either way.)
  return { ...COMMON_HEADERS };
}

export function preflight(req: Request, mode: 'public' | 'dashboard' = 'public'): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: corsHeadersFor(req, mode) });
}

export function json(body: unknown, status = 200, headers: Record<string, string> = corsHeaders): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'content-type': 'application/json' },
  });
}

/** True if the Origin is allowed for the given mode. */
export function originAllowed(req: Request, mode: 'public' | 'dashboard'): boolean {
  if (mode === 'public') return true;
  const origin = req.headers.get('origin') ?? '';
  return dashboardOrigins().has(origin);
}
