import React, { useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, Package, Activity, Settings as SettingsIcon, Link2, LogOut, Loader } from 'lucide-react';
import { useAuth } from '../lib/auth';

const DashboardLayout = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-background text-zinc-400">
      <aside className="w-64 border-r border-zinc-800 p-6 flex flex-col h-screen sticky top-0">
        <div className="text-xl font-serif text-white flex items-center gap-2 mb-10">
          <div className="w-6 h-6 rounded-full bg-accent animate-pulse" />
          onramp
        </div>

        {profile?.business_name && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-white/5 border border-zinc-800">
            <p className="text-xs text-zinc-500 mb-0.5">Logged in as</p>
            <p className="text-white text-sm font-medium truncate">{profile.business_name}</p>
          </div>
        )}

        <nav className="flex-1 space-y-1">
          <SidebarLink to="/dashboard" icon={<Home size={18} />} label="Overview" />
          <SidebarLink to="/products" icon={<Package size={18} />} label="Products" />
          <SidebarLink to="/transactions" icon={<Activity size={18} />} label="Transactions" />
          <SidebarLink to="/webhooks" icon={<Link2 size={18} />} label="Webhooks" />
        </nav>

        <div className="space-y-1 border-t border-zinc-800 pt-4 mt-4">
          <SidebarLink to="/settings" icon={<SettingsIcon size={18} />} label="Settings" />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition w-full text-left"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

const SidebarLink = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition text-sm ${
        active
          ? 'bg-accent/10 text-white border border-accent/20'
          : 'hover:bg-white/5 text-zinc-400 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
};

export default DashboardLayout;
