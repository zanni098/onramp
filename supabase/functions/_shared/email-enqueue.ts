// Helper to insert pre-rendered email_deliveries rows on payment confirmation.
// Called from both verify-payment (happy path) and webhook-dispatcher
// (catchup), so it must be idempotent at the (session_id, kind) level.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { customerReceipt, merchantNotification, type ReceiptContext } from './email.ts';

// Convenience wrapper that reads merchant email + display name from the
// database and then enqueues both emails. Both verify-payment and the
// catchup verifier in webhook-dispatcher call this; idempotency is
// handled inside enqueuePaymentEmails (dedupe on session_id + kind).
export async function enqueueEmailsForConfirmedSession(
  supabase: SupabaseClient,
  session: {
    id: string;
    merchant_id: string;
    product_id: string;
    amount_minor: number | string;
    network: 'solana' | 'polygon';
    token: string;
    customer_email?: string | null;
    is_test?: boolean | null;
  },
  payerAddress: string,
  txHash: string,
  confirmedAtIso: string,
): Promise<void> {
  // Product name.
  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('id', session.product_id)
    .maybeSingle();
  const productName = product?.name ?? 'product';

  // Merchant email comes from auth.users (auth schema; service-role only).
  // Merchant display name comes from public.profiles.
  let merchantEmail: string | null = null;
  let merchantName: string | null = null;
  try {
    const { data: usr } = await supabase.auth.admin.getUserById(session.merchant_id);
    merchantEmail = usr?.user?.email ?? null;
  } catch (e) {
    console.warn('merchant email lookup failed', String(e));
  }
  const { data: prof } = await supabase
    .from('profiles')
    .select('business_name')
    .eq('id', session.merchant_id)
    .maybeSingle();
  merchantName = prof?.business_name ?? null;

  await enqueuePaymentEmails(supabase, {
    sessionId: session.id,
    merchantId: session.merchant_id,
    productName,
    amountMinor: BigInt(session.amount_minor),
    tokenSymbol: session.token,
    network: session.network,
    txHash,
    payerAddress,
    confirmedAtIso,
    isTest: !!session.is_test,
    customerEmail: session.customer_email ?? null,
    merchantEmail,
    merchantName,
  });
}

export interface EnqueueArgs {
  sessionId: string;
  merchantId: string;
  productName: string;
  amountMinor: bigint;
  tokenSymbol: string;       // 'USDC' | 'USDT'
  network: 'solana' | 'polygon';
  txHash: string;
  payerAddress: string;
  confirmedAtIso: string;
  isTest: boolean;
  customerEmail: string | null;
  merchantEmail: string | null;
  merchantName: string | null;
}

export async function enqueuePaymentEmails(
  supabase: SupabaseClient,
  args: EnqueueArgs,
): Promise<{ enqueued: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let enqueued = 0;
  let skipped = 0;

  // amount_minor -> USD (USDC and USDT are both 6dp on the chains we support)
  const amountUsd = Number(args.amountMinor) / 1_000_000;

  const ctx: ReceiptContext = {
    amountUsd,
    productName: args.productName,
    network: args.network,
    token: args.tokenSymbol,
    txHash: args.txHash,
    payerAddress: args.payerAddress,
    confirmedAt: args.confirmedAtIso,
    sessionId: args.sessionId,
    isTest: args.isTest,
    merchantName: args.merchantName,
  };

  // 1. Customer receipt (only if email was collected).
  if (args.customerEmail) {
    const t = customerReceipt(ctx);
    const res = await insertOnce(supabase, {
      session_id: args.sessionId,
      merchant_id: args.merchantId,
      kind: 'customer_receipt',
      to_email: args.customerEmail,
      subject: t.subject,
      html: t.html,
      text: t.text,
      is_test: args.isTest,
    });
    if (res === 'inserted') enqueued++;
    else if (res === 'duplicate') skipped++;
    else errors.push(`customer_receipt: ${res}`);
  } else {
    skipped++;
  }

  // 2. Merchant notification (only if we have a merchant email).
  if (args.merchantEmail) {
    const t = merchantNotification(ctx);
    const res = await insertOnce(supabase, {
      session_id: args.sessionId,
      merchant_id: args.merchantId,
      kind: 'merchant_notification',
      to_email: args.merchantEmail,
      subject: t.subject,
      html: t.html,
      text: t.text,
      is_test: args.isTest,
    });
    if (res === 'inserted') enqueued++;
    else if (res === 'duplicate') skipped++;
    else errors.push(`merchant_notification: ${res}`);
  } else {
    skipped++;
  }

  return { enqueued, skipped, errors };
}

// Idempotency: dedupe on (session_id, kind). The DB doesn't enforce a unique
// constraint here (we want operational flexibility — e.g. resend on demand),
// so we look first and only insert if missing. Race window between the
// SELECT and INSERT is fine: the dispatcher itself dedupes by claiming with
// a status flip, so even if two rows do land, only one is sent.
async function insertOnce(
  supabase: SupabaseClient,
  row: {
    session_id: string;
    merchant_id: string;
    kind: 'customer_receipt' | 'merchant_notification';
    to_email: string;
    subject: string;
    html: string;
    text: string;
    is_test: boolean;
  },
): Promise<'inserted' | 'duplicate' | string> {
  const { data: existing, error: selErr } = await supabase
    .from('email_deliveries')
    .select('id')
    .eq('session_id', row.session_id)
    .eq('kind', row.kind)
    .limit(1);
  if (selErr) return `select_failed: ${selErr.message}`;
  if (existing && existing.length > 0) return 'duplicate';

  const { error: insErr } = await supabase.from('email_deliveries').insert(row);
  if (insErr) return `insert_failed: ${insErr.message}`;
  return 'inserted';
}
