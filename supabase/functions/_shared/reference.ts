// Reference generation + reference-binding helpers.
//
// We bind an on-chain payment to a checkout_session using two mechanisms:
//
//   - SOLANA  : a unique opaque string in the SPL Memo Program instruction.
//               (e.g. "onramp:<reference>")
//
//   - POLYGON : a per-session sub-cent suffix encoded into amount_minor.
//               The base price is rounded to whole cents (4 trailing zeros
//               in 6-decimal minor units), and we replace the last 4 digits
//               with a 4-digit reference suffix unique within the merchant's
//               currently-active sessions.
//
// On both chains, the reference is the *canonical* binding — we refuse to
// confirm a payment whose reference does not match.

const SOLANA_MEMO_TAG = 'onramp:';

export function solanaMemo(reference: string): string {
  return `${SOLANA_MEMO_TAG}${reference}`;
}

export function extractSolanaReference(memo: string | null | undefined): string | null {
  if (!memo) return null;
  const idx = memo.indexOf(SOLANA_MEMO_TAG);
  if (idx < 0) return null;
  return memo.slice(idx + SOLANA_MEMO_TAG.length).trim();
}

// ---------------------------------------------------------------------------
// Polygon: amount_minor with a 4-digit suffix encoding the reference.
// ---------------------------------------------------------------------------

const POLYGON_SUFFIX_DIGITS = 4;
const POLYGON_SUFFIX_MOD = 10 ** POLYGON_SUFFIX_DIGITS;

/**
 * Apply the 4-digit reference suffix to a cent-rounded `base_minor`.
 *
 * Example: base_minor = 99_000_000 (== $99.00 in 6dp), suffix = 4217
 *          result    = 99_004_217
 *
 * The customer is shown the exact final amount; the merchant is paid the
 * exact final amount (the few sub-cents are negligible and bound the payment
 * to a specific session unambiguously).
 */
export function applyPolygonSuffix(baseMinor: bigint, suffix: number): bigint {
  if (suffix < 0 || suffix >= POLYGON_SUFFIX_MOD) {
    throw new Error(`suffix out of range: ${suffix}`);
  }
  // Strip the last 4 digits (in case caller didn't pre-round) and add suffix.
  const stripped = (baseMinor / BigInt(POLYGON_SUFFIX_MOD)) * BigInt(POLYGON_SUFFIX_MOD);
  return stripped + BigInt(suffix);
}

/** Allocate a fresh suffix; caller must verify uniqueness against active sessions. */
export function randomPolygonSuffix(): number {
  // Avoid 0000 to keep the suffix visually obvious in the UI.
  return 1 + Math.floor(Math.random() * (POLYGON_SUFFIX_MOD - 1));
}

// ---------------------------------------------------------------------------
// Reference id (uuid-like, url-safe, short).
// ---------------------------------------------------------------------------

export function newReference(): string {
  // 16 bytes => 22 base64url chars; safe to embed in memos and URLs.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
