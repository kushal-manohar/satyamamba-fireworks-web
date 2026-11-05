import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Receipt,
  Eye,
  Search,
  Calendar,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  Tag,
  CreditCard,
  Smartphone,
  Wallet,
  Flame,
  Trophy,
  Award,
  Medal,
  Package,
  Layers,
  ArrowUpRight,
  Users,
  QrCode
} from 'lucide-react';
import { Invoice, StoreSettings, ThemeMode } from '../types';
import { getEffectiveUpiAccounts } from '../utils/upi';

interface SalesReportsProps {
  invoices: Invoice[];
  settings: StoreSettings;
  onViewInvoice: (invoice: Invoice) => void;
  theme?: ThemeMode;
}

type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST7' | 'THIS_MONTH' | 'CUSTOM';

const formatDateForInput = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const SalesReports: React.FC<SalesReportsProps> = ({
  invoices,
  settings,
  onViewInvoice,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<DatePreset>('ALL');

  // Top Sold Items Report States
  const [topItemsScope, setTopItemsScope] = useState<'PERIOD' | 'ALL'>('PERIOD');
  const [topItemsSortBy, setTopItemsSortBy] = useState<'QTY' | 'REVENUE'>('QTY');
  const [topItemSearch, setTopItemSearch] = useState<string>('');

  // Overall Lifetime KPIs
  const overallSales = useMemo(() => invoices.reduce((sum, inv) => sum + inv.grandTotal, 0), [invoices]);
  const overallTax = useMemo(() => invoices.reduce((sum, inv) => sum + inv.taxTotal, 0), [invoices]);
  const overallCount = invoices.length;

  // Preset Handlers
  const handlePresetChange = (preset: DatePreset) => {
    setActivePreset(preset);
    const today = new Date();

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'TODAY') {
      const todayStr = formatDateForInput(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
      return;
    }

    if (preset === 'YESTERDAY') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatDateForInput(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
      return;
    }

    if (preset === 'LAST7') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setStartDate(formatDateForInput(start));
      setEndDate(formatDateForInput(today));
      return;
    }

    if (preset === 'THIS_MONTH') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDateForInput(start));
      setEndDate(formatDateForInput(today));
      return;
    }
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setActivePreset('CUSTOM');
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setActivePreset('ALL');
  };

  // Date Filtered Invoices
  const dateFilteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (!inv.timestamp) return true;
      const invDate = new Date(inv.timestamp);
      if (isNaN(invDate.getTime())) return true;

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (invDate < start) return false;
      }

      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`);
        if (invDate > end) return false;
      }

      return true;
    });
  }, [invoices, startDate, endDate]);

  // Period Specific Analytics Metrics
  const periodStats = useMemo(() => {
    const totalSales = dateFilteredInvoices.reduce((sum, i) => sum + i.grandTotal, 0);
    const totalTax = dateFilteredInvoices.reduce((sum, i) => sum + i.taxTotal, 0);
    const totalDiscount = dateFilteredInvoices.reduce((sum, i) => sum + i.discountTotal, 0);
    const count = dateFilteredInvoices.length;
    const avgOrderValue = count > 0 ? totalSales / count : 0;

    const cash = dateFilteredInvoices.filter(i => i.paymentMethod === 'CASH').reduce((sum, i) => sum + i.grandTotal, 0);
    const upi = dateFilteredInvoices.filter(i => i.paymentMethod === 'UPI').reduce((sum, i) => sum + i.grandTotal, 0);
    const card = dateFilteredInvoices.filter(i => i.paymentMethod === 'CARD').reduce((sum, i) => sum + i.grandTotal, 0);

    return {
      totalSales,
      totalTax,
      totalDiscount,
      count,
      avgOrderValue,
      cash,
      upi,
      card,
      digital: upi + card,
    };
  }, [dateFilteredInvoices]);

  // Top Sold Items Aggregation
  const topSoldProducts = useMemo(() => {
    const targetInvoices = topItemsScope === 'PERIOD' ? dateFilteredInvoices : invoices;
    const map = new Map<string, {
      id: string;
      barcode: string;
      name: string;
      totalQty: number;
      totalRevenue: number;
      orderCount: number;
      avgPrice: number;
    }>();

    targetInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const key = item.productId || item.barcode || item.name;
        const existing = map.get(key);
        if (existing) {
          existing.totalQty += item.quantity;
          existing.totalRevenue += item.lineTotal;
          existing.orderCount += 1;
        } else {
          map.set(key, {
            id: item.productId,
            barcode: item.barcode,
            name: item.name,
            totalQty: item.quantity,
            totalRevenue: item.lineTotal,
            orderCount: 1,
            avgPrice: item.unitPrice,
          });
        }
      });
    });

    let list = Array.from(map.values());

    if (topItemsSortBy === 'QTY') {
      list.sort((a, b) => b.totalQty - a.totalQty);
    } else {
      list.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }

    if (topItemSearch.trim()) {
      const q = topItemSearch.toLowerCase();
      list = list.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.barcode.includes(q)
      );
    }

    return list;
  }, [invoices, dateFilteredInvoices, topItemsScope, topItemsSortBy, topItemSearch]);

  const maxSoldQty = useMemo(() => {
    if (topSoldProducts.length === 0) return 1;
    return Math.max(...topSoldProducts.map(p => p.totalQty), 1);
  }, [topSoldProducts]);

  // Final List filtered by Search Query
  const searchFilteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return dateFilteredInvoices;
    const q = searchQuery.toLowerCase();
    return dateFilteredInvoices.filter(
      (inv) =>
        inv.id.toLowerCase().includes(q) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
        (inv.customerPhone && inv.customerPhone.includes(q))
    );
  }, [dateFilteredInvoices, searchQuery]);

  // Account / Cashier breakdown for the filtered period
  const accountStats = useMemo(() => {
    const map = new Map<string, {
      cashierName: string;
      orderCount: number;
      totalRevenue: number;
      cashRevenue: number;
      upiRevenue: number;
      cardRevenue: number;
    }>();

    dateFilteredInvoices.forEach((inv) => {
      const name = inv.cashierName?.trim() || 'Store Cashier';
      const existing = map.get(name) || {
        cashierName: name,
        orderCount: 0,
        totalRevenue: 0,
        cashRevenue: 0,
        upiRevenue: 0,
        cardRevenue: 0,
      };

      existing.orderCount += 1;
      existing.totalRevenue += inv.grandTotal;
      if (inv.paymentMethod === 'CASH') existing.cashRevenue += inv.grandTotal;
      else if (inv.paymentMethod === 'UPI') existing.upiRevenue += inv.grandTotal;
      else if (inv.paymentMethod === 'CARD') existing.cardRevenue += inv.grandTotal;

      map.set(name, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [dateFilteredInvoices]);

  // Payment method breakdown including individual UPI ID analytics
  const paymentBreakdown = useMemo(() => {
    let cashCount = 0;
    let cashRevenue = 0;
    let cardCount = 0;
    let cardRevenue = 0;

    const upiMap = new Map<string, {
      upiId: string;
      label: string;
      orderCount: number;
      totalRevenue: number;
    }>();

    const fallbackUpi = (settings.upiId || '').trim();
    const effectiveAccounts = getEffectiveUpiAccounts(settings);

    // Initialize all saved accounts so they appear in reconciliation even with 0 sales
    effectiveAccounts.forEach((acc) => {
      upiMap.set(acc.upiId.toLowerCase(), {
        upiId: acc.upiId,
        label: acc.label || (acc.isDefault ? 'Primary UPI' : acc.upiId.split('@')[0]),
        orderCount: 0,
        totalRevenue: 0,
      });
    });

    dateFilteredInvoices.forEach((inv) => {
      if (inv.paymentMethod === 'CASH') {
        cashCount += 1;
        cashRevenue += inv.grandTotal;
      } else if (inv.paymentMethod === 'CARD') {
        cardCount += 1;
        cardRevenue += inv.grandTotal;
      } else if (inv.paymentMethod === 'UPI') {
        const rawUpiId = (inv.selectedUpiId || fallbackUpi || 'Default UPI').trim();
        const key = rawUpiId.toLowerCase();
        const matchedAccount = effectiveAccounts.find(
          (a) => a.upiId.toLowerCase() === key
        );
        const label = matchedAccount?.label || (rawUpiId.toLowerCase() === fallbackUpi.toLowerCase() ? 'Primary UPI' : 'UPI Account');

        const existing = upiMap.get(key) || {
          upiId: rawUpiId,
          label: label,
          orderCount: 0,
          totalRevenue: 0,
        };

        existing.orderCount += 1;
        existing.totalRevenue += inv.grandTotal;
        upiMap.set(key, existing);
      }
    });

    const upiList = Array.from(upiMap.values()).sort((a, b) => {
      if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue;
      return b.orderCount - a.orderCount;
    });
    const totalUpiCount = upiList.reduce((acc, u) => acc + u.orderCount, 0);
    const totalUpiRevenue = upiList.reduce((acc, u) => acc + u.totalRevenue, 0);

    return {
      cash: { count: cashCount, revenue: cashRevenue },
      card: { count: cardCount, revenue: cardRevenue },
      upiTotal: { count: totalUpiCount, revenue: totalUpiRevenue },
      upiAccounts: upiList,
    };
  }, [dateFilteredInvoices, settings.upiId, settings.upiAccounts]);

  return (
    <div className={`border rounded-2xl shadow-xl flex flex-col space-y-4 p-4 transition-colors ${
      isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
    }`}>
      {/* Sales Overview Header */}
      <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${
        isDark ? 'border-slate-800' : 'border-slate-200'
      }`}>
        <div className="flex items-center space-x-2">
          <div className={`p-2 rounded-xl border ${
            isDark ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-600'
          }`}>
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`font-extrabold text-base tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Sales & Revenue Dashboard
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Real-time financial analytics & custom period reporting
            </p>
          </div>
        </div>

        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <Calendar className={`w-3.5 h-3.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {activePreset === 'ALL' && 'Lifetime Summary'}
            {activePreset === 'TODAY' && "Today's Sales"}
            {activePreset === 'YESTERDAY' && "Yesterday's Sales"}
            {activePreset === 'LAST7' && 'Last 7 Days Report'}
            {activePreset === 'THIS_MONTH' && "This Month's Report"}
            {activePreset === 'CUSTOM' && `Custom Range (${startDate || 'Start'} to ${endDate || 'End'})`}
          </span>
        </div>
      </div>

      {/* Lifetime Overview KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`p-3.5 rounded-2xl border space-y-1 ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'
        }`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            All-Time Revenue
          </span>
          <p className={`text-xl font-black font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {settings.currencySymbol}{overallSales.toFixed(2)}
          </p>
          <span className={`text-[10px] flex items-center space-x-1 ${isDark ? 'text-emerald-400/80' : 'text-emerald-600'}`}>
            <TrendingUp className="w-3 h-3" />
            <span>{overallCount} Total Bills</span>
          </span>
        </div>

        <div className={`p-3.5 rounded-2xl border space-y-1 ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'
        }`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            All-Time Tax
          </span>
          <p className={`text-xl font-black font-mono ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
            {settings.currencySymbol}{overallTax.toFixed(2)}
          </p>
          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>GST / VAT Total</span>
        </div>

        <div className={`p-3.5 rounded-2xl border space-y-1 ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'
        }`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Avg Order Value
          </span>
          <p className={`text-lg font-black font-mono ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
            {settings.currencySymbol}{(overallCount > 0 ? overallSales / overallCount : 0).toFixed(2)}
          </p>
          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Per Transaction</span>
        </div>

        <div className={`p-3.5 rounded-2xl border space-y-1 ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'
        }`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Store Tax Rate
          </span>
          <p className={`text-lg font-black font-mono ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
            {settings.gstin || 'Standard'}
          </p>
          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Active GSTIN</span>
        </div>
      </div>

      {/* SECTION: Custom Date Selection & Period Analytics Report */}
      <div className={`p-4 rounded-2xl border space-y-4 shadow-md ${
        isDark
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border-indigo-500/20'
          : 'bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 border-indigo-100'
      }`}>
        <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}>
          <div className="flex items-center space-x-2">
            <Filter className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <h3 className={`font-extrabold text-sm tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Custom Date Range Filter & Period Report
            </h3>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['TODAY', 'YESTERDAY', 'LAST7', 'THIS_MONTH', 'ALL'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  activePreset === preset
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {preset === 'TODAY' && 'Today'}
                {preset === 'YESTERDAY' && 'Yesterday'}
                {preset === 'LAST7' && 'Last 7 Days'}
                {preset === 'THIS_MONTH' && 'This Month'}
                {preset === 'ALL' && 'All Time'}
              </button>
            ))}
          </div>
        </div>

        {/* Date Inputs Controls */}
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 items-end p-3 rounded-xl border ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="space-y-1">
            <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              <Calendar className="w-3 h-3 text-indigo-500" />
              <span>Start Date</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleCustomDateChange(e.target.value, endDate)}
              className={`w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 font-mono ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div className="space-y-1">
            <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              <Calendar className="w-3 h-3 text-indigo-500" />
              <span>End Date</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleCustomDateChange(startDate, e.target.value)}
              className={`w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 font-mono ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={clearDateFilter}
              className={`w-full py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1 border ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Date Filter</span>
            </button>
          </div>
        </div>

        {/* Selected Period Report Summary Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className={`text-xs font-black uppercase tracking-wider flex items-center space-x-1 ${
              isDark ? 'text-indigo-300' : 'text-indigo-700'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                Period Sales Report ({startDate ? startDate : 'Start'} to {endDate ? endDate : 'End'})
              </span>
            </h4>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
            }`}>
              {periodStats.count} Invoices Found
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Period Revenue */}
            <div className={`p-3 rounded-xl border space-y-0.5 ${
              isDark ? 'bg-slate-950/80 border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <span className={`text-[10px] font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Period Total Sales
              </span>
              <p className={`text-lg font-black font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {settings.currencySymbol}{periodStats.totalSales.toFixed(2)}
              </p>
              <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Net Revenue in Range
              </span>
            </div>

            {/* Period Orders & AOV */}
            <div className={`p-3 rounded-xl border space-y-0.5 ${
              isDark ? 'bg-slate-950/80 border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <span className={`text-[10px] font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Orders & Avg Value
              </span>
              <p className={`text-base font-black font-mono ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                {periodStats.count} orders • {settings.currencySymbol}{periodStats.avgOrderValue.toFixed(2)}
              </p>
              <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Average Invoice Size
              </span>
            </div>

            {/* Tax & Discount */}
            <div className={`p-3 rounded-xl border space-y-0.5 ${
              isDark ? 'bg-slate-950/80 border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <span className={`text-[10px] font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Period Tax & Discounts
              </span>
              <p className={`text-base font-black font-mono ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                Tax: {settings.currencySymbol}{periodStats.totalTax.toFixed(2)}
              </p>
              <span className="text-[10px] text-orange-500 block font-mono font-medium">
                Disc Given: -{settings.currencySymbol}{periodStats.totalDiscount.toFixed(2)}
              </span>
            </div>

            {/* Payment Method Breakdown */}
            <div className={`p-3 rounded-xl border space-y-1 ${
              isDark ? 'bg-slate-950/80 border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <span className={`text-[10px] font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Payment Modes Breakdown
              </span>
              <div className="flex items-center space-x-1 text-[11px] font-bold font-mono">
                <span className="text-amber-500 flex items-center space-x-0.5">
                  <Wallet className="w-3 h-3" />
                  <span>{settings.currencySymbol}{periodStats.cash.toFixed(0)}</span>
                </span>
                <span className={isDark ? "text-slate-600" : "text-slate-300"}>•</span>
                <span className="text-purple-500 flex items-center space-x-0.5">
                  <Smartphone className="w-3 h-3" />
                  <span>{settings.currencySymbol}{periodStats.upi.toFixed(0)}</span>
                </span>
                <span className={isDark ? "text-slate-600" : "text-slate-300"}>•</span>
                <span className="text-blue-500 flex items-center space-x-0.5">
                  <CreditCard className="w-3 h-3" />
                  <span>{settings.currencySymbol}{periodStats.card.toFixed(0)}</span>
                </span>
              </div>
              <span className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Cash • UPI • Card
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Account & Payment Channels Breakdown (User Request 4) */}
      <div className={`p-4 rounded-2xl border space-y-4 shadow-md ${
        isDark
          ? 'bg-slate-950 border-slate-800'
          : 'bg-gradient-to-br from-slate-50 via-white to-blue-50/30 border-slate-200'
      }`}>
        <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-600'
            }`}>
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`font-extrabold text-sm tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Accounts & Payment Channels Analytics
              </h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Sales & revenue by cashier account, cash transactions, and UPI accounts
              </p>
            </div>
          </div>

          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
            isDark ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-indigo-700 bg-indigo-50 border-indigo-200'
          }`}>
            {accountStats.length} Active Accounts • {paymentBreakdown.upiAccounts.length} UPI Receivers
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Sub-card: Sales & Revenue by Staff / Cashier Account */}
          <div className={`p-3.5 rounded-xl border space-y-3 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 ${
                isDark ? 'text-indigo-300' : 'text-indigo-700'
              }`}>
                <Users className="w-3.5 h-3.5" />
                <span>Sales by Cashier Account</span>
              </span>
              <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Total {periodStats.count} bills
              </span>
            </div>

            {accountStats.length === 0 ? (
              <p className={`text-xs py-4 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                No account transactions recorded in this period.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {accountStats.map((acc, idx) => {
                  const pct = periodStats.totalSales > 0 ? (acc.totalRevenue / periodStats.totalSales) * 100 : 0;
                  return (
                    <div
                      key={acc.cashierName + idx}
                      className={`p-2.5 rounded-lg border space-y-2 ${
                        isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDark ? 'bg-indigo-900/60 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {acc.cashierName.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <span className={`font-bold text-xs block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {acc.cashierName}
                            </span>
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {acc.orderCount} sales ({pct.toFixed(1)}% of period)
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`font-black text-sm font-mono block ${
                            isDark ? 'text-emerald-400' : 'text-emerald-600'
                          }`}>
                            {settings.currencySymbol}{acc.totalRevenue.toFixed(2)}
                          </span>
                          <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Avg: {settings.currencySymbol}{(acc.orderCount > 0 ? acc.totalRevenue / acc.orderCount : 0).toFixed(0)}
                          </span>
                        </div>
                      </div>

                      {/* Cash vs UPI sub-amounts pills */}
                      <div className="flex items-center space-x-2 pt-1 border-t border-slate-800/40 text-[10px] font-mono">
                        <span className="text-amber-500 flex items-center space-x-1">
                          <Wallet className="w-3 h-3" />
                          <span>Cash: {settings.currencySymbol}{acc.cashRevenue.toFixed(0)}</span>
                        </span>
                        <span className={isDark ? "text-slate-700" : "text-slate-300"}>•</span>
                        <span className="text-purple-400 flex items-center space-x-1">
                          <Smartphone className="w-3 h-3" />
                          <span>UPI: {settings.currencySymbol}{acc.upiRevenue.toFixed(0)}</span>
                        </span>
                        {acc.cardRevenue > 0 && (
                          <>
                            <span className={isDark ? "text-slate-700" : "text-slate-300"}>•</span>
                            <span className="text-blue-400 flex items-center space-x-1">
                              <CreditCard className="w-3 h-3" />
                              <span>Card: {settings.currencySymbol}{acc.cardRevenue.toFixed(0)}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Sub-card: Cash & UPI ID Breakdown */}
          <div className={`p-3.5 rounded-xl border space-y-3 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 ${
                isDark ? 'text-emerald-400' : 'text-emerald-700'
              }`}>
                <QrCode className="w-3.5 h-3.5" />
                <span>Cash & UPI ID Reconciliations</span>
              </span>
              <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {paymentBreakdown.cash.count + paymentBreakdown.upiTotal.count + paymentBreakdown.card.count} Transactions
              </span>
            </div>

            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
              {/* Cash Summary Card */}
              <div className={`p-2.5 rounded-lg border ${
                isDark ? 'bg-amber-950/20 border-amber-500/30' : 'bg-amber-50/50 border-amber-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-500">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className={`font-bold text-xs block ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                        Cash in Hand Payments
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {paymentBreakdown.cash.count} cash transaction{paymentBreakdown.cash.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-sm font-mono text-amber-500 block">
                      {settings.currencySymbol}{paymentBreakdown.cash.revenue.toFixed(2)}
                    </span>
                    <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {periodStats.totalSales > 0
                        ? `${((paymentBreakdown.cash.revenue / periodStats.totalSales) * 100).toFixed(1)}% of total`
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* UPI Overall Total & Per-UPI Breakdown */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 ${
                    isDark ? 'text-purple-300' : 'text-purple-700'
                  }`}>
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>UPI Received by Specific Account</span>
                  </span>
                  <span className="text-[10px] font-mono text-purple-400 font-bold">
                    {paymentBreakdown.upiTotal.count} txns • {settings.currencySymbol}{paymentBreakdown.upiTotal.revenue.toFixed(2)}
                  </span>
                </div>

                {paymentBreakdown.upiAccounts.length === 0 ? (
                  <p className={`text-xs py-3 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    No UPI transactions recorded in this period.
                  </p>
                ) : (
                  paymentBreakdown.upiAccounts.map((upiAcc, idx) => {
                    const upiPct = paymentBreakdown.upiTotal.revenue > 0
                      ? (upiAcc.totalRevenue / paymentBreakdown.upiTotal.revenue) * 100
                      : 0;
                    return (
                      <div
                        key={upiAcc.upiId + idx}
                        className={`p-2 rounded-lg border space-y-1.5 ${
                          isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <span className={`font-bold text-xs truncate block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {upiAcc.label}
                            </span>
                            <span className="text-[10px] font-mono text-purple-400 truncate block">
                              {upiAcc.upiId}
                            </span>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className={`font-black text-xs font-mono block ${
                              isDark ? 'text-purple-300' : 'text-purple-700'
                            }`}>
                              {settings.currencySymbol}{upiAcc.totalRevenue.toFixed(2)}
                            </span>
                            <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {upiAcc.orderCount} transaction{upiAcc.orderCount !== 1 ? 's' : ''} ({upiPct.toFixed(0)}%)
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar of UPI Share */}
                        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                          <div
                            className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(5, upiPct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* POS Card (if any) */}
              {paymentBreakdown.card.count > 0 && (
                <div className={`p-2 rounded-lg border flex items-center justify-between ${
                  isDark ? 'bg-blue-950/20 border-blue-500/30' : 'bg-blue-50/50 border-blue-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                    <div>
                      <span className={`font-bold text-xs block ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                        Card / POS Terminal
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {paymentBreakdown.card.count} transaction{paymentBreakdown.card.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <span className="font-black text-xs font-mono text-blue-400">
                    {settings.currencySymbol}{paymentBreakdown.card.revenue.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Most Sold Items / Top Selling Products Report */}
      <div className={`rounded-2xl border p-4 space-y-4 shadow-md ${
        isDark ? 'bg-slate-950 border-amber-500/25' : 'bg-amber-50/30 border-amber-200'
      }`}>
        <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b ${
          isDark ? 'border-slate-800' : 'border-amber-200/60'
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-xl border ${
              isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-amber-100 border-amber-300 text-amber-700'
            }`}>
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-extrabold text-sm tracking-wide flex items-center space-x-1.5 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                <span>Best Sellers & Most Sold Items Report</span>
              </h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Product sales volume, quantity rankings, and revenue generation
              </p>
            </div>
          </div>

          {/* Scope and Sort Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center border p-0.5 rounded-lg text-xs font-bold ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <button
                onClick={() => setTopItemsScope('PERIOD')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  topItemsScope === 'PERIOD'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Filtered Period
              </button>
              <button
                onClick={() => setTopItemsScope('ALL')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  topItemsScope === 'ALL'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All-Time
              </button>
            </div>

            <div className={`flex items-center border p-0.5 rounded-lg text-xs font-bold ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <button
                onClick={() => setTopItemsSortBy('QTY')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  topItemsSortBy === 'QTY'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By Quantity
              </button>
              <button
                onClick={() => setTopItemsSortBy('REVENUE')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  topItemsSortBy === 'REVENUE'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By Revenue
              </button>
            </div>

            {/* Product search filter */}
            <div className="relative">
              <input
                type="text"
                value={topItemSearch}
                onChange={(e) => setTopItemSearch(e.target.value)}
                placeholder="Search sold item..."
                className={`pl-7 pr-2.5 py-1 rounded-lg text-xs focus:outline-none focus:border-amber-400 w-36 ${
                  isDark
                    ? 'bg-slate-900 border border-slate-800 text-white placeholder-slate-500'
                    : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm'
                }`}
              />
              <Search className={`w-3.5 h-3.5 absolute left-2 top-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
          </div>
        </div>

        {/* Top 3 Best Seller Highlight Cards */}
        {topSoldProducts.length >= 3 && !topItemSearch && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1st Place Champion */}
            <div className={`p-3.5 rounded-xl border relative overflow-hidden ${
              isDark
                ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-amber-900/20 border-amber-500/40'
                : 'bg-gradient-to-br from-amber-100/70 via-white to-amber-50 border-amber-300 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`flex items-center space-x-1 px-2 py-0.5 rounded-full font-black text-xs border ${
                  isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-200 text-amber-900 border-amber-300'
                }`}>
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>#1 Top Seller</span>
                </span>
                <span className="text-[10px] text-amber-600 font-mono font-bold">
                  {topSoldProducts[0].orderCount} Orders
                </span>
              </div>
              <h4 className={`font-extrabold text-sm truncate mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {topSoldProducts[0].name}
              </h4>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-lg font-black text-amber-500 font-mono">
                  {topSoldProducts[0].totalQty} units sold
                </span>
                <span className={`text-xs font-black font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  {settings.currencySymbol}{topSoldProducts[0].totalRevenue.toFixed(2)}
                </span>
              </div>
            </div>

            {/* 2nd Place */}
            <div className={`p-3.5 rounded-xl border ${
              isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`flex items-center space-x-1 px-2 py-0.5 rounded-full font-black text-xs border ${
                  isDark ? 'bg-slate-800 text-slate-200 border-slate-600' : 'bg-slate-100 text-slate-800 border-slate-300'
                }`}>
                  <Medal className="w-3.5 h-3.5 text-slate-500" />
                  <span>#2 Best Seller</span>
                </span>
                <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {topSoldProducts[1].orderCount} Orders
                </span>
              </div>
              <h4 className={`font-extrabold text-sm truncate mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {topSoldProducts[1].name}
              </h4>
              <div className="flex items-baseline justify-between pt-1">
                <span className={`text-lg font-black font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {topSoldProducts[1].totalQty} units sold
                </span>
                <span className={`text-xs font-black font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  {settings.currencySymbol}{topSoldProducts[1].totalRevenue.toFixed(2)}
                </span>
              </div>
            </div>

            {/* 3rd Place */}
            <div className={`p-3.5 rounded-xl border ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`flex items-center space-x-1 px-2 py-0.5 rounded-full font-black text-xs border ${
                  isDark ? 'bg-orange-950/40 text-orange-300 border-orange-500/30' : 'bg-orange-100 text-orange-800 border-orange-300'
                }`}>
                  <Award className="w-3.5 h-3.5 text-orange-500" />
                  <span>#3 Best Seller</span>
                </span>
                <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {topSoldProducts[2].orderCount} Orders
                </span>
              </div>
              <h4 className={`font-extrabold text-sm truncate mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {topSoldProducts[2].name}
              </h4>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-lg font-black text-orange-500 font-mono">
                  {topSoldProducts[2].totalQty} units sold
                </span>
                <span className={`text-xs font-black font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  {settings.currencySymbol}{topSoldProducts[2].totalRevenue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Most Sold Items List & Visual Progress Bars */}
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {topSoldProducts.length === 0 ? (
            <div className="py-10 text-center text-xs space-y-1">
              <Package className={`w-8 h-8 mx-auto ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>No product sales recorded in this period.</p>
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sales data will populate here as invoices are generated.</p>
            </div>
          ) : (
            topSoldProducts.map((item, idx) => {
              const percentOfMax = Math.round((item.totalQty / maxSoldQty) * 100);
              return (
                <div
                  key={item.id + idx}
                  className={`border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                    isDark
                      ? 'bg-slate-900/90 border-slate-800/80 hover:border-amber-500/40'
                      : 'bg-white border-slate-200 hover:border-amber-400 shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* Rank Badge */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs font-mono flex-shrink-0 ${
                      idx === 0
                        ? isDark ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-amber-100 text-amber-800 border border-amber-300'
                        : idx === 1
                        ? isDark ? 'bg-slate-800 text-slate-200 border border-slate-600' : 'bg-slate-100 text-slate-700 border border-slate-300'
                        : idx === 2
                        ? isDark ? 'bg-orange-950/40 text-orange-400 border border-orange-500/40' : 'bg-orange-100 text-orange-800 border border-orange-300'
                        : isDark ? 'bg-slate-950 text-slate-400 border border-slate-800' : 'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}>
                      #{idx + 1}
                    </div>

                    {/* Product Details & Volume Bar */}
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`font-extrabold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.name}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          isDark ? 'text-slate-400 bg-slate-950 border-slate-800' : 'text-slate-600 bg-slate-100 border-slate-200'
                        }`}>
                          {item.barcode}
                        </span>
                      </div>

                      {/* Visual Sales Share Bar */}
                      <div className="flex items-center space-x-2">
                        <div className={`w-full max-w-xs h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-200'}`}>
                          <div
                            className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all"
                            style={{ width: `${percentOfMax}%` }}
                          />
                        </div>
                        <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.orderCount} bill{item.orderCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Revenue Totals */}
                  <div className={`flex items-center justify-between sm:justify-end sm:space-x-5 flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 ${
                    isDark ? 'border-slate-800/80' : 'border-slate-200'
                  }`}>
                    <div className="text-left sm:text-right">
                      <span className={`text-[10px] block uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Units Sold</span>
                      <span className="font-black text-sm text-amber-500 font-mono">
                        {item.totalQty} units
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={`text-[10px] block uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Revenue Generated</span>
                      <span className={`font-black text-sm font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        {settings.currencySymbol}{item.totalRevenue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Transaction History & Filtered Invoice Logs */}
      <div className={`flex-1 flex flex-col min-h-0 rounded-2xl border p-3 space-y-3 ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Receipt className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <h3 className={`text-xs font-extrabold uppercase tracking-wider ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}>
              Filtered Invoices ({searchFilteredInvoices.length})
            </h3>
          </div>

          <div className="relative max-w-xs w-full sm:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, customer..."
              className={`w-full pl-8 pr-2.5 py-1 rounded-lg text-xs focus:outline-none focus:border-indigo-500 ${
                isDark
                  ? 'bg-slate-900 border border-slate-800 text-white placeholder-slate-500'
                  : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm'
              }`}
            />
            <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 max-h-[360px]">
          {searchFilteredInvoices.length === 0 ? (
            <div className="py-12 text-center text-xs space-y-1">
              <Clock className={`w-8 h-8 mx-auto ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>No transactions found for the selected date range.</p>
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Try choosing a different start/end date or reset the date filter.</p>
            </div>
          ) : (
            searchFilteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className={`border rounded-xl p-3 flex items-center justify-between transition-all ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/40'
                    : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className={`font-extrabold text-xs font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{inv.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {inv.paymentMethod}
                    </span>
                    {inv.includeTax === false && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        0% Tax Free
                      </span>
                    )}
                    {inv.discountTotal > 0 && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        -{settings.currencySymbol}{inv.discountTotal.toFixed(0)}
                      </span>
                    )}
                    <span className={`text-[10px] flex items-center space-x-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Clock className="w-3 h-3 inline" />
                      <span>{new Date(inv.timestamp).toLocaleString()}</span>
                    </span>
                  </div>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {inv.items.length} items • {inv.customerName || 'Walk-in Customer'}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`font-black text-xs font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {settings.currencySymbol}{inv.grandTotal.toFixed(2)}
                  </span>

                  <button
                    onClick={() => onViewInvoice(inv)}
                    className={`p-1.5 rounded-lg transition-all border ${
                      isDark
                        ? 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border-indigo-500/30'
                        : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border-indigo-200'
                    }`}
                    title="View Receipt"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
