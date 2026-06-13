import { useEffect, useState } from 'react';
import { Loader, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import EmptyState from '../components/EmptyState';

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
const PAGE_SIZE = 25;

const Transactions = () => {
  const { user } = useAuth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const visible = (page + 1) * PAGE_SIZE;
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('merchant_id', user.id)
        .order('created_at', { ascending: false })
        // Fetch one extra row past the visible window so we know whether a
        // "Load more" is warranted without a second count query.
        .range(0, visible);
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query;
      if (error) {
        console.error('transactions query failed:', error);
        toast.error('Could not load transactions. Try refreshing.');
        setLoading(false);
        return;
      }
      const rows = data ?? [];
      setHasMore(rows.length > visible);
      setTxns(rows.slice(0, visible));
      setLoading(false);
    };
    fetch();
  }, [user, filter, page]);

  const changeFilter = (f: string) => {
    setFilter(f);
    setPage(0);
  };

  const explorerLink = (txn: Transaction) => {
    if (!txn.tx_hash) return null;
    if (txn.network === 'solana') return `https://solscan.io/tx/${txn.tx_hash}`;
    if (txn.network === 'polygon') return `https://polygonscan.com/tx/${txn.tx_hash}`;
    return null;
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl">Transactions</h1>
        <p className="text-sub text-sm mt-0.5">Every on-chain settlement, verified server-side.</p>
      </div>

      <div className="flex gap-5 border-b border-line mb-5">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => changeFilter(f)}
            className={`okx-tab capitalize ${filter === f ? 'okx-tab-active' : ''}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader className="animate-spin text-white" size={26} /></div>
      ) : txns.length === 0 ? (
        <div className="glow-card">
          <EmptyState
            variant="transactions"
            title="No transactions found"
            body={filter === 'all'
              ? 'Settlements land here the moment the chain confirms them.'
              : `No ${filter} transactions yet.`}
          />
        </div>
      ) : (
        <div className="glow-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-muted text-xs border-b border-line text-left">
                <th className="px-5 py-3.5 font-medium">ID</th>
                <th className="px-5 py-3.5 font-medium text-right">Amount</th>
                <th className="px-5 py-3.5 font-medium">Network</th>
                <th className="px-5 py-3.5 font-medium">Payer</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium">Date</th>
                <th className="px-5 py-3.5 font-medium">Explorer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {txns.map(txn => (
                <tr key={txn.id} className="text-zinc-300 okx-row">
                  <td className="px-5 py-3.5 font-mono text-xs text-muted">{txn.id.slice(0, 8)}…</td>
                  <td className={`px-5 py-3.5 text-right tabular-nums font-medium ${txn.status === 'confirmed' ? 'text-up' : 'text-white'}`}>
                    {txn.status === 'confirmed' ? '+' : ''}${txn.amount_usd?.toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5 capitalize text-sub">{txn.network}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted">
                    {txn.payer_address ? `${txn.payer_address.slice(0, 6)}…${txn.payer_address.slice(-4)}` : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`okx-chip ${txn.status === 'confirmed' ? 'okx-chip-up' : 'okx-chip-down'}`}>
                      {txn.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted">{new Date(txn.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5">
                    {explorerLink(txn) ? (
                      <a href={explorerLink(txn)!} target="_blank" rel="noreferrer" className="text-sub hover:text-white transition">
                        <ExternalLink size={14} />
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <div className="border-t border-zinc-800 p-4 text-center">
              <button
                onClick={() => setPage(p => p + 1)}
                className="glow-button-secondary text-sm"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Transactions;
