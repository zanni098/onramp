import React, { useEffect, useState } from 'react';
import {
  Copy, Save, Loader,
  CheckCircle2, XCircle, Clock, AlertTriangle,
  RefreshCw, ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  updateMerchantConfig,
  getMerchantSecrets,
  rotateWebhookSecret,
} from '../lib/api';

interface Delivery {
  id: string;
  event: string;
  url: string;
  status: 'queued' | 'delivering' | 'delivered' | 'failed';
  attempt_count: number;
  last_status_code: number | null;
  last_error: string | null;
  delivered_at: string | null;
  created_at: string;
}

const Webhooks = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const [secret, setSecret] = useState<string | null>(null);
  const [secretLoading, setSecretLoading] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    if (profile?.webhook_url) setUrl(profile.webhook_url);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from('webhook_deliveries')
        .select('id,event,url,status,attempt_count,last_status_code,last_error,delivered_at,created_at')
        .eq('merchant_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (alive && data) setDeliveries(data as Delivery[]);
    };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMerchantConfig({ webhook_url: url || null });
      await refreshProfile();
      toast.success('Webhook URL saved');
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.startsWith('invalid_webhook_url:must_use_https')) toast.error('URL must use https://');
      else if (msg.startsWith('invalid_webhook_url:host_not_allowed')) toast.error('That host is not allowed (private/loopback/metadata)');
      else if (msg.startsWith('invalid_webhook_url')) toast.error('Invalid webhook URL');
      else toast.error(msg || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const revealSecret = async () => {
    setSecretLoading(true);
    try {
      const s = await getMerchantSecrets();
      setSecret(s.webhook_secret);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not load secret');
    } finally {
      setSecretLoading(false);
    }
  };

  const rotate = async () => {
    if (!confirm('Rotating will invalidate the current secret. Webhooks signed with the old secret will start being rejected. Continue?')) return;
    setRotating(true);
    try {
      const r = await rotateWebhookSecret();
      setSecret(r.webhook_secret);
      toast.success('Webhook secret rotated');
    } catch (e: any) {
      toast.error(e?.message ?? 'Rotation failed');
    } finally {
      setRotating(false);
    }
  };

  const copySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    toast.success('Webhook secret copied');
  };

  return (
    <div>
      <h1 className="text-4xl mb-2">Webhooks</h1>
      <p className="text-zinc-500 mb-8">
        Onramp POSTs a signed payload to your endpoint when a payment is confirmed.
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glow-card p-8">
          <h3 className="text-xl mb-6">Configuration</h3>
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Endpoint URL</label>
              <input
                className="glass-input w-full"
                type="url"
                placeholder="https://api.yourdomain.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-zinc-600 mt-1">
                Server-side validation: HTTPS required, no loopback / private IPs.
              </p>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Webhook Secret</label>
              {secret ? (
                <>
                  <div className="flex gap-2">
                    <input
                      className="glass-input flex-1 font-mono text-sm"
                      readOnly
                      value={secret}
                    />
                    <button type="button" onClick={copySecret} className="glow-button-secondary px-3">
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={rotate}
                      disabled={rotating}
                      className="glow-button-secondary px-3"
                      title="Rotate secret"
                    >
                      {rotating ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-600 mt-2">
                    Verify the <code className="text-zinc-400">Onramp-Signature</code> header
                    using HMAC-SHA256 over <code className="text-zinc-400">{`${'${ts}.${body}'}`}</code>.
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  onClick={revealSecret}
                  disabled={secretLoading}
                  className="glow-button-secondary text-sm px-4 py-2 flex items-center gap-2"
                >
                  {secretLoading ? <Loader size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                  Reveal webhook secret
                </button>
              )}
            </div>

            <button type="submit" disabled={saving} className="glow-button flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save Configuration'}
            </button>
          </form>
        </div>

        <div className="glow-card p-8">
          <h3 className="text-xl mb-4">Verification</h3>
          <VerificationExamples />
        </div>
      </div>

      <div className="glow-card p-8 mt-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl">Recent Deliveries</h3>
          <span className="text-xs text-zinc-500">Auto-refreshing</span>
        </div>
        {deliveries.length === 0 ? (
          <p className="text-zinc-500 text-sm">No deliveries yet.</p>
        ) : (
          <div className="space-y-2">
            {deliveries.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between border border-zinc-800 rounded-xl px-4 py-3 bg-black/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon status={d.status} />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{d.event}</p>
                    <p className="text-xs text-zinc-500 truncate">{d.url}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-400">
                    {d.last_status_code ?? '—'} · attempt {d.attempt_count}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    {new Date(d.delivered_at ?? d.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glow-card p-8 mt-6">
        <h3 className="text-xl mb-4">Payload Schema</h3>
        <pre className="bg-black/60 rounded-xl p-4 text-xs text-zinc-300 overflow-x-auto border border-zinc-800">
          {`{
  "event":         "payment.confirmed",
  "session_id":    "uuid",
  "product_id":    "uuid",
  "amount_minor":  99000000,
  "amount_usd":    99.00,
  "currency":      "USD",
  "network":       "solana" | "polygon",
  "token":         "USDC" | "USDT",
  "reference":     "string",
  "tx_hash":       "string",
  "payer_address": "string",
  "timestamp":     "ISO 8601"
}`}
        </pre>
      </div>
    </div>
  );
};

export default Webhooks;

const NODE_EXAMPLE = `import crypto from 'crypto';

function verify(req, secret) {
  const header = req.headers['onramp-signature']; // "t=...,v1=..."
  const parts  = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const ts     = Number(parts.t);
  const sig    = parts.v1;

  // Reject if older than 5 minutes (replay protection)
  if (Math.abs(Date.now()/1000 - ts) > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${ts}.\${req.rawBody}\`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(sig, 'hex'),
  );
}`;

const WEBCRYPTO_EXAMPLE = `// Works in Deno, Cloudflare Workers, Vercel Edge, and modern browsers.
// 'rawBody' MUST be the exact bytes the server signed — do not parse-then-stringify.

export async function verify(rawBody: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const ts  = Number(parts.t);
  const sig = parts.v1 as string;

  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const macBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(\`\${ts}.\${rawBody}\`),
  );
  const expected = [...new Uint8Array(macBuf)]
    .map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time compare.
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}`;

function VerificationExamples() {
  const [tab, setTab] = useState<'node' | 'edge'>('node');
  return (
    <div>
      <div className="flex gap-2 mb-3">
        {(['node', 'edge'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1 rounded-full border transition ${tab === t
                ? 'border-accent text-white bg-accent/10'
                : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
              }`}
          >
            {t === 'node' ? 'Node.js' : 'Deno / Cloudflare / Edge'}
          </button>
        ))}
      </div>
      <pre className="bg-black/60 rounded-xl p-4 text-xs text-zinc-300 overflow-x-auto border border-zinc-800">
        {tab === 'node' ? NODE_EXAMPLE : WEBCRYPTO_EXAMPLE}
      </pre>
    </div>
  );
}

function StatusIcon({ status }: { status: Delivery['status'] }) {
  if (status === 'delivered') return <CheckCircle2 className="text-success shrink-0" size={18} />;
  if (status === 'failed') return <XCircle className="text-red-400 shrink-0" size={18} />;
  if (status === 'delivering') return <AlertTriangle className="text-yellow-400 shrink-0" size={18} />;
  return <Clock className="text-zinc-500 shrink-0" size={18} />;
}
