import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Calculator,
  Banknote,
  QrCode,
  CheckCircle,
  Copy,
  Check,
  User,
  Phone,
  FileText,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Coins,
  ArrowRight,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { Invoice, PaymentMethod, StoreSettings, ThemeMode } from '../types';
import { getNextInvoiceNumber } from '../services/dbService';
import { playSuccessChime, triggerHaptic } from '../utils/audioHaptics';
import { buildUpiPaymentUrl, generateUpiQrDataUrl, getEffectiveUpiAccounts, validateUpiId } from '../utils/upi';

interface OfflineBillingProps {
  onCompleteCheckout: (invoice: Invoice) => void;
  settings: StoreSettings;
  theme?: ThemeMode;
  cashierName: string;
}

export const OfflineBilling: React.FC<OfflineBillingProps> = ({
  onCompleteCheckout,
  settings,
  theme = 'dark',
  cashierName,
}) => {
  const isDark = theme === 'dark';

  // Amount & Note
  const [amountInput, setAmountInput] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Payment Options
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isStaticQr, setIsStaticQr] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const amount = parseFloat(amountInput) || 0;

  // UPI Accounts selector (primary + additional UPI IDs)
  const upiAccounts = useMemo(() => getEffectiveUpiAccounts(settings), [settings]);
  const [activeUpiId, setActiveUpiId] = useState<string>(() => {
    const def = upiAccounts.find((a) => a.isDefault);
    return def ? def.upiId : (settings.upiId || '');
  });

  const effectiveUpiId = activeUpiId || settings.upiId;
  const upiValidation = useMemo(() => validateUpiId(effectiveUpiId), [effectiveUpiId]);

  // UPI payment URL
  const upiPayUrl = useMemo(() => {
    return buildUpiPaymentUrl({
      upiId: effectiveUpiId,
      storeName: settings.storeName,
      amount: amount,
      note: description.trim() || 'Offline Bill Payment',
      isStatic: isStaticQr,
    });
  }, [effectiveUpiId, settings.storeName, amount, description, isStaticQr]);

  // Generate QR code whenever UPI URL changes
  useEffect(() => {
    let isMounted = true;
    if (paymentMethod === 'UPI' && effectiveUpiId) {
      generateUpiQrDataUrl(upiPayUrl).then((url) => {
        if (isMounted) setQrDataUrl(url);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [upiPayUrl, paymentMethod, effectiveUpiId]);

  // Cash calculation
  const tenderedVal = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedVal - amount);

  // Quick Amount Addition
  const handleAddAmount = (addVal: number) => {
    const curr = parseFloat(amountInput) || 0;
    setAmountInput((curr + addVal).toString());
  };

  const handleClearAmount = () => {
    setAmountInput('');
    setCashTendered('');
  };

  const handleCopyUpi = () => {
    const target = upiValidation.cleaned || effectiveUpiId;
    navigator.clipboard.writeText(target);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Quick cash options
  const quickCashOptions = [
    Math.ceil(amount),
    Math.ceil(amount / 50) * 50 || 50,
    Math.ceil(amount / 100) * 100 || 100,
    Math.ceil(amount / 500) * 500 || 500,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= amount);

  const handleCompleteOrder = async () => {
    if (amount <= 0) {
      alert('Please enter a valid bill amount greater than 0.');
      return;
    }

    if (paymentMethod === 'CASH' && cashTendered.trim() !== '' && tenderedVal < amount) {
      alert(`Cash tendered (${settings.currencySymbol}${tenderedVal}) is less than total amount (${settings.currencySymbol}${amount.toFixed(2)})`);
      return;
    }

    setIsProcessing(true);

    if (settings.enableSound) playSuccessChime();
    if (settings.enableHaptics) triggerHaptic([100, 50, 100]);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // ignore
    }

    const invoiceId = await getNextInvoiceNumber();
    const itemNote = description.trim() || 'Hand-Calculated Sale (Offline)';

    const newInvoice: Invoice = {
      id: invoiceId,
      timestamp: new Date().toISOString(),
      cashierName: cashierName || 'Store Cashier',
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      includeTax: false,
      overallDiscountType: 'PERCENT',
      overallDiscountValue: 0,
      items: [
        {
          productId: 'MANUAL_SALE',
          barcode: 'OFFLINE',
          name: itemNote,
          unitPrice: amount,
          taxRate: 0,
          quantity: 1,
          discountType: 'PERCENT',
          discountValue: 0,
          lineDiscount: 0,
          lineSubtotal: amount,
          lineTax: 0,
          lineTotal: amount,
        },
      ],
      subtotal: amount,
      taxTotal: 0,
      discountTotal: 0,
      grandTotal: amount,
      paymentMethod: paymentMethod,
      selectedUpiId: paymentMethod === 'UPI' ? effectiveUpiId : undefined,
      cashTendered: paymentMethod === 'CASH' && tenderedVal > 0 ? tenderedVal : undefined,
      changeDue: paymentMethod === 'CASH' && tenderedVal > 0 ? changeDue : undefined,
      syncStatus: 'LOCAL',
    };

    onCompleteCheckout(newInvoice);

    // Reset fields for next offline transaction
    setAmountInput('');
    setDescription('');
    setCustomerName('');
    setCustomerPhone('');
    setCashTendered('');
    setIsProcessing(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Banner / Header */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md ${
          isDark
            ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/30 text-white'
            : 'bg-gradient-to-r from-amber-50 via-white to-white border-amber-200 text-slate-900'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center space-x-2">
              <span>Offline / Hand-Calculated Billing</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Fast POS
              </span>
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              For custom totals & hand-written bundles without scanning catalog items. Directly enter the amount and generate receipts.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-center">
          <button
            type="button"
            onClick={handleClearAmount}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1 cursor-pointer ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Amount Input & Quick Keypad */}
        <div className="lg:col-span-7 space-y-4">
          <div
            className={`p-4 sm:p-5 rounded-2xl border shadow-xl space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'
            }`}
          >
            {/* Amount Box */}
            <div className="space-y-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider block ${
                isDark ? 'text-amber-400' : 'text-amber-700'
              }`}>
                Enter Total Bill Amount:
              </label>

              <div className={`relative flex items-center rounded-2xl border-2 transition-all p-3 ${
                amount > 0
                  ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5'
                  : isDark
                  ? 'border-slate-700 bg-slate-950'
                  : 'border-slate-300 bg-slate-50'
              }`}>
                <span className="text-2xl sm:text-3xl font-black text-amber-500 mr-2 font-mono">
                  {settings.currencySymbol}
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  autoFocus
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className={`w-full text-2xl sm:text-3xl font-black font-mono bg-transparent border-0 focus:outline-none tracking-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                />
                {amountInput && (
                  <button
                    type="button"
                    onClick={handleClearAmount}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Quick Increment Chips */}
            <div className="space-y-1.5">
              <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Quick Add Chips:
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {[50, 100, 200, 500, 1000, 2000].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleAddAmount(chip)}
                    className={`py-2 px-1 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer text-center ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50'
                        : 'bg-slate-50 border-slate-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400'
                    }`}
                  >
                    +{chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Description / Customer details */}
            <div className="space-y-3 pt-2 border-t border-slate-800/60">
              <div>
                <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Bill Note / Bundle Description (Optional):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Diwali Family Box, Wholesale Crackers..."
                    className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-amber-500 ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Customer Name (Optional):
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer name"
                      className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-amber-500 ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Customer Phone (Optional):
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-amber-500 ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Payment Method, UPI QR, and Checkout Action */}
        <div className="lg:col-span-5 space-y-4">
          <div
            className={`p-4 sm:p-5 rounded-2xl border shadow-xl space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'
            }`}
          >
            {/* Payment Method Switcher */}
            <div className="space-y-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider block ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Payment Mode:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-3 px-3 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                      : isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash Payment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`py-3 px-3 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    paymentMethod === 'UPI'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                      : isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>UPI / QR Scan</span>
                </button>
              </div>
            </div>

            {/* Cash Payment Details */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-400">Cash Tendered by Customer:</span>
                    <span className="text-[11px] text-emerald-400 font-mono">
                      Exact: {settings.currencySymbol}{amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-slate-400">
                      {settings.currencySymbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder={amount > 0 ? amount.toString() : '0.00'}
                      className={`w-full pl-8 pr-3 py-2 border rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-500 ${
                        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                {/* Quick Cash Suggestions */}
                {amount > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {quickCashOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setCashTendered(opt.toString())}
                        className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                          tenderedVal === opt
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                            : 'bg-white border-slate-300 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        {settings.currencySymbol}{opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Change Due Display */}
                {tenderedVal > 0 && (
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      changeDue >= 0
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                    }`}
                  >
                    <span className="font-bold">
                      {changeDue >= 0 ? 'Change to Return:' : 'Short Amount:'}
                    </span>
                    <span className="text-sm font-black font-mono">
                      {settings.currencySymbol}{Math.abs(changeDue).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* UPI QR Payment Details */}
            {paymentMethod === 'UPI' && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
                {/* Account Selector if multiple UPI IDs */}
                {upiAccounts.length > 1 && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Select UPI Account (Daily limit fallback):
                    </label>
                    <select
                      value={activeUpiId}
                      onChange={(e) => setActiveUpiId(e.target.value)}
                      className={`w-full px-2.5 py-1.5 border rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-indigo-500 ${
                        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      {upiAccounts.map((acc) => (
                        <option key={acc.id} value={acc.upiId}>
                          {acc.label} ({acc.upiId}) {acc.isDefault ? '★ Primary' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* UPI ID display & copy button */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
                  <div className="truncate mr-2">
                    <span className="text-[10px] text-slate-400 block font-sans">Active UPI ID:</span>
                    <span className="text-indigo-400 font-bold">{effectiveUpiId || 'No UPI ID Set'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all shrink-0 cursor-pointer"
                    title="Copy UPI ID"
                  >
                    {copiedUpi ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* QR Code Container */}
                <div className="bg-white p-3 rounded-2xl flex flex-col items-center justify-center shadow-lg border border-slate-200">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="UPI QR Code"
                      className="w-44 h-44 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">
                      Generating QR...
                    </div>
                  )}
                  <p className="text-[11px] font-black text-slate-900 mt-2 font-mono">
                    Scan to Pay: {settings.currencySymbol}{amount.toFixed(2)}
                  </p>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">
                    GPay • PhonePe • Paytm • BHIM
                  </p>
                </div>

                {/* Static vs Dynamic toggle */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">QR Amount Mode:</span>
                  <button
                    type="button"
                    onClick={() => setIsStaticQr(!isStaticQr)}
                    className="text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
                  >
                    {isStaticQr ? 'Switch to Exact Amount QR' : 'Switch to Open Amount QR'}
                  </button>
                </div>
              </div>
            )}

            {/* Total Summary Card */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              isDark ? 'bg-amber-950/20 border-amber-500/30' : 'bg-amber-50 border-amber-200'
            }`}>
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                  isDark ? 'text-amber-400' : 'text-amber-700'
                }`}>
                  Grand Total to Charge:
                </span>
                <span className="text-xl font-black font-mono text-amber-500">
                  {settings.currencySymbol}{amount.toFixed(2)}
                </span>
              </div>
              <div className="text-right text-[11px]">
                <span className="text-slate-400 block">Cashier:</span>
                <span className="font-bold text-slate-300">{cashierName}</span>
              </div>
            </div>

            {/* Complete Button */}
            <button
              type="button"
              onClick={handleCompleteOrder}
              disabled={amount <= 0 || isProcessing}
              className={`w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                amount > 0 && !isProcessing
                  ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-slate-950 shadow-amber-500/25'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{isProcessing ? 'Recording Transaction...' : 'Complete Order & Print Bill'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

