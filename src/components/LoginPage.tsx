import React, { useState } from 'react';
import {
  Zap,
  Lock,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { UserSession, ThemeMode } from '../types';
import { authenticateUser } from '../services/dbService';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  storeName: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  theme,
  onToggleTheme,
  storeName,
}) => {
  const isDark = theme === 'dark';
  const [roleMode, setRoleMode] = useState<'ADMIN' | 'EMPLOYEE'>('ADMIN');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Switch role without prefilling credentials
  const handleSelectRole = (role: 'ADMIN' | 'EMPLOYEE') => {
    setRoleMode(role);
    setErrorMsg('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const session = await authenticateUser(username, password);
      if (session) {
        onLoginSuccess(session);
        return;
      }
      setIsSubmitting(false);
      setErrorMsg('Invalid username or password. Please check your credentials.');
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col justify-center items-center p-4 transition-colors duration-300 relative ${
        isDark
          ? 'bg-slate-950 text-slate-100'
          : 'bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/30 text-slate-900'
      }`}
    >
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Controls: Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={onToggleTheme}
          type="button"
          className={`p-2.5 rounded-xl border flex items-center space-x-2 text-xs font-semibold transition-all shadow-sm ${
            isDark
              ? 'bg-slate-900/80 border-slate-800 text-amber-400 hover:bg-slate-800 hover:border-slate-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600'
          }`}
          title="Toggle Light / Dark UI Theme"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Main Login Card */}
      <div
        className={`w-full max-w-md rounded-2xl border p-6 sm:p-8 shadow-2xl transition-all duration-300 z-10 animate-scaleUp backdrop-blur-xl ${
          isDark
            ? 'bg-slate-900/85 border-slate-800 shadow-indigo-950/40'
            : 'bg-white/95 border-slate-200 shadow-slate-300/60'
        }`}
      >
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 p-0.5 shadow-xl shadow-indigo-500/25 items-center justify-center mb-3">
            <div
              className={`w-full h-full rounded-[14px] flex items-center justify-center ${
                isDark ? 'bg-slate-950' : 'bg-white'
              }`}
            >
              <Zap className="w-7 h-7 text-amber-400 fill-amber-400/20" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">{storeName}</h1>
          <p className={`text-xs mt-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            POS Terminal Security & Login
          </p>
        </div>

        {/* Role Segmented Tabs */}
        <div
          className={`p-1 rounded-xl flex items-center mb-5 border ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => handleSelectRole('ADMIN')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
              roleMode === 'ADMIN'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin / Manager</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectRole('EMPLOYEE')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
              roleMode === 'EMPLOYEE'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Employee (Cashier)</span>
          </button>
        </div>

        {/* Role Privileges Hint */}
        <div
          className={`p-3 rounded-xl mb-5 text-[11px] leading-relaxed border ${
            roleMode === 'ADMIN'
              ? isDark
                ? 'bg-purple-950/30 border-purple-800/40 text-purple-200'
                : 'bg-purple-50 border-purple-200 text-purple-900'
              : isDark
              ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {roleMode === 'ADMIN' ? (
            <p>
              👑 <strong>Admin Mode:</strong> Full system access including <strong>Catalog & Stock</strong>,{' '}
              <strong>Sales & Invoices</strong>, Analytics, System Settings & Thermal Printer.
            </p>
          ) : (
            <p>
              👤 <strong>Employee Mode:</strong> Direct access to <strong>Billing Counter</strong>, Barcode
              Scanner, Cart & Customer Checkout. Management sections are locked.
            </p>
          )}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start space-x-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username Field */}
          <div>
            <label
              className={`block text-xs font-bold mb-1.5 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter username"
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm border font-medium transition-all outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                  isDark
                    ? 'bg-slate-950/80 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600'
                }`}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label
              className={`block text-xs font-bold mb-1.5 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter password"
                className={`w-full pl-9 pr-10 py-2.5 rounded-xl text-sm border font-medium transition-all outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                  isDark
                    ? 'bg-slate-950/80 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-400 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Option */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Keep me logged in
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.99] transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to POS Counter</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Security Disclaimer */}
      <p className={`mt-6 text-[11px] text-center max-w-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Fireworks POS • Role-based access control with offline database support.
      </p>
    </div>
  );
};
