import React from 'react';

const Webhooks = () => {
  return (
    <div>
      <h1 className="text-4xl mb-8">Webhooks</h1>
      <div className="glow-card p-8">
        <h3 className="text-2xl mb-4">Configuration</h3>
        <div className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Endpoint URL</label>
            <input className="glass-input w-full" type="url" placeholder="https://api.yourdomain.com/webhook" />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Webhook Secret (HMAC)</label>
            <input className="glass-input w-full" type="text" readOnly value="whsec_placeholder123" />
          </div>
          <button className="glow-button mt-4">Save Configuration</button>
        </div>
      </div>
    </div>
  );
};
export default Webhooks;
