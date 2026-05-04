// Single source of truth for token mints + decimals across live and test
// modes. Imported by create-checkout-session, v1, verify-payment, and the
// webhook dispatcher.
//
// Test mode notes:
//   * Solana devnet USDC = the mint Circle issues on devnet.
//   * Polygon Amoy has no canonical USDT, so test mode uses USDC on Amoy.
//     This is a deliberate live/test asymmetry; documented in the README
//     and the dashboard Settings UI.

export type Network = 'solana' | 'polygon';
export type Mode = 'live' | 'test';

export type TokenInfo = {
  symbol: string;     // 'USDC' | 'USDT'
  mint: string;       // SPL mint or EVM contract address
  decimals: number;   // base-unit decimals (6 for USDC/USDT)
};

export const TOKEN_REGISTRY: Record<Mode, Record<Network, TokenInfo>> = {
  live: {
    solana: {
      symbol: 'USDC',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
    },
    polygon: {
      symbol: 'USDT',
      mint: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      decimals: 6,
    },
  },
  test: {
    solana: {
      symbol: 'USDC',
      mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Circle devnet USDC
      decimals: 6,
    },
    polygon: {
      symbol: 'USDC',
      mint: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Circle Amoy USDC
      decimals: 6,
    },
  },
};

export function tokenFor(mode: Mode, network: Network): TokenInfo {
  return TOKEN_REGISTRY[mode][network];
}

export function tokenDecimals(symbol: string): number {
  switch (symbol) {
    case 'USDC':
    case 'USDT':
      return 6;
    default:
      throw new Error(`unknown token: ${symbol}`);
  }
}
