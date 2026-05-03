// Pure on-chain verifier for Polygon ERC-20 stablecoin payments.
//
// Inputs:
//   - txHash:                 candidate transaction hash (0x...)
//   - expectedDestination:    merchant wallet (EOA, lowercased)
//   - expectedTokenContract:  e.g. USDT 0xc2132...
//   - expectedAmountMinor:    exact transferred amount in raw token units
//                             (with the per-session reference suffix already applied)
//   - confirmations:          how many blocks deep the receipt must be
//   - rpcUrl:                 a Polygon JSON-RPC endpoint (Alchemy)
//
// Returns:
//   { status: 'pending' }                            // not yet sufficiently confirmed
//   { status: 'failed', reason: string }             // tx reverted or invariant mismatch
//   { status: 'confirmed', payerAddress: string }
//
// Notes:
//   - We do NOT trust `tx.value` or `tx.from` — we trust the canonical
//     ERC-20 Transfer log on the expected token contract.
//   - "Reference" binding is implicit: amount_minor itself is unique per
//     active session via the sub-cent suffix (see _shared/reference.ts).
//     If two sessions ever collided on the same suffix, we'd see both rows
//     and refuse to confirm; the create-checkout-session endpoint enforces
//     suffix uniqueness within active sessions to prevent that.

import type { VerifyResult } from './verify-solana.ts';
export type { VerifyResult };

export interface VerifyPolygonInput {
  txHash: string;
  expectedDestination: string;
  expectedTokenContract: string;
  expectedAmountMinor: bigint;
  confirmations: number;
  rpcUrl: string;
}

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

interface RpcReceipt {
  status: string; // '0x1' success, '0x0' failure
  blockNumber: string; // hex
  from: string;
  to: string | null;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}

export async function verifyPolygonPayment(
  input: VerifyPolygonInput,
): Promise<VerifyResult> {
  const receipt = await rpcCall<RpcReceipt | null>(
    input.rpcUrl,
    'eth_getTransactionReceipt',
    [input.txHash],
  );

  if (!receipt) return { status: 'pending' };

  if (receipt.status !== '0x1') {
    return { status: 'failed', reason: `tx reverted (status=${receipt.status})` };
  }

  // Confirmation depth.
  const txBlock = BigInt(receipt.blockNumber);
  const headHex = await rpcCall<string>(input.rpcUrl, 'eth_blockNumber', []);
  const head = BigInt(headHex);
  const depth = head - txBlock;
  if (depth < BigInt(input.confirmations)) {
    return { status: 'pending' };
  }

  // Find the canonical Transfer log on the expected token contract.
  const tokenAddr = input.expectedTokenContract.toLowerCase();
  const dest = input.expectedDestination.toLowerCase();

  const matching = receipt.logs.filter(
    (log) =>
      log.address.toLowerCase() === tokenAddr &&
      log.topics[0]?.toLowerCase() === TRANSFER_TOPIC,
  );

  if (matching.length === 0) {
    return {
      status: 'failed',
      reason: `no Transfer event from ${tokenAddr} in this tx`,
    };
  }

  for (const log of matching) {
    const toTopic = log.topics[2];
    if (!toTopic) continue;
    const toAddress = '0x' + toTopic.slice(-40).toLowerCase();
    if (toAddress !== dest) continue;

    const amount = BigInt(log.data); // single uint256 in data
    if (amount !== input.expectedAmountMinor) {
      // Right destination, wrong amount — keep scanning in case a separate
      // event matches; if none does, fall through to the explicit failure.
      continue;
    }

    const fromTopic = log.topics[1];
    const payer = fromTopic ? '0x' + fromTopic.slice(-40).toLowerCase() : '';
    if (!payer) continue;

    return { status: 'confirmed', payerAddress: payer };
  }

  return {
    status: 'failed',
    reason: `no Transfer matched destination=${dest} amount=${input.expectedAmountMinor}`,
  };
}

// ---------------------------------------------------------------------------
// JSON-RPC helper
// ---------------------------------------------------------------------------

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const resp = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  if (!resp.ok) {
    throw new Error(`Polygon RPC ${resp.status}: ${await resp.text()}`);
  }
  const json = await resp.json() as { result: T; error?: { message?: string } };
  if (json.error) {
    throw new Error(`Polygon RPC error in ${method}: ${json.error.message}`);
  }
  return json.result;
}
