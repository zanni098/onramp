import React, { useEffect, useState } from 'react';
import { Copy, Save, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Webhooks = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.webhook_url) setUrl(profile.webhook_url);
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return toast.error('Enter a webhook URL');
    try { new URL(url); } catch { return toast.error('Enter a valid URL including https://'); }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ webhook_url: url }).eq('id', user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success('Webhook URL saved');
  };

  const copySecret = () => {
    if (!profile?.webhook_secret) return;
    navigator.clipboard.writeText(profile.webhook_secret);
    toast.success('Webhook secret copied');
  };

  return (
    <div>
      <h1 className="text-4xl mb-2">Webhooks</h1>
      <p className="text-zinc-500 mb-8">Onramp will POST to your endpoint when a payment is confirmed.</p>

      <div className="glow-card p-8 max-w-xl mb-6">
        <h3 className="text-xl mb-6">Configuration</h3>
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Endpoint URL</label>
            <input
              className="glass-input w-full"
              type="url"
              placeholder="https://api.yourdomain.com/webhook"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Webhook Secret (HMAC-SHA256)</label>
            <div className="flex gap-2">
              <input
                className="glass-input flex-1 font-mono text-sm"
                type="text"
                readOnly
                value={profile?.webhook_secret ?? '—'}
              />
              <button type="button" onClick={copySecret} className="glow-button-secondary px-3">
                <Copy size={14} />
              </button>
            </div>
            <p className="text-xs text-zinc-600 mt-2">Use this secret to verify webhook payloads with HMAC-SHA256.</p>
          </div>
          <button type="submit" disabled={saving} className="glow-button flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </form>
      </div>

      <div className="glow-card p-8 max-w-xl">
        <h3 className="text-xl mb-4">Payload Schema</h3>
        <pre className="bg-black/60 rounded-xl p-4 text-xs text-zinc-300 overflow-x-auto border border-zinc-800">
{`{
  "event": "payment.confirmed",
  "transaction_id": "uuid",
  "product_id": "uuid",
  "amount_usd": 99.00,
  "network": "solana" | "polygon",
  "tx_hash": "on-chain tx hash",
  "payer_address": "wallet address",
  "timestamp": "ISO 8601"
}`}
        </pre>
      </div>
    </div>
  );
};

export default Webhooks;
