import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Home, Package, Activity, Settings as SettingsIcon, Link2 } from 'lucide-react';

const DashboardLayout = () => {
  return (
    <div className="min-h-screen flex bg-background text-zinc-400">
      <aside className="w-64 border-r border-zinc-800 p-6 flex flex-col h-screen sticky top-0">
        <div className="text-xl font-serif text-white flex items-center gap-2 mb-10">
          <div className="w-6 h-6 rounded-full bg-accent animate-pulse" />
          onramp
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarLink to="/dashboard" icon={<Home />} label="Overview" />
          <SidebarLink to="/products" icon={<Package />} label="Products" />
          <SidebarLink to="/transactions" icon={<Activity />} label="Transactions" />
          <SidebarLink to="/webhooks" icon={<Link2 />} label="Webhooks" />
        </nav>
        <SidebarLink to="/settings" icon={<SettingsIcon />} label="Settings" />
      </aside>
      <main className="flex-1 p-10 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

const SidebarLink = ({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) => (
  <Link to={to} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition">
    {icon}
    <span>{label}</span>
  </Link>
);

export default DashboardLayout;
