import React, { useEffect, useState } from 'react';
import { DollarSign, Package, Activity, TrendingUp, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

interface Stats {
  totalRevenue: number;
  totalTransactions: number;
  totalProducts: number;
  pendingTransactions: number;
}

const Dashboard = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const [txnRes, productRes] = await Promise.all([
        supabase.from('transactions').select('amount_usd, status').eq('merchant_id', user.id),
        supabase.from('products').select('id').eq('merchant_id', user.id),
      ]);

      const txns = txnRes.data ?? [];
      const products = productRes.data ?? [];
      const confirmed = txns.filter(t => t.status === 'confirmed');

      setStats({
        totalRevenue: confirmed.reduce((sum, t) => sum + (t.amount_usd ?? 0), 0),
        totalTransactions: txns.length,
        totalProducts: products.length,
        pendingTransactions: txns.filter(t => t.status === 'pending').length,
      });

      const { data: recent } = await supabase
        .from('transactions')
        .select('id, amount_usd, status, network, created_at, product_id')
        .eq('merchant_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentTxns(recent ?? []);
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader className="animate-spin text-accent" size={28} />
    </div>
  );

  const statCards = [
    { label: 'Total Revenue', value: `$${stats?.totalRevenue.toFixed(2) ?? '0.00'}`, icon: <DollarSign size={20} />, color: 'text-accent' },
    { label: 'Transactions', value: stats?.totalTransactions ?? 0, icon: <Activity size={20} />, color: 'text-emerald-400' },
    { label: 'Products', value: stats?.totalProducts ?? 0, icon: <Package size={20} />, color: 'text-purple-400' },
    { label: 'Pending', value: stats?.pendingTransactions ?? 0, icon: <TrendingUp size={20} />, color: 'text-yellow-400' },
  ];

  return (
    <div>
      <h1 className="text-4xl mb-2">Overview</h1>
      <p className="text-zinc-500 mb-8">Welcome back, {profile?.business_name ?? 'Merchant'}</p>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        {statCards.map(card => (
          <div key={card.label} className="glow-card p-6">
            <div className={`mb-3 ${card.color}`}>{card.icon}</div>
            <div className="text-2xl font-serif text-white mb-1">{card.value}</div>
            <div className="text-xs text-zinc-500">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="glow-card p-6">
        <h3 className="text-xl mb-6">Recent Transactions</h3>
        {recentTxns.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No transactions yet. Share your checkout link to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800 text-left">
                <th className="pb-3 font-normal">ID</th>
                <th className="pb-3 font-normal">Amount</th>
                <th className="pb-3 font-normal">Network</th>
                <th className="pb-3 font-normal">Status</th>
                <th className="pb-3 font-normal">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {recentTxns.map(txn => (
                <tr key={txn.id} className="text-zinc-300">
                  <td className="py-3 font-mono text-xs text-zinc-500">{txn.id.slice(0, 8)}…</td>
                  <td className="py-3">${txn.amount_usd?.toFixed(2)}</td>
                  <td className="py-3 capitalize">{txn.network}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      txn.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' :
                      txn.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>{txn.status}</span>
                  </td>
                  <td className="py-3 text-zinc-500">{new Date(txn.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
