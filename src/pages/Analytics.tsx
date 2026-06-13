import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader, ArrowRight, DollarSign, Receipt, Percent, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import RevenueChart from '../components/RevenueChart';
import EmptyState from '../components/EmptyState';

// Merchant analytics: the reporting layer Stripe/Coinbase Commerce ship and
// a bare ledger doesn't. Everything is computed client-side from the
// merchant's own RLS-scoped rows — no new backend surface.

interface Txn {
  id: string;
  amount_usd: number | null;
  status: 'confirmed' | 'failed';
  network: string;
  payer_address: string | null;
  product_id: string | null;
  created_at: string;
}

interface SessionRow {
  status: 'awaiting_payment' | 'confirming' | 'confirmed' | 'failed' | 'expired';
}

interface ProductRow {
  id: string;
  name: string;
}

const RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
] as const;

const NETWORK_COLORS: Record<string, string> = {
  solana: '#00C76F',
  polygon: '#8247E5',
};

const Analytics = () => {
  const { user } = useAuth();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(30);
  const [cumulative, setCumulative] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [txnRes, sessRes, prodRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, amount_usd, status, network, payer_address, product_id, created_at')
          .eq('merchant_id', user.id)
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase
          .from('checkout_sessions')
          .select('status')
          .eq('merchant_id', user.id)
          .limit(5000),
        supabase.from('products').select('id, name').eq('merchant_id', user.id),
      ]);
      const firstError = txnRes.error ?? sessRes.error ?? prodRes.error;
      if (firstError) {
        console.error('analytics query failed:', firstError);
        toast.error('Could not load analytics. Try refreshing.');
        setLoading(false);
        return;
      }
      setTxns((txnRes.data ?? []) as Txn[]);
      setSessions((sessRes.data ?? []) as SessionRow[]);
      setProducts((prodRes.data ?? []) as ProductRow[]);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  const inRange = useMemo(() => txns.filter((t) => t.created_at >= cutoff), [txns, cutoff]);
  const confirmed = useMemo(() => inRange.filter((t) => t.status === 'confirmed'), [inRange]);

  const kpis = useMemo(() => {
    const revenue = confirmed.reduce((s, t) => s + (t.amount_usd ?? 0), 0);
    const aov = confirmed.length ? revenue / confirmed.length : 0;
    const successRate = inRange.length ? (confirmed.length / inRange.length) * 100 : null;
    const payers = new Set(confirmed.map((t) => t.payer_address).filter(Boolean)).size;
    return { revenue, aov, successRate, payers };
  }, [inRange, confirmed]);

  const networkSplit = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of confirmed) m.set(t.network, (m.get(t.network) ?? 0) + (t.amount_usd ?? 0));
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([network, value]) => ({
        network,
        value,
        pct: total ? (value / total) * 100 : 0,
        color: NETWORK_COLORS[network] ?? '#909499',
      }));
  }, [confirmed]);

  const funnel = useMemo(() => {
    const count = (statuses: SessionRow['status'][]) =>
      sessions.filter((s) => statuses.includes(s.status)).length;
    const total = sessions.length;
    return [
      { label: 'Checkouts opened', value: total, color: '#FFFFFF' },
      { label: 'Payment confirmed', value: count(['confirmed']), color: '#00C76F' },
      { label: 'Failed', value: count(['failed']), color: '#F0454B' },
      { label: 'Expired / abandoned', value: count(['expired']), color: '#5E6673' },
    ];
  }, [sessions]);

  const topProducts = useMemo(() => {
    const nameById = new Map(products.map((p) => [p.id, p.name]));
    const agg = new Map<string, { revenue: number; count: number }>();
    for (const t of confirmed) {
      const key = t.product_id ?? 'unknown';
      const cur = agg.get(key) ?? { revenue: 0, count: 0 };
      cur.revenue += t.amount_usd ?? 0;
      cur.count += 1;
      agg.set(key, cur);
    }
    return [...agg.entries()]
      .map(([id, v]) => ({ id, name: nameById.get(id) ?? 'Deleted product', ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [confirmed, products]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin text-white" size={26} />
      </div>
    );
  }

  const kpiCards = [
    { label: `Revenue · ${days}d`, value: `$${kpis.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: <DollarSign size={16} />, tint: 'text-up' },
    { label: 'Avg order value', value: `$${kpis.aov.toFixed(2)}`, icon: <Receipt size={16} />, tint: 'text-white' },
    { label: 'Success rate', value: kpis.successRate === null ? '—' : `${kpis.successRate.toFixed(0)}%`, icon: <Percent size={16} />, tint: 'text-white' },
    { label: 'Unique payers', value: kpis.payers, icon: <Users size={16} />, tint: 'text-white' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">Analytics</h1>
          <p className="text-sub text-sm mt-0.5">Where the money comes from, and where checkouts leak.</p>
        </div>
        <div className="flex items-center gap-1 bg-elev border border-line rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                days === r.days ? 'bg-white text-black' : 'text-sub hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {kpiCards.map((c) => (
          <div key={c.label} className="glow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-sub">{c.label}</span>
              <span className="text-muted">{c.icon}</span>
            </div>
            <div className={`text-[22px] font-semibold tabular-nums tracking-tight ${c.tint}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ── Revenue over time ── */}
      <div className="glow-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px]">Revenue over time</h3>
          <div className="flex items-center gap-1 bg-elev border border-line rounded-lg p-1">
            {(['Daily', 'Cumulative'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCumulative(mode === 'Cumulative')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  (mode === 'Cumulative') === cumulative ? 'bg-white text-black' : 'text-sub hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        {confirmed.length > 0 ? (
          <RevenueChart transactions={confirmed} days={days} cumulative={cumulative} />
        ) : (
          <EmptyState
            variant="chart"
            title="Nothing settled in this window"
            body="Confirmed payments in the selected range will draw the curve here."
            action={
              <Link to="/products" className="glow-button-secondary inline-flex items-center gap-2">
                Share a checkout link <ArrowRight size={13} />
              </Link>
            }
          />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-3 mb-6">
        {/* ── Network split ── */}
        <div className="glow-card p-5">
          <h3 className="text-[15px] mb-4">Revenue by network · {days}d</h3>
          {networkSplit.length === 0 ? (
            <p className="text-sub text-[13px] py-8 text-center">No settled payments in this window.</p>
          ) : (
            <div className="flex items-center gap-6">
              <Donut data={networkSplit} />
              <div className="flex-1 space-y-3">
                {networkSplit.map((n) => (
                  <div key={n.network}>
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span className="flex items-center gap-2 capitalize text-zinc-300">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: n.color }} />
                        {n.network}
                      </span>
                      <span className="tabular-nums text-white font-medium">
                        ${n.value.toFixed(2)} <span className="text-muted">({n.pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-elev overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${n.pct}%`, background: n.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Conversion funnel ── */}
        <div className="glow-card p-5">
          <h3 className="text-[15px] mb-1">Checkout funnel · all time</h3>
          <p className="text-[11px] text-muted mb-4">Every server-created checkout session, by terminal state.</p>
          {sessions.length === 0 ? (
            <p className="text-sub text-[13px] py-8 text-center">No checkout sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {funnel.map((f) => {
                const maxV = funnel[0].value || 1;
                return (
                  <div key={f.label}>
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span className="text-zinc-300">{f.label}</span>
                      <span className="tabular-nums text-white font-medium">{f.value}</span>
                    </div>
                    <div className="h-2 rounded bg-elev overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{ width: `${(f.value / maxV) * 100}%`, background: f.color, opacity: f.label === 'Checkouts opened' ? 0.35 : 0.9 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Top products ── */}
      <div className="glow-card">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-[15px]">Top products · {days}d</h3>
          <Link to="/products" className="text-xs text-sub hover:text-white transition inline-flex items-center gap-1">
            Manage <ArrowRight size={12} />
          </Link>
        </div>
        {topProducts.length === 0 ? (
          <EmptyState
            variant="products"
            title="No product revenue yet"
            body="Once payments settle, your best sellers rank themselves here."
          />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-muted text-xs border-b border-line text-left">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium text-right">Payments</th>
                <th className="px-5 py-3 font-medium text-right">Revenue</th>
                <th className="px-5 py-3 font-medium text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {topProducts.map((p, i) => {
                const share = kpis.revenue ? (p.revenue / kpis.revenue) * 100 : 0;
                return (
                  <tr key={p.id} className="okx-row">
                    <td className="px-5 py-3 text-muted tabular-nums">{i + 1}</td>
                    <td className="px-5 py-3 text-white">{p.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-sub">{p.count}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium text-up">+${p.revenue.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-sub">{share.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// Minimal SVG donut — no chart dependency.
const Donut = ({ data }: { data: { value: number; color: string }[] }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 42;
  const C = 2 * Math.PI * R;
  // Precompute each segment's start angle immutably (n ≤ networks, tiny).
  const segments = data.map((d, i) => ({
    color: d.color,
    frac: d.value / total,
    start: data.slice(0, i).reduce((s, x) => s + x.value, 0) / total,
  }));
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r={R} fill="none" stroke="#1A1A1A" strokeWidth="14" />
      {segments.map((seg) => (
        <circle
          key={seg.color}
          cx="60" cy="60" r={R} fill="none"
          stroke={seg.color} strokeWidth="14"
          strokeDasharray={`${seg.frac * C} ${C}`}
          strokeDashoffset={-seg.start * C}
          transform="rotate(-90 60 60)"
        />
      ))}
      <text x="60" y="64" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff" fontFamily="Inter, sans-serif">
        {data.length} net{data.length === 1 ? '' : 's'}
      </text>
    </svg>
  );
};

export default Analytics;
