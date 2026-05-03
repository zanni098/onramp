// HMAC-SHA256 helpers using the WebCrypto API.
//
// Signature format (Stripe-style):
//
//   Onramp-Signature: t=<unix_seconds>,v1=<hex(HMAC_SHA256(secret, t + "." + body))>
//
// Merchants verify by:
//   1. Splitting on "," to extract t and v1.
//   2. Recomputing HMAC_SHA256(secret, t + "." + raw_body).
//   3. constant-time-comparing against v1.
//   4. Rejecting if |now - t| exceeds a freshness window (replay protection).

export async function signPayload(
  secret: string,
  body: string,
  timestamp: number,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${timestamp}.${body}`),
  );
  return toHex(new Uint8Array(sigBuf));
}

export function signatureHeader(timestamp: number, hexSig: string): string {
  return `t=${timestamp},v1=${hexSig}`;
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}
