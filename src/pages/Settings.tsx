import React from 'react';

const Settings = () => {
  return (
    <div>
      <h1 className="text-4xl mb-8">Settings</h1>
      <div className="glow-card p-8">
        <h3 className="text-2xl mb-4">API Keys</h3>
        <div className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Public Key</label>
            <input className="glass-input w-full" type="text" readOnly value="pk_live_placeholder" />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Secret Key</label>
            <input className="glass-input w-full" type="password" readOnly value="sk_live_placeholder" />
          </div>
        </div>
      </div>
    </div>
  );
};
export default Settings;
