import React, { useEffect, useState } from 'react';
import { Copy, Save, Eye, EyeOff, Loader, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import {
  updateMerchantConfig,
  getMerchantSecrets,
  type MerchantSecrets,
} from '../lib/api';

const Settings = () => {
  const { profile, refreshProfile } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [solanaWallet, setSolanaWallet] = useState('');
  const [polygonWallet, setPolygonWallet] = useState('');
  const [saving, setSaving] = useState(false);

  const [secrets, setSecrets] = useState<MerchantSecrets | null>(null);
  const [secretsLoading, setSecretsLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (profile) {
      setBusinessName(profile.business_name ?? '');
      setSolanaWallet(profile.solana_wallet ?? '');
      setPolygonWallet(profile.polygon_wallet ?? '');
    }
  }, [profile]);

  const loadSecrets = async () => {
    setSecretsLoading(true);
    try {
      const s = await getMerchantSecrets();
      setSecrets(s);
      setShowSecret(true);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not load secrets');
    } finally {
      setSecretsLoading(false);
    }
  };

  const copy = (val: string | null, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast.success(`${label} copied`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMerchantConfig({
        business_name: businessName || null,
        solana_wallet: solanaWallet || null,
        polygon_wallet: polygonWallet || null,
      });
      await refreshProfile();
      toast.success('Settings saved');
    } catch (e: any) {
      // Error codes from update-merchant-config map to friendly messages.
      const msg = String(e?.message ?? '');
      if (msg.startsWith('invalid_solana_wallet')) toast.error('Invalid Solana wallet address');
      else if (msg.startsWith('invalid_polygon_wallet_checksum')) toast.error('Polygon address checksum failed');
      else if (msg.startsWith('invalid_polygon_wallet')) toast.error('Invalid Polygon wallet address');
      else if (msg.startsWith('invalid_business_name')) toast.error('Invalid business name');
      else toast.error(msg || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-4xl mb-8">Settings</h1>

      <div className="space-y-6 max-w-xl">
        <div className="glow-card p-8">
          <h3 className="text-xl mb-2">API Keys</h3>
          <p className="text-zinc-500 text-sm mb-6">
            Server-side credentials for programmatic access. Never expose your
            secret key in client-side code.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Public Key</label>
              <div className="flex gap-2">
                <input
                  className="glass-input flex-1 font-mono text-sm"
                  type="text"
                  readOnly
                  value={profile?.public_key ?? '—'}
                />
                <button
                  onClick={() => copy(profile?.public_key ?? null, 'Public key')}
                  className="glow-button-secondary px-3"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Secret Key</label>
              {secrets ? (
                <div className="flex gap-2">
                  <input
                    className="glass-input flex-1 font-mono text-sm"
                    type={showSecret ? 'text' : 'password'}
                    readOnly
                    value={secrets.secret_key}
                  />
                  <button
                    onClick={() => setShowSecret((v) => !v)}
                    className="glow-button-secondary px-3"
                  >
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={() => copy(secrets.secret_key, 'Secret key')}
                    className="glow-button-secondary px-3"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={loadSecrets}
                  disabled={secretsLoading}
                  className="glow-button-secondary text-sm px-4 py-2 flex items-center gap-2"
                >
                  {secretsLoading ? <Loader size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                  Reveal secret key
                </button>
              )}
              <p className="text-xs text-zinc-600 mt-2">
                Secrets are loaded over an authenticated server endpoint and
                are never cached in the page.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="glow-card p-8">
          <h3 className="text-xl mb-6">Business Profile</h3>
          <p className="text-xs text-zinc-500 mb-4">
            Wallet addresses are validated server-side. A typo here means lost
            payments — double-check before saving.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Business Name</label>
              <input
                className="glass-input w-full"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business name"
                maxLength={80}
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Solana Wallet Address (USDC)
              </label>
              <input
                className="glass-input w-full font-mono text-sm"
                type="text"
                value={solanaWallet}
                onChange={(e) => setSolanaWallet(e.target.value.trim())}
                placeholder="e.g. 7xKXtg2C…"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Polygon Wallet Address (USDT)
              </label>
              <input
                className="glass-input w-full font-mono text-sm"
                type="text"
                value={polygonWallet}
                onChange={(e) => setPolygonWallet(e.target.value.trim())}
                placeholder="0x…"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="glow-button flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
