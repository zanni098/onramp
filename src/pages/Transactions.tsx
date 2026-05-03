import { useEffect, useState } from 'react';
import { Loader, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

interface Transaction {
  id: string;
  amount_usd: number;
  // With the new state machine, rows only land in `transactions` after
  // on-chain confirmation. "pending" is a checkout-session state, not a
  // transactions state. The filter reflects that.
  status: 'confirmed' | 'failed';
  network: string;
  tx_hash: string | null;
  payer_address: string | null;
  created_at: string;
}

const STATUS_FILTERS = ['all', 'confirmed', 'failed'];

const Transactions = () => {
  const { user } = useAuth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('merchant_id', user.id)
        .order('created_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data } = await query;
      setTxns(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [user, filter]);

  const explorerLink = (txn: Transaction) => {
    if (!txn.tx_hash) return null;
    if (txn.network === 'solana') return `https://solscan.io/tx/${txn.tx_hash}`;
    if (txn.network === 'polygon') return `https://polygonscan.com/tx/${txn.tx_hash}`;
    return null;
  };

  return (
    <div>
      <h1 className="text-4xl mb-8">Transactions</h1>

      <div className="flex gap-2 mb-6">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm capitalize transition ${filter === f ? 'bg-accent text-white' : 'glow-button-secondary'
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader className="animate-spin text-accent" size={28} /></div>
      ) : txns.length === 0 ? (
        <div className="glow-card p-10 text-center text-zinc-500">No transactions found.</div>
      ) : (
        <div className="glow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800 text-left">
                <th className="px-6 py-4 font-normal">ID</th>
                <th className="px-6 py-4 font-normal">Amount</th>
                <th className="px-6 py-4 font-normal">Network</th>
                <th className="px-6 py-4 font-normal">Payer</th>
                <th className="px-6 py-4 font-normal">Status</th>
                <th className="px-6 py-4 font-normal">Date</th>
                <th className="px-6 py-4 font-normal">Explorer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {txns.map(txn => (
                <tr key={txn.id} className="text-zinc-300 hover:bg-white/[0.02]">
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500">{txn.id.slice(0, 8)}…</td>
                  <td className="px-6 py-4">${txn.amount_usd?.toFixed(2)}</td>
                  <td className="px-6 py-4 capitalize">{txn.network}</td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                    {txn.payer_address ? `${txn.payer_address.slice(0, 6)}…${txn.payer_address.slice(-4)}` : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${txn.status === 'confirmed'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                      }`}>{txn.status}</span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500">{new Date(txn.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    {explorerLink(txn) ? (
                      <a href={explorerLink(txn)!} target="_blank" rel="noreferrer" className="text-accent hover:text-white transition">
                        <ExternalLink size={14} />
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Transactions;
