import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Package, Activity, Settings as SettingsIcon, Link2,
  LogOut, Menu, X, BookOpen, BarChart3,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Logo, LogoMark } from '../components/Logo';

// OKX-style product shell: hairline top bar + slim left rail on desktop,
// top bar + slide-down drawer on mobile. Auth is enforced by ProtectedRoute.

const NAV = [
  { to: '/dashboard', icon: Home, label: 'Overview' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/transactions', icon: Activity, label: 'Transactions' },
  { to: '/webhooks', icon: Link2, label: 'Webhooks' },
];

const DashboardLayout = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initial = (profile?.business_name ?? 'M').slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-zinc-300 font-sans">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 h-14 border-b border-line bg-black/85 backdrop-blur-md flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden p-2 -ml-2 text-sub hover:text-white"
            onClick={() => setDrawer((v) => !v)}
            aria-label="Menu"
          >
            {drawer ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link to="/dashboard" aria-label="Overview">
            <Logo size={22} />
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-md bg-up/10 text-up text-[11px] font-semibold tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />
            Live
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/zanni098/onramp#-route-map"
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-sub hover:text-white hover:bg-white/5 transition"
          >
            <BookOpen size={14} /> Docs
          </a>
          <Link
            to="/settings"
            className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg hover:bg-white/5 transition"
            title="Settings"
          >
            <span className="w-7 h-7 rounded-lg bg-elev border border-line flex items-center justify-center text-white text-xs font-bold">
              {initial}
            </span>
            <span className="hidden sm:block text-[13px] text-white font-medium max-w-[140px] truncate">
              {profile?.business_name ?? 'Merchant'}
            </span>
          </Link>
        </div>
      </header>

      <div className="flex">
        {/* ── Desktop rail ── */}
        <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-line h-[calc(100vh-3.5rem)] sticky top-14 px-3 py-4">
          <nav className="flex-1 space-y-0.5">
            {NAV.map((n) => (
              <RailLink key={n.to} {...n} />
            ))}
          </nav>
          <div className="space-y-0.5 border-t border-line pt-3">
            <RailLink to="/settings" icon={SettingsIcon} label="Settings" />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sub hover:text-down hover:bg-down/5 transition"
            >
              <LogOut size={17} />
              Sign out
            </button>
          </div>
          <div className="mt-4 px-3 flex items-center gap-2 text-muted">
            <LogoMark size={14} />
            <span className="text-[11px]">0.5% per transaction</span>
          </div>
        </aside>

        {/* ── Mobile drawer ── */}
        {drawer && (
          <div className="lg:hidden fixed inset-x-0 top-14 z-30 border-b border-line bg-black/95 backdrop-blur-xl okx-pop">
            <nav className="p-3 space-y-0.5">
              {[...NAV, { to: '/settings', icon: SettingsIcon, label: 'Settings' }].map((n) => (
                <RailLink key={n.to} {...n} onClick={() => setDrawer(false)} />
              ))}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sub hover:text-down transition"
              >
                <LogOut size={17} />
                Sign out
              </button>
            </nav>
          </div>
        )}

        <main className="flex-1 min-w-0 px-4 py-6 lg:px-8 lg:py-8 max-w-[1200px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const RailLink = ({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick?: () => void;
}) => {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
        active
          ? 'bg-elev text-white font-medium'
          : 'text-sub hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon size={17} />
      {label}
    </Link>
  );
};

export default DashboardLayout;
