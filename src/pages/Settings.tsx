import React, { useEffect, useState } from 'react';
import { Copy, Save, Eye, EyeOff, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Settings = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [solanaWallet, setSolanaWallet] = useState('');
  const [polygonWallet, setPolygonWallet] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setBusinessName(profile.business_name ?? '');
      setSolanaWallet(profile.solana_wallet ?? '');
      setPolygonWallet(profile.polygon_wallet ?? '');
    }
  }, [profile]);

  const copy = (val: string | null, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast.success(`${label} copied`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      business_name: businessName,
      solana_wallet: solanaWallet || null,
      polygon_wallet: polygonWallet || null,
    }).eq('id', user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success('Settings saved');
  };

  return (
    <div>
      <h1 className="text-4xl mb-8">Settings</h1>

      <div className="space-y-6 max-w-xl">
        {/* API Keys */}
        <div className="glow-card p-8">
          <h3 className="text-xl mb-6">API Keys</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Public Key</label>
              <div className="flex gap-2">
                <input className="glass-input flex-1 font-mono text-sm" type="text" readOnly value={profile?.public_key ?? '—'} />
                <button onClick={() => copy(profile?.public_key ?? null, 'Public key')} className="glow-button-secondary px-3">
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Secret Key</label>
              <div className="flex gap-2">
                <input
                  className="glass-input flex-1 font-mono text-sm"
                  type={showSecret ? 'text' : 'password'}
                  readOnly
                  value={profile?.secret_key ?? '—'}
                />
                <button onClick={() => setShowSecret(v => !v)} className="glow-button-secondary px-3">
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => copy(profile?.secret_key ?? null, 'Secret key')} className="glow-button-secondary px-3">
                  <Copy size={14} />
                </button>
              </div>
              <p className="text-xs text-zinc-600 mt-2">Never expose your secret key publicly.</p>
            </div>
          </div>
        </div>

        {/* Business Profile */}
        <form onSubmit={handleSave} className="glow-card p-8">
          <h3 className="text-xl mb-6">Business Profile</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Business Name</label>
              <input className="glass-input w-full" type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Your business name" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Solana Wallet Address</label>
              <input className="glass-input w-full font-mono text-sm" type="text" value={solanaWallet} onChange={e => setSolanaWallet(e.target.value)} placeholder="Solana wallet to receive USDC" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Polygon Wallet Address</label>
              <input className="glass-input w-full font-mono text-sm" type="text" value={polygonWallet} onChange={e => setPolygonWallet(e.target.value)} placeholder="0x... Polygon wallet to receive USDT" />
            </div>
            <button type="submit" disabled={saving} className="glow-button flex items-center gap-2 disabled:opacity-50">
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
