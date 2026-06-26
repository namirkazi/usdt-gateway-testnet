// src/components/Layout.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Wallet, ArrowLeftRight,
  LogOut, Shield, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const nav = [
  { to: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/wallets',      label: 'Wallets',        icon: Wallet },
  { to: '/transactions', label: 'Transactions',   icon: ArrowLeftRight },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-surface-800 border-r border-surface-600 flex flex-col fixed inset-y-0 z-10">
        {/* Logo */}
        <div className="p-6 border-b border-surface-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">USDT Gateway</p>
              <p className="text-xs text-gray-500">TRC20 Payments</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-surface-700'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-surface-600">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-6 h-6 bg-surface-600 rounded-full flex items-center justify-center">
              <span className="text-xs text-gray-300">{admin?.username?.[0]?.toUpperCase()}</span>
            </div>
            <span className="text-sm text-gray-300 truncate">{admin?.username}</span>
          </div>
          <button onClick={handleLogout} className="btn-ghost w-full text-sm">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen">
        {/* Top bar */}
        <header className="h-14 bg-surface-800 border-b border-surface-600 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Activity className="w-3 h-3 text-brand-500" />
            <span>Live monitoring active</span>
          </div>
          <span className="text-xs text-gray-600 font-mono">
            {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}
          </span>
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
