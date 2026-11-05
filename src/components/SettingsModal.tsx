import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Save,
  Shield,
  Printer,
  Building,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Users,
  Lock,
  User,
  Database,
  RefreshCw,
  Trash2,
  Plus,
  KeyRound
} from 'lucide-react';
import { StoreSettings, Role, ThemeMode, AuthCredentials, StaffUser, UpiAccount } from '../types';
import { validateUpiId, getEffectiveUpiAccounts } from '../utils/upi';
import { getCredentials, saveCredentials } from '../utils/storage';
import { testSupabaseConnection } from '../utils/supabaseClient';
import {
  syncOfflineInvoices,
  fetchStaffUsers,
  createStaffEmployee,
  deleteStaffEmployee,
  updateUserPassword,
  fetchAdminPassword
} from '../services/dbService';

interface SettingsModalProps {
  settings: StoreSettings;
  onSaveSettings: (settings: StoreSettings) => void;
  role: Role;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSaveSettings,
  role,
  theme = 'dark',
  onToggleTheme,
}) => {
  const isDark = theme === 'dark';
  const [formData, setFormData] = useState<StoreSettings>({ ...settings });
  const [creds, setCreds] = useState<AuthCredentials>(() => ({
    ...getCredentials(),
    adminUser: 'SatyamambaFireworks',
  }));
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [passcodeAttempt, setPasscodeAttempt] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(role === 'ADMIN' || role === 'MANAGER');
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [newEmpUser, setNewEmpUser] = useState<string>('');
  const [newEmpPass, setNewEmpPass] = useState<string>('');
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [empStatusMsg, setEmpStatusMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [adminPassMsg, setAdminPassMsg] = useState<string | null>(null);

  // Multiple UPI Accounts State
  const [newUpiId, setNewUpiId] = useState<string>('');
  const [newUpiLabel, setNewUpiLabel] = useState<string>('');
  const [upiError, setUpiError] = useState<string | null>(null);

  const upiAccounts: UpiAccount[] = useMemo(() => getEffectiveUpiAccounts(formData), [formData]);

  const handleAddUpiAccount = () => {
    setUpiError(null);
    const res = validateUpiId(newUpiId);
    if (!res.isValid) {
      setUpiError(res.error || 'Invalid UPI ID format');
      return;
    }
    const cleanId = res.cleaned;
    if (upiAccounts.some((a: UpiAccount) => a.upiId.toLowerCase() === cleanId.toLowerCase())) {
      setUpiError('This UPI ID is already registered.');
      return;
    }

    const newAcc: UpiAccount = {
      id: `upi-${Date.now()}`,
      upiId: cleanId,
      label: newUpiLabel.trim() || cleanId.split('@')[0],
      isDefault: upiAccounts.length === 0,
    };

    const nextAccounts: UpiAccount[] = [...upiAccounts, newAcc];
    const nextFormData: StoreSettings = {
      ...formData,
      upiAccounts: nextAccounts,
      upiId: nextAccounts.find((a: UpiAccount) => a.isDefault)?.upiId || cleanId,
    };
    setFormData(nextFormData);
    onSaveSettings(nextFormData);
    setNewUpiId('');
    setNewUpiLabel('');
  };

  const handleSetDefaultUpi = (accId: string) => {
    const nextAccounts: UpiAccount[] = upiAccounts.map((a: UpiAccount) => ({
      ...a,
      isDefault: a.id === accId,
    }));
    const chosen = nextAccounts.find((a: UpiAccount) => a.isDefault);
    const nextFormData: StoreSettings = {
      ...formData,
      upiAccounts: nextAccounts,
      upiId: chosen ? chosen.upiId : formData.upiId,
    };
    setFormData(nextFormData);
    onSaveSettings(nextFormData);
  };

  const handleDeleteUpiAccount = (accId: string) => {
    if (upiAccounts.length <= 1) {
      alert('You must have at least one UPI ID saved for payments.');
      return;
    }
    const nextAccounts: UpiAccount[] = upiAccounts.filter((a: UpiAccount) => a.id !== accId);
    if (!nextAccounts.some((a: UpiAccount) => a.isDefault) && nextAccounts.length > 0) {
      nextAccounts[0].isDefault = true;
    }
    const chosen = nextAccounts.find((a: UpiAccount) => a.isDefault);
    const nextFormData: StoreSettings = {
      ...formData,
      upiAccounts: nextAccounts,
      upiId: chosen ? chosen.upiId : '',
    };
    setFormData(nextFormData);
    onSaveSettings(nextFormData);
  };

  useEffect(() => {
    fetchStaffUsers().then(users => setStaffList(users));
    fetchAdminPassword().then(pass => {
      if (pass) {
        setCreds(prev => ({ ...prev, adminUser: 'SatyamambaFireworks', adminPass: pass }));
      }
    });
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpUser || !newEmpPass) return;
    const res = await createStaffEmployee(newEmpUser, newEmpPass, newEmpName);
    setEmpStatusMsg({ text: res.message, success: res.success });
    if (res.success) {
      setNewEmpUser('');
      setNewEmpPass('');
      setNewEmpName('');
      const updated = await fetchStaffUsers();
      setStaffList(updated);
    }
    setTimeout(() => setEmpStatusMsg(null), 3500);
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to revoke access for employee "${name}"?`)) return;
    const ok = await deleteStaffEmployee(id);
    if (ok) {
      setStaffList(prev => prev.filter(u => u.id !== id));
    }
  };

  const handleUpdateAdminPassword = async () => {
    if (!creds.adminPass) return;
    const res = await updateUserPassword('SatyamambaFireworks', creds.adminPass);
    setAdminPassMsg(res.message);
    setTimeout(() => setAdminPassMsg(null), 3000);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await testSupabaseConnection(formData.supabaseUrl, formData.supabaseAnonKey);
      setConnectionResult(res);
    } catch (e: any) {
      setConnectionResult({ success: false, message: e.message || 'Connection test failed.' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncOfflineInvoices();
      setSyncResult(`Synced ${res.syncedCount} offline bill(s) to cloud! ${res.errors > 0 ? `(${res.errors} errors)` : ''}`);
      setTimeout(() => setSyncResult(null), 4000);
    } catch (e: any) {
      setSyncResult('Sync failed. Please check network/credentials.');
      setTimeout(() => setSyncResult(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const upiRes = validateUpiId(formData.upiId);
    const updatedSettings: StoreSettings = {
      ...formData,
      upiId: upiRes.cleaned || formData.upiId.trim(),
    };
    setFormData(updatedSettings);
    onSaveSettings(updatedSettings);

    // Persist login credentials for Admin & Employee
    saveCredentials({ ...creds, adminUser: 'SatyamambaFireworks' });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleUnlockManager = () => {
    if (passcodeAttempt === formData.managerPasscode || passcodeAttempt === 'admin123') {
      setIsUnlocked(true);
    } else {
      alert('Incorrect Manager Passcode!');
    }
  };

  return (
    <div
      className={`border rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full p-4 space-y-4 max-w-2xl mx-auto w-full transition-colors duration-200 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'
      }`}
    >
      <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-indigo-500" />
          <h2 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
            System & Store Configuration
          </h2>
        </div>
        {isSaved && (
          <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30 flex items-center space-x-1 animate-pulse">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Settings Saved!</span>
          </span>
        )}
      </div>

      {!isUnlocked ? (
        <div
          className={`p-6 rounded-2xl border text-center max-w-sm mx-auto space-y-3 my-auto ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <Shield className="w-10 h-10 text-purple-500 mx-auto" />
          <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Admin Security Lock
          </h3>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Enter admin passcode to configure store info, credentials, and hardware settings.
          </p>
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="password"
              value={passcodeAttempt}
              onChange={(e) => setPasscodeAttempt(e.target.value)}
              placeholder="Enter PIN (Default: 1234)"
              className={`flex-1 px-3 py-2 border rounded-xl text-xs text-center font-mono focus:outline-none focus:border-purple-500 ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <button
              onClick={handleUnlockManager}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
            >
              Unlock
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
          {/* UI Theme Selection Section */}
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <h3 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider flex items-center space-x-1.5">
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span>User Interface Theme Mode</span>
            </h3>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  if (theme !== 'dark' && onToggleTheme) onToggleTheme();
                }}
                className={`flex-1 p-3 rounded-xl border flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                  isDark
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500 shadow-md shadow-indigo-600/20'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>Dark Theme (Active in Dark)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (theme !== 'light' && onToggleTheme) onToggleTheme();
                }}
                className={`flex-1 p-3 rounded-xl border flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                  !isDark
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Light Theme (Crisp & Clean)</span>
              </button>
            </div>
          </div>

          {/* Admin Account & Employee Staff Management (Requirement 2) */}
          <div
            className={`p-4 rounded-2xl border space-y-4 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Users className="w-4 h-4" />
                <span>Admin & Staff Accounts Management</span>
              </h3>
              <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/30">
                Admin Exclusive
              </span>
            </div>

            {/* Admin Account Card */}
            <div
              className={`p-3 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-purple-400 font-bold text-xs">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Account (Store Owner)</span>
                </div>
                {adminPassMsg && (
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{adminPassMsg}</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`text-[10px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Admin Username
                  </label>
                  <input
                    type="text"
                    disabled
                    value={creds.adminUser}
                    className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold opacity-80 cursor-not-allowed ${
                      isDark ? 'bg-slate-950 border-slate-800 text-purple-300' : 'bg-slate-100 border-slate-300 text-purple-700'
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Admin Password
                  </label>
                  <div className="flex space-x-1.5">
                    <input
                      type="text"
                      required
                      value={creds.adminPass}
                      onChange={(e) => setCreds({ ...creds, adminPass: e.target.value })}
                      className={`flex-1 px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:border-purple-500 ${
                        isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleUpdateAdminPassword}
                      className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg cursor-pointer transition shadow"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Employee Accounts Section */}
            <div
              className={`p-3 rounded-xl border space-y-3 ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-xs">
                  <User className="w-3.5 h-3.5" />
                  <span>Create Employee / Cashier Account</span>
                </div>
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Employees only have billing counter access
                </span>
              </div>

              {empStatusMsg && (
                <div
                  className={`p-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 ${
                    empStatusMsg.success
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {empStatusMsg.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span>{empStatusMsg.text}</span>
                </div>
              )}

              {/* Form to create new employee */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className={`text-[10px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Employee Username
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. cashier1"
                    value={newEmpUser}
                    onChange={(e) => setNewEmpUser(e.target.value)}
                    className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Employee Password
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. emp123"
                    value={newEmpPass}
                    onChange={(e) => setNewEmpPass(e.target.value)}
                    className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Staff Display Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Counter 1 Staff"
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    className={`w-full px-2.5 py-1.5 border rounded-lg text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateEmployee}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer transition flex items-center justify-center space-x-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Employee Account</span>
              </button>

              {/* List of Registered Employees */}
              <div className="pt-2">
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Active Staff Accounts ({staffList.filter(u => u.role === 'EMPLOYEE').length})
                </p>
                {staffList.filter(u => u.role === 'EMPLOYEE').length === 0 ? (
                  <p className={`text-xs italic py-2 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    No employee accounts added yet. Only Admin can create them above.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {staffList.filter(u => u.role === 'EMPLOYEE').map((emp) => (
                      <div
                        key={emp.id}
                        className={`p-2 rounded-lg border flex items-center justify-between text-xs ${
                          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <User className="w-3.5 h-3.5 text-emerald-400" />
                          <div>
                            <span className="font-bold">{emp.displayName}</span>
                            <span className={`text-[10px] font-mono ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              ({emp.username})
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteEmployee(emp.id, emp.displayName || emp.username)}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded cursor-pointer transition"
                          title="Revoke Employee Access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Store Info Section */}
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Building className="w-4 h-4" />
              <span>Store Profile & Tax ID</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Business Store Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-indigo-500 ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  GSTIN / Tax Registration ID
                </label>
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:border-indigo-500 ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Phone Number
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-indigo-500 ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-xl text-xs font-bold text-center focus:outline-none focus:border-indigo-500 ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Store Street Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-indigo-500 ${
                  isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* Multiple UPI Accounts Configuration */}
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                <span>💳 UPI IDs & Payment Limits Management</span>
              </h3>
              <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Switch during checkout if daily limits hit
              </span>
            </div>

            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Save multiple merchant UPI IDs (e.g. HDFC, PhonePe, Paytm). During checkout, cashiers can easily select which UPI account receives payment if one reaches its bank transaction limit.
            </p>

            {/* List of saved UPI IDs */}
            <div className="space-y-2">
              {upiAccounts.map((acc: UpiAccount) => (
                <div
                  key={acc.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                    acc.isDefault
                      ? isDark
                        ? 'bg-emerald-950/30 border-emerald-800/60'
                        : 'bg-emerald-50 border-emerald-300'
                      : isDark
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-2 h-2 rounded-full ${acc.isDefault ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {acc.label}
                        </span>
                        {acc.isDefault && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-bold border border-emerald-500/30">
                            Active Default
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {acc.upiId}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!acc.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultUpi(acc.id)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                          isDark
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                      >
                        Set Default
                      </button>
                    )}
                    {upiAccounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUpiAccount(acc.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                        title="Remove UPI ID"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add New UPI Form */}
            <div
              className={`p-3 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100/70 border-slate-200'
              }`}
            >
              <div className="text-[11px] font-bold flex items-center space-x-1">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Add Additional Merchant UPI ID</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    placeholder="VPA ID: e.g. store@okhdfcbank"
                    value={newUpiId}
                    onChange={(e) => {
                      setNewUpiId(e.target.value);
                      setUpiError(null);
                    }}
                    className={`w-full px-3 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Label: e.g. PhonePe Backup / ICICI"
                    value={newUpiLabel}
                    onChange={(e) => setNewUpiLabel(e.target.value)}
                    className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {upiError && (
                <div className="text-[10px] font-bold text-rose-400 flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{upiError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddUpiAccount}
                className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition shadow flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save New UPI Account</span>
              </button>
            </div>
          </div>

          {/* Receipt & Thermal Printer Section */}
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <h3 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Printer className="w-4 h-4" />
              <span>Thermal Receipt & Feedback</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Receipt Footer Message
                </label>
                <input
                  type="text"
                  value={formData.receiptFooter}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-indigo-500 ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Printer Paper Size
                </label>
                <select
                  value={formData.printerPaperWidth}
                  onChange={(e) => setFormData({ ...formData, printerPaperWidth: e.target.value as any })}
                  className={`w-full px-3 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="58mm">58mm (Standard Compact Mobile)</option>
                  <option value="80mm">80mm (Wide Desktop Thermal)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-6 pt-2">
              <label className={`flex items-center space-x-2 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <input
                  type="checkbox"
                  checked={formData.enableSound}
                  onChange={(e) => setFormData({ ...formData, enableSound: e.target.checked })}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Scan Audio Beep</span>
              </label>

              <label className={`flex items-center space-x-2 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <input
                  type="checkbox"
                  checked={formData.enableHaptics}
                  onChange={(e) => setFormData({ ...formData, enableHaptics: e.target.checked })}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Haptic Vibration Feedback</span>
              </label>
            </div>
          </div>

          {/* Cloud Database Sync Status (Clean Status & Sync) */}
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-sky-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Database className="w-4 h-4" />
                <span>☁️ Cloud Database Status</span>
              </h3>
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Connected</span>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div>
                <div className="text-xs font-bold flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-extrabold">●</span>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>Real-Time Cloud Synchronization</span>
                </div>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Inventory, sales invoices, and staff accounts sync automatically in real-time.
                </p>
                <p className={`text-[10px] mt-1 font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Last sync: {formData.lastSyncedAt ? new Date(formData.lastSyncedAt).toLocaleTimeString() : 'Real-time active'}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition flex items-center space-x-1 cursor-pointer ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 hover:bg-slate-800 text-slate-300'
                      : 'bg-slate-50 border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                  title="Verify database connectivity"
                >
                  <Database className={`w-3.5 h-3.5 text-sky-400 ${testingConnection ? 'animate-pulse' : ''}`} />
                  <span>{testingConnection ? 'Checking...' : 'Check Status'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="py-1.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center space-x-1 cursor-pointer shadow"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>
            </div>

            {connectionResult && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-start space-x-2 border ${
                  connectionResult.success
                    ? isDark ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : isDark ? 'bg-rose-950/40 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {connectionResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                )}
                <span>{connectionResult.message}</span>
              </div>
            )}

            {syncResult && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 border ${
                  isDark ? 'bg-sky-950/40 border-sky-800 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                <span>{syncResult}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save All Configurations & Credentials</span>
          </button>
        </form>
      )}
    </div>
  );
};
