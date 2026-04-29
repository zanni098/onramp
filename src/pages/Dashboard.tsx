import React from 'react';

const Dashboard = () => {
  return (
    <div>
      <h1 className="text-4xl mb-8">Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glow-card p-6">
          <p className="text-zinc-400 mb-2">Total Revenue (USD)</p>
          <h2 className="text-3xl">$0.00</h2>
        </div>
        <div className="glow-card p-6">
          <p className="text-zinc-400 mb-2">Transactions</p>
          <h2 className="text-3xl">0</h2>
        </div>
        <div className="glow-card p-6">
          <p className="text-zinc-400 mb-2">Success Rate</p>
          <h2 className="text-3xl">0%</h2>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
