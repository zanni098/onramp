// RPC URL resolution per (network, mode). Same Helius/Alchemy API keys
// work across mainnet/devnet and mainnet/Amoy respectively.

export function solanaRpcUrl(isTest: boolean): string {
  const helius = Deno.env.get('HELIUS_API_KEY');
  if (helius) {
    return isTest
      ? `https://devnet.helius-rpc.com/?api-key=${helius}`
      : `https://mainnet.helius-rpc.com/?api-key=${helius}`;
  }
  // Per-mode override fallbacks.
  const explicit = isTest
    ? Deno.env.get('SOLANA_DEVNET_RPC_URL')
    : Deno.env.get('SOLANA_RPC_URL');
  if (explicit) return explicit;
  // Public last-resort fallback. Rate-limited; acceptable for tests, never
  // for live volume — but live always has Helius configured.
  return isTest
    ? 'https://api.devnet.solana.com'
    : 'https://api.mainnet-beta.solana.com';
}

export function polygonRpcUrl(isTest: boolean): string {
  const alchemy = Deno.env.get('ALCHEMY_API_KEY');
  if (alchemy) {
    return isTest
      ? `https://polygon-amoy.g.alchemy.com/v2/${alchemy}`
      : `https://polygon-mainnet.g.alchemy.com/v2/${alchemy}`;
  }
  const explicit = isTest
    ? Deno.env.get('POLYGON_AMOY_RPC_URL')
    : Deno.env.get('POLYGON_RPC_URL');
  if (explicit) return explicit;
  return isTest
    ? 'https://rpc-amoy.polygon.technology'
    : 'https://polygon-rpc.com';
}
