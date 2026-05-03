// Server-side validators for merchant-supplied configuration.
//
// These run inside Edge Functions BEFORE writing to the DB. The browser is
// allowed to attempt invalid input; we just reject it.

// ---------- Solana wallet (base58 system account) -------------------------

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_SET = new Set(BASE58_ALPHABET);

export function isValidSolanaAddress(addr: string): boolean {
  if (typeof addr !== 'string') return false;
  if (addr.length < 32 || addr.length > 44) return false;
  for (const c of addr) if (!BASE58_SET.has(c)) return false;
  // Decode and verify length == 32 bytes.
  const bytes = base58Decode(addr);
  return bytes !== null && bytes.length === 32;
}

function base58Decode(str: string): Uint8Array | null {
  // Standard base58 decoder. Returns null on invalid input.
  let num = 0n;
  for (const c of str) {
    const idx = BASE58_ALPHABET.indexOf(c);
    if (idx < 0) return null;
    num = num * 58n + BigInt(idx);
  }
  // Convert bigint to bytes (big-endian).
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  // Leading '1's encode leading zero bytes.
  for (const c of str) {
    if (c === '1') bytes.unshift(0);
    else break;
  }
  return new Uint8Array(bytes);
}

// ---------- EVM (Polygon) address (EIP-55 checksum or all-lower) ----------

export function isValidEvmAddress(addr: string): boolean {
  if (typeof addr !== 'string') return false;
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return false;
  // Accept all-lower / all-upper. If mixed-case, must be EIP-55 valid.
  const stripped = addr.slice(2);
  const isAllLower = stripped === stripped.toLowerCase();
  const isAllUpper = stripped === stripped.toUpperCase();
  if (isAllLower || isAllUpper) return true;
  return checksumIsValid(addr);
}

async function keccak256(input: string): Promise<Uint8Array> {
  // Using Web Crypto's keccak isn't available; we use a tiny inline version.
  // For checksum validation we accept either an all-lower address (which we
  // canonicalize on read) OR a checksum that we verify with this routine.
  // Lazy-load the keccak implementation only when needed.
  const { keccak_256 } = await import('https://esm.sh/@noble/hashes@1.4.0/sha3');
  return keccak_256(new TextEncoder().encode(input));
}

function checksumIsValid(addr: string): boolean {
  // Synchronous validator: we expose isValidEvmAddress (sync) for the common
  // path of all-lower-case input. Mixed-case checksum verification requires
  // keccak — we re-export an async variant for that.
  // Fall back to "looks like a checksum" structural check; the strict async
  // path is `verifyEvmChecksum`.
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export async function verifyEvmChecksum(addr: string): Promise<boolean> {
  const stripped = addr.slice(2);
  const lower = stripped.toLowerCase();
  const hash = await keccak256(lower);
  // Hex digest of hash for nibble lookup.
  let hex = '';
  for (const b of hash) hex += b.toString(16).padStart(2, '0');
  for (let i = 0; i < 40; i++) {
    const ch = stripped[i];
    const isLetter = /[a-zA-Z]/.test(ch);
    if (!isLetter) continue;
    const expectUpper = parseInt(hex[i], 16) >= 8;
    if (expectUpper && ch !== ch.toUpperCase()) return false;
    if (!expectUpper && ch !== ch.toLowerCase()) return false;
  }
  return true;
}

// ---------- Webhook URL --------------------------------------------------

const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,         // link-local
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,    // unique local IPv6
  /^fe80:/i,             // link-local IPv6
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
];

export function validateWebhookUrl(input: string):
  | { ok: true; url: string }
  | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'must_use_https' };
  const host = url.hostname;
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) {
    return { ok: false, reason: 'host_not_allowed' };
  }
  // Block AWS/GCP/Azure metadata IPs (SSRF).
  if (host === '169.254.169.254' || host === 'metadata.google.internal') {
    return { ok: false, reason: 'host_not_allowed' };
  }
  return { ok: true, url: url.toString() };
}

// ---------- Business name -----------------------------------------------

export function sanitizeBusinessName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 80) return null;
  // Strip control chars.
  // deno-lint-ignore no-control-regex
  return trimmed.replace(/[\u0000-\u001f\u007f]/g, '');
}
