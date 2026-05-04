// Resend email helpers + templates.
//
// We do NOT call Resend at confirmation time — we enqueue an email_deliveries
// row and let the cron-driven dispatcher drain the queue. This:
//   1. Keeps payment confirmation latency low (no extra round-trip).
//   2. Survives Resend outages with retry + backoff (mirrors webhook flow).
//   3. Keeps the receipt copy + tx-link rendering in one place — here.

export interface ResendSendResult {
  status: 'sent' | 'retryable' | 'hard_fail';
  statusCode: number;
  providerId?: string;
  errorMessage?: string;
}

export async function sendEmailViaResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<ResendSendResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') ?? 'Onramp <onboarding@resend.dev>';
  if (!apiKey) {
    // Fail loud rather than silently dropping a receipt.
    return {
      status: 'retryable',
      statusCode: 0,
      errorMessage: 'RESEND_API_KEY not configured',
    };
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  const bodyText = await resp.text();
  if (resp.ok) {
    let providerId: string | undefined;
    try {
      const j = JSON.parse(bodyText);
      providerId = typeof j.id === 'string' ? j.id : undefined;
    } catch { /* ignore */ }
    return { status: 'sent', statusCode: resp.status, providerId };
  }

  // Treat 4xx as hard fail (bad request, invalid recipient, etc).
  // Treat 5xx + network errors as retryable.
  if (resp.status >= 400 && resp.status < 500) {
    return {
      status: 'hard_fail',
      statusCode: resp.status,
      errorMessage: bodyText.slice(0, 1000),
    };
  }
  return {
    status: 'retryable',
    statusCode: resp.status,
    errorMessage: bodyText.slice(0, 1000),
  };
}

// ---------------------------------------------------------------------------
// Templates
//
// We render once at enqueue time so the cron does not need to know about
// dollar amounts / decimals / tx-link explorers. Each template returns
// { subject, html, text }. text is a graceful-fallback for clients that
// don't render HTML.
// ---------------------------------------------------------------------------

export interface ReceiptContext {
  // Display
  amountUsd: number;        // e.g. 19.99
  productName: string;
  network: 'solana' | 'polygon';
  token: string;            // 'USDC' | 'USDT'
  txHash: string;
  payerAddress: string;
  confirmedAt: string;      // ISO
  sessionId: string;
  isTest: boolean;
  // Branding
  merchantName: string | null;
}

export function customerReceipt(c: ReceiptContext): {
  subject: string;
  html: string;
  text: string;
} {
  const explorer = explorerUrlFor(c.network, c.txHash, c.isTest);
  const amount = formatUsd(c.amountUsd);
  const merchant = c.merchantName ?? 'the merchant';
  const testBanner = c.isTest
    ? `<div style="background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:16px;">TEST MODE — no real funds were transferred.</div>`
    : '';
  const testTextBanner = c.isTest
    ? '*** TEST MODE — no real funds were transferred. ***\n\n'
    : '';

  const subject = c.isTest
    ? `[TEST] Receipt from ${merchant} — ${amount}`
    : `Receipt from ${merchant} — ${amount}`;

  const html = `
<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    ${testBanner}
    <div style="font-size:14px;color:#a3a3a3;margin-bottom:8px;">Receipt</div>
    <h1 style="font-size:32px;font-weight:300;margin:0 0 24px 0;color:#fafafa;">${amount} <span style="color:#737373;font-size:18px;">paid</span></h1>
    <div style="border:1px solid #262626;border-radius:12px;padding:20px 24px;margin-bottom:24px;background:#0f0f0f;">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1f1f1f;">
        <span style="color:#737373;">Product</span>
        <span style="color:#fafafa;text-align:right;">${escapeHtml(c.productName)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1f1f1f;">
        <span style="color:#737373;">Paid to</span>
        <span style="color:#fafafa;">${escapeHtml(merchant)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1f1f1f;">
        <span style="color:#737373;">Network</span>
        <span style="color:#fafafa;">${escapeHtml(c.network)} · ${escapeHtml(c.token)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1f1f1f;">
        <span style="color:#737373;">Date</span>
        <span style="color:#fafafa;">${escapeHtml(formatDate(c.confirmedAt))}</span>
      </div>
      <div style="padding:8px 0;">
        <div style="color:#737373;margin-bottom:4px;">Transaction</div>
        <a href="${escapeAttr(explorer)}" style="color:#22d3ee;text-decoration:none;font-family:ui-monospace,monospace;font-size:12px;word-break:break-all;">${escapeHtml(c.txHash)}</a>
      </div>
    </div>
    <a href="${escapeAttr(explorer)}" style="display:inline-block;padding:10px 20px;background:#22d3ee;color:#0a0a0a;border-radius:8px;text-decoration:none;font-weight:500;">View on explorer</a>
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #262626;font-size:12px;color:#525252;">
      Reference: <span style="font-family:ui-monospace,monospace;">${escapeHtml(c.sessionId)}</span><br>
      Powered by Onramp.
    </div>
  </div>
</body></html>`.trim();

  const text = `${testTextBanner}Receipt from ${merchant}

${amount} paid

Product:     ${c.productName}
Paid to:     ${merchant}
Network:     ${c.network} · ${c.token}
Date:        ${formatDate(c.confirmedAt)}
Transaction: ${c.txHash}

View on explorer: ${explorer}

Reference: ${c.sessionId}
Powered by Onramp.`;

  return { subject, html, text };
}

