import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, Package, Activity, TrendingUp, Loader,
  ArrowRight, CheckCircle2, Circle, Wallet, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import RevenueChart from '../components/RevenueChart';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';

interface Stats {
  totalRevenue: number;
  totalTransactions: number;
  totalProducts: number;
  activeCheckouts: number;
}

interface LedgerTxn {
  id: string;
  amount_usd: number | null;
  status: 'confirmed' | 'failed';
  network: string;
  created_at: string;
}

const SETUP_DISMISS_KEY = 'onramp.setup.dismissed';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [txns, setTxns] = useState<LedgerTxn[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [setupDismissed, setSetupDismissed] = useState(
    () => localStorage.getItem(SETUP_DISMISS_KEY) === '1',
  );

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const [txnRes, productRes, activeRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, amount_usd, status, network, created_at')
          .eq('merchant_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('products').select('id').eq('merchant_id', user.id),
        supabase
          .from('checkout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', user.id)
          .in('status', ['awaiting_payment', 'confirming']),
      ]);

      const firstError = txnRes.error ?? productRes.error ?? activeRes.error;
      if (firstError) {
        console.error('dashboard query failed:', firstError);
        toast.error('Could not load dashboard data. Try refreshing.');
        setLoading(false);
        return;
      }

      const rows = (txnRes.data ?? []) as LedgerTxn[];
      const confirmed = rows.filter((t) => t.status === 'confirmed');
      setStats({
        totalRevenue: confirmed.reduce((s, t) => s + (t.amount_usd ?? 0), 0),
        totalTransactions: rows.length,
        totalProducts: productRes.data?.length ?? 0,
        activeCheckouts: activeRes.count ?? 0,
      });
      setTxns(rows);
      setProductCount(productRes.data?.length ?? 0);
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  // First-run setup popup: derived, shown once when no payout wallet is set.
  const setupOpen =
    !loading && !!profile && !setupDismissed &&
    !profile.solana_wallet && !profile.polygon_wallet;

  const dismissSetup = () => {
    localStorage.setItem(SETUP_DISMISS_KEY, '1');
    setSetupDismissed(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin text-white" size={26} />
      </div>
    );
  }

  const confirmed = txns.filter((t) => t.status === 'confirmed');
  const hasWallet = !!(profile?.solana_wallet || profile?.polygon_wallet);
  const steps = [
    { done: hasWallet, label: 'Add a payout wallet', to: '/settings' },
    { done: productCount > 0, label: 'Create your first product', to: '/products' },
    { done: confirmed.length > 0, label: 'Receive your first payment', to: '/products' },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const cards = [
    { label: 'Total revenue', value: `$${(stats?.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: <DollarSign size={16} />, tint: 'text-up' },
    { label: 'Transactions', value: stats?.totalTransactions ?? 0, icon: <Activity size={16} />, tint: 'text-white' },
    { label: 'Products', value: stats?.totalProducts ?? 0, icon: <Package size={16} />, tint: 'text-white' },
    { label: 'Active checkouts', value: stats?.activeCheckouts ?? 0, icon: <TrendingUp size={16} />, tint: 'text-warn' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">Overview</h1>
          <p className="text-sub text-sm mt-0.5">
            Welcome back, {profile?.business_name ?? 'Merchant'}
          </p>
        </div>
        <Link to="/products" className="glow-button inline-flex items-center gap-2">
          New product <ArrowRight size={14} />
        </Link>
      </div>

      {/* ── Stat strip ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="glow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-sub">{c.label}</span>
              <span className="text-muted">{c.icon}</span>
            </div>
            <div className={`text-[22px] font-semibold tabular-nums tracking-tight ${c.tint}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Revenue chart ── */}
      <div className="glow-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px]">Revenue · last 30 days</h3>
          <span className="text-xs text-muted tabular-nums">
            {confirmed.length} settled payment{confirmed.length === 1 ? '' : 's'}
          </span>
        </div>
        {confirmed.length > 0 ? (
          <RevenueChart transactions={confirmed} />
        ) : (
          <EmptyState
            variant="chart"
            title="No revenue yet"
            body="Once your first payment settles, your revenue curve draws itself here."
            action={
              <Link to="/products" className="glow-button-secondary inline-flex items-center gap-2">
                Create a checkout link <ArrowRight size={13} />
              </Link>
            }
          />
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        {/* ── Recent transactions ── */}
        <div className="glow-card lg:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-[15px]">Recent transactions</h3>
            <Link to="/transactions" className="text-xs text-sub hover:text-white transition inline-flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {txns.length === 0 ? (
            <EmptyState
              variant="transactions"
              title="No transactions yet"
              body="Share a checkout link to put your first settlement on the board."
            />
          ) : (
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-line/60">
                {txns.slice(0, 6).map((t) => (
                  <tr key={t.id} className="okx-row">
                    <td className="px-5 py-3 font-mono text-xs text-muted">{t.id.slice(0, 8)}…</td>
                    <td className="px-5 py-3 capitalize text-sub">{t.network}</td>
                    <td className="px-5 py-3">
                      <span className={`okx-chip ${t.status === 'confirmed' ? 'okx-chip-up' : 'okx-chip-down'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium text-white">
                      {t.status === 'confirmed' ? '+' : ''}${t.amount_usd?.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right text-muted text-xs">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Setup checklist ── */}
        <div className="glow-card p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[15px]">Get set up</h3>
            <span className="text-xs text-muted tabular-nums">{doneCount}/{steps.length}</span>
          </div>
          <div className="h-1 rounded-full bg-elev mb-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-up transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          <div className="space-y-1">
            {steps.map((s) => (
              <Link
                key={s.label}
                to={s.to}
                className="flex items-center gap-3 px-2 py-2.5 -mx-2 rounded-lg hover:bg-white/5 transition group"
              >
                {s.done ? (
                  <CheckCircle2 size={17} className="text-up shrink-0" />
                ) : (
                  <Circle size={17} className="text-muted shrink-0" />
                )}
                <span className={`text-[13px] ${s.done ? 'text-muted line-through' : 'text-zinc-300 group-hover:text-white'}`}>
                  {s.label}
                </span>
                {!s.done && <ArrowRight size={13} className="ml-auto text-muted group-hover:text-white transition" />}
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-4 leading-relaxed">
            Payments settle straight to your wallet. Onramp charges 0.5% per
            transaction — waived during beta.
          </p>
        </div>
      </div>

      {/* ── First-run setup popup ── */}
      <Modal
        open={setupOpen}
        onClose={dismissSetup}
        title="Finish setting up"
        subtitle="One step left before you can get paid"
        width={420}
      >
        <div className="flex items-start gap-4 p-4 rounded-xl bg-elev border border-line mb-4">
          <span className="w-9 h-9 rounded-lg bg-up/10 text-up flex items-center justify-center shrink-0">
            <Wallet size={17} />
          </span>
          <div>
            <p className="text-white text-sm font-medium">Add a payout wallet</p>
            <p className="text-sub text-[13px] mt-1 leading-relaxed">
              Onramp is non-custodial — funds settle directly into your Solana
              or Polygon wallet. Without one, checkout links can't be created.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/settings" onClick={dismissSetup} className="glow-button flex-1 text-center">
            Add wallet
          </Link>
          <button onClick={dismissSetup} className="glow-button-secondary inline-flex items-center gap-1.5">
            <X size={13} /> Later
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
