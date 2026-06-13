import { useEffect, useMemo, useState } from 'react';
import { Loader, ExternalLink, Search, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';

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
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [exporting, setExporting] = useState(false);

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

  // Client-side search over the loaded window (id, tx hash, payer address).
  const visibleTxns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return txns;
    return txns.filter(t =>
      t.id.toLowerCase().includes(q) ||
      (t.tx_hash ?? '').toLowerCase().includes(q) ||
      (t.payer_address ?? '').toLowerCase().includes(q),
    );
  }, [txns, search]);

  // CSV export — Stripe-style: fetch up to 1000 rows for the active filter
  // and download client-side. No backend round trip beyond the select.
  const exportCsv = async () => {
    if (!user) return;
    setExporting(true);
    try {
      let query = supabase
        .from('transactions')
        .select('id, created_at, amount_usd, network, status, tx_hash, payer_address')
        .eq('merchant_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [
        ['id', 'created_at', 'amount_usd', 'network', 'status', 'tx_hash', 'payer_address'].join(','),
        ...rows.map(r => [r.id, r.created_at, r.amount_usd, r.network, r.status, r.tx_hash, r.payer_address].map(esc).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `onramp-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} transaction${rows.length === 1 ? '' : 's'}`);
    } catch (e) {
      console.error('csv export failed:', e);
      toast.error('Export failed. Try again.');
    } finally {
      setExporting(false);
    }
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

      <div className="flex items-center justify-between gap-4 border-b border-line mb-5 flex-wrap">
        <div className="flex gap-5">
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
        <div className="flex items-center gap-2 pb-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search id, hash, payer…"
              className="glass-input !py-1.5 !pl-9 w-56 text-[13px]"
            />
          </div>
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="glow-button-secondary inline-flex items-center gap-1.5 !py-1.5"
          >
            {exporting ? <Loader size={13} className="animate-spin" /> : <Download size={13} />}
            CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader className="animate-spin text-white" size={26} /></div>
      ) : visibleTxns.length === 0 ? (
        <div className="glow-card">
          <EmptyState
            variant="transactions"
            title={search ? 'No matches' : 'No transactions found'}
            body={search
              ? 'Nothing in the loaded window matches that search.'
              : filter === 'all'
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
              {visibleTxns.map(txn => (
                <tr
                  key={txn.id}
                  className="text-zinc-300 okx-row cursor-pointer"
                  onClick={() => setDetail(txn)}
                >
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
                  <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
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
          {hasMore && !search && (
            <div className="border-t border-line p-4 text-center">
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

      {/* ── Transaction detail popup ── */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Transaction details"
        width={460}
      >
        {detail && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-elev border border-line">
              <span className={`okx-chip ${detail.status === 'confirmed' ? 'okx-chip-up' : 'okx-chip-down'}`}>
                {detail.status}
              </span>
              <span className={`text-xl font-semibold tabular-nums ${detail.status === 'confirmed' ? 'text-up' : 'text-white'}`}>
                {detail.status === 'confirmed' ? '+' : ''}${detail.amount_usd?.toFixed(2)}
              </span>
            </div>
            <DetailField label="Transaction ID" value={detail.id} mono />
            <DetailField label="Network" value={detail.network} />
            <DetailField label="Date" value={new Date(detail.created_at).toLocaleString()} />
            <DetailField label="Payer address" value={detail.payer_address ?? '—'} mono />
            <DetailField label="Tx hash" value={detail.tx_hash ?? '—'} mono />
            {explorerLink(detail) && (
              <a
                href={explorerLink(detail)!}
                target="_blank"
                rel="noreferrer"
                className="glow-button w-full flex items-center justify-center gap-2 mt-2"
              >
                View on explorer <ExternalLink size={13} />
              </a>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const DetailField = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="text-[11px] text-muted mb-0.5">{label}</p>
    <p className={`text-[13px] text-zinc-200 break-all ${mono ? 'font-mono' : 'capitalize'}`}>{value}</p>
  </div>
);

export default Transactions;