export function merchantNotification(c: ReceiptContext): {
  subject: string;
  html: string;
  text: string;
} {
  const explorer = explorerUrlFor(c.network, c.txHash, c.isTest);
  const amount = formatUsd(c.amountUsd);
  const dashUrl = (Deno.env.get('PUBLIC_DASHBOARD_URL') ?? 'https://onramp-delta.vercel.app').replace(/\/+$/, '');
  const testTag = c.isTest ? '[TEST] ' : '';

  const subject = `${testTag}You got paid ${amount} for ${c.productName}`;

  const html = `
<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    ${c.isTest ? `<div style="background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:16px;">TEST MODE payment.</div>` : ''}
    <div style="font-size:14px;color:#a3a3a3;margin-bottom:8px;">Payment received</div>
    <h1 style="font-size:32px;font-weight:300;margin:0 0 8px 0;color:#22d3ee;">+${amount}</h1>
    <div style="color:#737373;margin-bottom:24px;">${escapeHtml(c.productName)}</div>
    <div style="border:1px solid #262626;border-radius:12px;padding:20px 24px;margin-bottom:24px;background:#0f0f0f;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="color:#737373;">From</span>
        <span style="color:#fafafa;font-family:ui-monospace,monospace;font-size:12px;">${escapeHtml(shortAddr(c.payerAddress))}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="color:#737373;">Network</span>
        <span style="color:#fafafa;">${escapeHtml(c.network)} · ${escapeHtml(c.token)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="color:#737373;">When</span>
        <span style="color:#fafafa;">${escapeHtml(formatDate(c.confirmedAt))}</span>
      </div>
    </div>
    <a href="${escapeAttr(dashUrl + '/transactions')}" style="display:inline-block;padding:10px 20px;background:#22d3ee;color:#0a0a0a;border-radius:8px;text-decoration:none;font-weight:500;margin-right:8px;">Open dashboard</a>
    <a href="${escapeAttr(explorer)}" style="display:inline-block;padding:10px 20px;background:transparent;color:#22d3ee;border:1px solid #22d3ee;border-radius:8px;text-decoration:none;font-weight:500;">View tx</a>
  </div>
</body></html>`.trim();

  const text = `${c.isTest ? '*** TEST MODE ***\n\n' : ''}You got paid ${amount} for ${c.productName}.

From:    ${shortAddr(c.payerAddress)}
Network: ${c.network} · ${c.token}
When:    ${formatDate(c.confirmedAt)}

Dashboard: ${dashUrl}/transactions
Tx:        ${explorer}`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
function explorerUrlFor(network: string, txHash: string, isTest: boolean): string {
  if (network === 'solana') {
    const cluster = isTest ? '?cluster=devnet' : '';
    return `https://solscan.io/tx/${txHash}${cluster}`;
  }
  if (network === 'polygon') {
    return isTest
      ? `https://amoy.polygonscan.com/tx/${txHash}`
      : `https://polygonscan.com/tx/${txHash}`;
  }
  return '#';
}

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toUTCString();
  } catch {
    return iso;
  }
}

function shortAddr(a: string): string {
  if (!a) return '';
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
