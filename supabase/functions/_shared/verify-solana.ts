// Pure on-chain verifier for Solana SPL stablecoin payments.
//
// Inputs:
//   - txHash:                 the candidate transaction signature
//   - expectedDestination:    merchant wallet (system account, NOT ATA)
//   - expectedTokenMint:      e.g. USDC mint EPjFW...
//   - expectedAmountMinor:    the exact transferred amount in raw token units
//   - expectedReference:      the session reference we expect in the memo
//   - rpcUrl:                 a finalized-commitment Solana RPC endpoint
//
// Returns one of:
//   { status: 'pending' }                            // not finalized yet, retry later
//   { status: 'failed', reason: string }             // terminal mismatch / on-chain failure
//   { status: 'confirmed', payerAddress: string }    // all invariants satisfied
//
// The function is pure: no DB writes, no env reads. It is the unit-testable core.

import { extractSolanaReference } from './reference.ts';

export interface VerifySolanaInput {
  txHash: string;
  expectedDestination: string;
  expectedTokenMint: string;
  expectedAmountMinor: bigint;
  expectedReference: string;
  rpcUrl: string;
}

export type VerifyResult =
  | { status: 'pending' }
  | { status: 'failed'; reason: string }
  | { status: 'confirmed'; payerAddress: string };

interface RpcTokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
}

interface RpcTransaction {
  slot: number;
  blockTime?: number | null;
  transaction: {
    message: {
      accountKeys: Array<{ pubkey: string; signer: boolean; writable: boolean } | string>;
      instructions: Array<{
        programId?: string;
        program?: string;
        parsed?: unknown;
        accounts?: string[];
        data?: string;
      }>;
    };
    signatures: string[];
  };
  meta: {
    err: unknown | null;
    preTokenBalances?: RpcTokenBalance[];
    postTokenBalances?: RpcTokenBalance[];
    innerInstructions?: Array<{
      index: number;
      instructions: Array<{ programId?: string; program?: string; parsed?: unknown }>;
    }>;
    logMessages?: string[];
  } | null;
}

const SPL_MEMO_PROGRAM_IDS = new Set([
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', // SPL Memo v2 (current)
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo', // legacy
]);

export async function verifySolanaPayment(
  input: VerifySolanaInput,
): Promise<VerifyResult> {
  const tx = await rpcGetTransaction(input.rpcUrl, input.txHash);

  // Not yet visible at finalized commitment.
  if (!tx) return { status: 'pending' };

  if (!tx.meta) {
    return { status: 'failed', reason: 'tx has no meta' };
  }
  if (tx.meta.err !== null) {
    return { status: 'failed', reason: `on-chain error: ${JSON.stringify(tx.meta.err)}` };
  }

  // 1. Memo / reference binding.
  const memos = collectMemos(tx);
  const matchingMemo = memos.find((m) => extractSolanaReference(m) === input.expectedReference);
  if (!matchingMemo) {
    return {
      status: 'failed',
      reason: `memo missing or does not match reference (saw ${memos.length} memos)`,
    };
  }

  // 2. Token-balance delta to the merchant's destination.
  const pre = tx.meta.preTokenBalances ?? [];
  const post = tx.meta.postTokenBalances ?? [];

  // Find the post-balance entry that belongs to expectedDestination + expectedMint.
  const destPost = post.find(
    (b) => b.owner === input.expectedDestination && b.mint === input.expectedTokenMint,
  );
  if (!destPost) {
    return {
      status: 'failed',
      reason: 'destination token account not credited in this tx',
    };
  }
  const destPre = pre.find(
    (b) =>
      b.accountIndex === destPost.accountIndex &&
      b.mint === input.expectedTokenMint,
  );

  const preAmount = destPre ? BigInt(destPre.uiTokenAmount.amount) : 0n;
  const postAmount = BigInt(destPost.uiTokenAmount.amount);
  const delta = postAmount - preAmount;

  if (delta !== input.expectedAmountMinor) {
    return {
      status: 'failed',
      reason: `amount mismatch: expected ${input.expectedAmountMinor}, got delta ${delta}`,
    };
  }

  // 3. Identify the payer: any pre-balance owner whose token balance decreased
  //    by the same amount (or more, accounting for multi-source — but for a
  //    typical wallet payment, exactly one).
  const payerAddress = inferPayer(pre, post, input.expectedTokenMint, delta);
  if (!payerAddress) {
    return { status: 'failed', reason: 'could not identify payer' };
  }

  return { status: 'confirmed', payerAddress };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function rpcGetTransaction(
  rpcUrl: string,
  signature: string,
): Promise<RpcTransaction | null> {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: [
      signature,
      {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0,
        encoding: 'jsonParsed',
      },
    ],
  };

  const resp = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`Solana RPC ${resp.status}: ${await resp.text()}`);
  }
  const json = await resp.json() as { result: RpcTransaction | null; error?: unknown };
  if (json.error) {
    throw new Error(`Solana RPC error: ${JSON.stringify(json.error)}`);
  }
  return json.result;
}

function collectMemos(tx: RpcTransaction): string[] {
  const out: string[] = [];

  const scan = (
    ix: { programId?: string; program?: string; parsed?: unknown },
  ) => {
    const pid = ix.programId ?? '';
    const isMemo =
      ix.program === 'spl-memo' ||
      SPL_MEMO_PROGRAM_IDS.has(pid);
    if (!isMemo) return;
    if (typeof ix.parsed === 'string') out.push(ix.parsed);
  };

  for (const ix of tx.transaction.message.instructions) scan(ix);
  for (const inner of tx.meta?.innerInstructions ?? []) {
    for (const ix of inner.instructions) scan(ix);
  }

  // Belt-and-braces: some RPCs surface memos via log messages too.
  for (const log of tx.meta?.logMessages ?? []) {
    const m = /Program log: Memo \(\d+\): "(.+)"/.exec(log);
    if (m) out.push(m[1]);
  }

  return out;
}

function inferPayer(
  pre: RpcTokenBalance[],
  post: RpcTokenBalance[],
  mint: string,
  delta: bigint,
): string | null {
  // Find an account whose balance dropped by exactly `delta` for this mint.
  const byIdx = new Map<number, { owner?: string; pre: bigint; post: bigint }>();
  for (const b of pre) {
    if (b.mint !== mint) continue;
    byIdx.set(b.accountIndex, {
      owner: b.owner,
      pre: BigInt(b.uiTokenAmount.amount),
      post: 0n,
    });
  }
  for (const b of post) {
    if (b.mint !== mint) continue;
    const e = byIdx.get(b.accountIndex) ?? { owner: b.owner, pre: 0n, post: 0n };
    e.owner = e.owner ?? b.owner;
    e.post = BigInt(b.uiTokenAmount.amount);
    byIdx.set(b.accountIndex, e);
  }

  for (const e of byIdx.values()) {
    if (e.pre - e.post === delta && e.owner) return e.owner;
  }
  return null;
}
