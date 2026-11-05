import React from 'react';
import {
  ShoppingBag,
  Package,
  BarChart3,
  Settings,
  Zap,
  Wifi,
  WifiOff,
  ShieldCheck,
  UserCheck,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import { Role, ThemeMode, UserSession } from '../types';

interface NavbarProps {
  activeTab: 'billing' | 'inventory' | 'reports' | 'settings';
  setActiveTab: (tab: 'billing' | 'inventory' | 'reports' | 'settings') => void;
  cartCount: number;
  role: Role;
  storeName: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  session: UserSession | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  role,
  storeName,
  theme,
  onToggleTheme,
  session,
  onLogout,
}) => {
  const isDark = theme === 'dark';
  const isAdmin = role === 'ADMIN' || role === 'MANAGER';
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 backdrop-blur-md border-b transition-colors duration-200 ${
        isDark
          ? 'bg-slate-900/90 border-slate-800 text-white shadow-xl'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between">
        {/* Brand & Store Name */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 p-0.5 shadow-md shadow-indigo-500/20 flex items-center justify-center">
            <div
              className={`w-full h-full rounded-[10px] flex items-center justify-center ${
                isDark ? 'bg-slate-950' : 'bg-white'
              }`}
            >
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400/20" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1
                className={`font-black text-sm sm:text-base tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {storeName}
              </h1>
              {isOnline ? (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <Wifi className="w-3 h-3 mr-1" /> Ready
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <WifiOff className="w-3 h-3 mr-1" /> Offline
                </span>
              )}
            </div>
            <p className={`text-[10px] sm:text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {isAdmin ? '👑 Admin Management Console' : '👤 Employee POS Billing Counter'}
            </p>
          </div>
        </div>

        {/* Right Action Icons: Theme Toggle, User Profile, Logout */}
        <div className="flex items-center space-x-2">
          {/* Theme Mode Switcher */}
          <button
            onClick={onToggleTheme}
            type="button"
            className={`p-2 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
              isDark
                ? 'bg-slate-800/80 border-slate-700 text-amber-400 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 hover:text-indigo-600'
            }`}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* User Badge */}
          <div
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border ${
              isAdmin
                ? isDark
                  ? 'bg-purple-950/40 border-purple-800/40 text-purple-300'
                  : 'bg-purple-50 border-purple-200 text-purple-800'
                : isDark
                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {isAdmin ? (
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span className="hidden md:inline font-mono">
              {session?.username || (isAdmin ? 'admin' : 'employee')}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded-md bg-black/10">
              {isAdmin ? 'Admin' : 'Cashier'}
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            type="button"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all ${
              isDark
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
            }`}
            title="Log out of POS session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <nav
        className={`flex justify-around border-t px-2 py-1.5 transition-colors duration-200 ${
          isDark ? 'border-slate-800/80 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
        }`}
      >
        {/* Billing Counter - Visible to both Admin and Employee */}
        <button
          onClick={() => setActiveTab('billing')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
            activeTab === 'billing'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <div className="relative">
            <ShoppingBag className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-amber-500 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {cartCount}
              </span>
            )}
          </div>
          <span>Billing Counter</span>
        </button>

        {/* Admin-only Navigation Tabs */}
        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Catalog & Stock</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                activeTab === 'reports'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Sales & Invoices</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </>
        )}
      </nav>
    </header>
  );
};
