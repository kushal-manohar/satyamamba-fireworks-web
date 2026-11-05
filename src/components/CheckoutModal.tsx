import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Banknote,
  QrCode,
  CreditCard,
  X,
  CheckCircle,
  Calculator,
  User,
  Phone,
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { CartItem, PaymentMethod, Invoice, StoreSettings, DiscountType } from '../types';
import { getNextInvoiceNumber } from '../services/dbService';
import { playSuccessChime, triggerHaptic } from '../utils/audioHaptics';
import { validateUpiId, buildUpiPaymentUrl, generateUpiQrDataUrl, getEffectiveUpiAccounts } from '../utils/upi';

interface CheckoutModalProps {
  cart: CartItem[];
  includeTax: boolean;
  overallDiscountType?: DiscountType;
  overallDiscountValue?: number;
  overallDiscountAmount?: number;
  overallDiscountPercent?: number;
  onClose: () => void;
  onCompleteCheckout: (invoice: Invoice) => void;
  settings: StoreSettings;
  cashierName: string;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  cart,
  includeTax,
  overallDiscountType = 'PERCENT',
  overallDiscountValue = 0,
  overallDiscountAmount,
  overallDiscountPercent = 0,
  onClose,
  onCompleteCheckout,
  settings,
  cashierName,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isStaticQr, setIsStaticQr] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // Line items and tax calculations
  const itemsBreakdown = useMemo(() => {
    return cart.map((item) => {
      const lineBase = item.product.price * item.quantity;
      const lineDiscAmount = item.discountType === 'FLAT'
        ? Math.min(item.discountValue || 0, lineBase)
        : (lineBase * (item.discountPercent || item.discountValue || 0)) / 100;
      const lineDiscPercent = lineBase > 0 ? (lineDiscAmount / lineBase) * 100 : 0;
      const lineSub = Math.max(0, lineBase - lineDiscAmount);
      const effectiveTaxRate = includeTax ? (item.product.taxRate ?? 0) : 0;
      const lineTax = includeTax ? (lineSub * (effectiveTaxRate / 100)) : 0;
      return {
        ...item,
        lineBase,
        lineDiscAmount,
        lineDiscPercent,
        lineSub,
        effectiveTaxRate,
        lineTax,
        lineTotal: lineSub + lineTax,
      };
    });
  }, [cart, includeTax]);

  const rawSubtotal = itemsBreakdown.reduce((acc, i) => acc + i.lineSub, 0);
  const totalTax = includeTax ? itemsBreakdown.reduce((acc, i) => acc + i.lineTax, 0) : 0;

  const resolvedDiscountType: DiscountType = overallDiscountType || 'PERCENT';
  const resolvedDiscountValue = overallDiscountValue !== undefined 
    ? overallDiscountValue 
    : (overallDiscountPercent || 0);

  const calcOverallDiscountAmount = overallDiscountAmount !== undefined
    ? overallDiscountAmount
    : resolvedDiscountType === 'FLAT'
      ? Math.min(resolvedDiscountValue, rawSubtotal)
      : (rawSubtotal * resolvedDiscountValue) / 100;

  const grandTotal = Math.max(0, rawSubtotal + totalTax - calcOverallDiscountAmount);

  const tenderedVal = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedVal - grandTotal);

  const quickCashOptions = [
    Math.ceil(grandTotal),
    Math.ceil(grandTotal / 50) * 50 || 50,
    Math.ceil(grandTotal / 100) * 100 || 100,
    Math.ceil(grandTotal / 500) * 500 || 500,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= grandTotal);

  // Multiple UPI Accounts selection
  const upiAccounts = useMemo(() => getEffectiveUpiAccounts(settings), [settings]);
  const [activeUpiId, setActiveUpiId] = useState<string>(() => {
    const def = upiAccounts.find((a) => a.isDefault);
    return def ? def.upiId : (settings.upiId || '');
  });

  const effectiveUpiId = activeUpiId || settings.upiId;

  // UPI Validation and URL Construction
  const upiValidation = useMemo(() => validateUpiId(effectiveUpiId), [effectiveUpiId]);

  const upiPayUrl = useMemo(() => {
    return buildUpiPaymentUrl({
      upiId: effectiveUpiId,
      storeName: settings.storeName,
      amount: grandTotal,
      note: 'Store Bill Payment',
      isStatic: isStaticQr,
    });
  }, [effectiveUpiId, settings.storeName, grandTotal, isStaticQr]);

  // Generate crisp local offline QR code whenever URL changes
  useEffect(() => {
    let isMounted = true;
    generateUpiQrDataUrl(upiPayUrl).then((url) => {
      if (isMounted) {
        setQrDataUrl(url);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [upiPayUrl]);

  const handleCopyUpi = () => {
    const targetUpi = upiValidation.cleaned || effectiveUpiId;
    navigator.clipboard.writeText(targetUpi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleFinishCheckout = async () => {
    if (paymentMethod === 'CASH' && tenderedVal < grandTotal) {
      alert(`Cash tendered (${settings.currencySymbol}${tenderedVal}) is less than total amount (${settings.currencySymbol}${grandTotal.toFixed(2)})`);
      return;
    }

    setIsProcessing(true);

    if (settings.enableSound) playSuccessChime();
    if (settings.enableHaptics) triggerHaptic([100, 50, 100]);

    // Confetti celebration
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
    const newInvoice: Invoice = {
      id: invoiceId,
      timestamp: new Date().toISOString(),
      cashierName: cashierName || 'Store Cashier',
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      includeTax: includeTax,
      overallDiscountType: resolvedDiscountType,
      overallDiscountValue: resolvedDiscountValue,
      items: itemsBreakdown.map(i => ({
        productId: i.product.id,
        barcode: i.product.barcode,
        name: i.product.name,
        unitPrice: i.product.price,
        taxRate: i.effectiveTaxRate,
        quantity: i.quantity,
        discountType: i.discountType || 'PERCENT',
        discountValue: i.discountValue !== undefined ? i.discountValue : i.discountPercent,
        lineDiscount: i.lineDiscPercent,
        lineSubtotal: i.lineSub,
        lineTax: i.lineTax,
        lineTotal: i.lineTotal,
      })),
      subtotal: rawSubtotal,
      taxTotal: totalTax,
      discountTotal: calcOverallDiscountAmount,
      grandTotal: grandTotal,
      paymentMethod: paymentMethod,
      selectedUpiId: paymentMethod === 'UPI' ? effectiveUpiId : undefined,
      cashTendered: paymentMethod === 'CASH' ? tenderedVal : undefined,
      changeDue: paymentMethod === 'CASH' ? changeDue : undefined,
      syncStatus: 'LOCAL',
    };

    setTimeout(() => {
      onCompleteCheckout(newInvoice);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-scaleUp">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-extrabold text-base text-white">Checkout & Payment</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Customer Details optional card */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Customer Details (Optional)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <User className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
              <div className="relative">
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone (for WhatsApp receipt)"
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Payment Method Selector Tabs */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Select Payment Method</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={`py-3 px-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Banknote className="w-5 h-5 text-emerald-400" />
                <span>Cash</span>
              </button>

              <button
                onClick={() => setPaymentMethod('UPI')}
                className={`py-3 px-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  paymentMethod === 'UPI'
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <QrCode className="w-5 h-5 text-indigo-400" />
                <span>UPI / QR</span>
              </button>

              <button
                onClick={() => setPaymentMethod('CARD')}
                className={`py-3 px-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  paymentMethod === 'CARD'
                    ? 'bg-purple-600/20 text-purple-300 border-purple-500 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <CreditCard className="w-5 h-5 text-purple-400" />
                <span>Card / POS</span>
              </button>
            </div>
          </div>

          {/* Cash Calculator Panel */}
          {paymentMethod === 'CASH' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                  <Calculator className="w-4 h-4 text-emerald-400" />
                  <span>Cash Tendered Calculator</span>
                </span>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Enter Cash Received from Customer</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">{settings.currencySymbol}</span>
                  <input
                    type="number"
                    step="1"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={grandTotal.toFixed(0)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-lg font-extrabold text-white focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-1.5">
                {quickCashOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setCashTendered(opt.toString())}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 rounded-lg text-xs font-bold transition-all"
                  >
                    {settings.currencySymbol}{opt}
                  </button>
                ))}
              </div>

              {/* Change Due Display */}
              <div className="p-3 bg-emerald-950/50 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-400 block">CHANGE DUE TO CUSTOMER</span>
                  <span className="text-xs text-slate-400">Return to customer</span>
                </div>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {settings.currencySymbol}{changeDue.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* UPI QR Display Panel */}
          {paymentMethod === 'UPI' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center space-y-3">
              {/* Select Active Receiving UPI Account */}
              {upiAccounts.length > 0 && (
                <div className="text-left bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300">
                      Receiving UPI Account (Switch if limit reached):
                    </label>
                    <span className="text-[10px] text-indigo-400 font-bold">
                      {upiAccounts.length} saved
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {upiAccounts.map((acc) => {
                      const isSelected = effectiveUpiId === acc.upiId;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setActiveUpiId(acc.upiId)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition flex items-center space-x-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          <span>{acc.label}</span>
                          <span className="text-[10px] font-mono opacity-80">({acc.upiId})</span>
                          {isSelected && <span className="text-emerald-300 font-bold">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Validation Warning Alert if UPI ID is invalid */}
              {!upiValidation.isValid ? (
                <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl p-3 text-left space-y-1.5">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Invalid UPI ID Configuration</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    The configured UPI ID (<span className="font-mono font-bold text-white">"{settings.upiId || 'empty'}"</span>) is invalid.
                    UPI IDs must include an <span className="font-bold text-white">@</span> and bank handle (e.g. <span className="font-mono text-amber-300">9876543210@paytm</span>, <span className="font-mono text-amber-300">store@okhdfcbank</span>, or <span className="font-mono text-amber-300">merchant@ybl</span>).
                  </p>
                  <p className="text-[10px] text-amber-400/80">
                    Please go to ⚙️ Settings tab &gt; Store Profile &gt; UPI VPA Address to correct it.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-1.5 text-xs text-indigo-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Scan using PhonePe / Google Pay / Paytm / BHIM</span>
                </div>
              )}

              {/* QR Code Container */}
              <div className="p-3 bg-white rounded-2xl inline-block shadow-xl transition-all">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="NPCI UPI QR Code"
                    className="w-44 h-44 mx-auto object-contain"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-slate-500 text-xs">
                    Generating QR...
                  </div>
                )}
              </div>

              {/* Mode Toggle: Fixed Amount vs Open Amount */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsStaticQr(false)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                    !isStaticQr
                      ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  ⚡ Fixed {settings.currencySymbol}{grandTotal.toFixed(2)}
                </button>
                <button
                  type="button"
                  onClick={() => setIsStaticQr(true)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                    isStaticQr
                      ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  title="Use if customer bank fails with dynamic amount QRs"
                >
                  Open Amount QR
                </button>
              </div>

              {/* Payee Info & Copy UPI ID Button */}
              <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 flex flex-col items-center space-y-1.5 text-xs">
                <div className="flex items-center justify-between w-full px-2">
                  <span className="text-slate-400 text-[11px]">Payee VPA:</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-white font-mono font-bold text-xs">
                      {upiValidation.cleaned || settings.upiId}
                    </span>
                    <button
                      onClick={handleCopyUpi}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between w-full px-2 border-t border-slate-800/60 pt-1">
                  <span className="text-slate-400 text-[11px]">Payable Amount:</span>
                  <span className="text-emerald-400 font-bold font-mono text-sm">
                    {settings.currencySymbol}{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Direct Open in UPI App button (for mobile browser) */}
              <div className="pt-1">
                <a
                  href={upiPayUrl}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-xl border border-indigo-500/30 transition-all"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Open in UPI App (GPay/PhonePe)</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>
          )}

          {/* Card / External POS confirmation */}
          {paymentMethod === 'CARD' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center space-y-2">
              <CreditCard className="w-10 h-10 text-purple-400 mx-auto animate-bounce" />
              <p className="text-xs font-bold text-slate-200">External POS Terminal Confirmation</p>
              <p className="text-[11px] text-slate-400">Swipe or dip customer card on the terminal for {settings.currencySymbol}{grandTotal.toFixed(2)} and tap complete.</p>
            </div>
          )}

          {/* Bill Summary Breakdown */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Items Subtotal:</span>
              <span className="font-mono text-slate-200">{settings.currencySymbol}{rawSubtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <span>Tax (GST):</span>
                {includeTax ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-bold">Included</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">0% Tax Free</span>
                )}
              </span>
              <span className={`font-mono ${includeTax ? 'text-slate-200' : 'text-emerald-400 font-bold'}`}>
                {includeTax ? `${settings.currencySymbol}${totalTax.toFixed(2)}` : '₹0.00 (Exempt)'}
              </span>
            </div>

            {calcOverallDiscountAmount > 0 && (
              <div className="flex justify-between items-center text-xs text-rose-400">
                <span className="flex items-center space-x-1">
                  <span>Bill Discount:</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 font-bold">
                    {resolvedDiscountType === 'FLAT' ? `${settings.currencySymbol}${resolvedDiscountValue}` : `${resolvedDiscountValue}%`}
                  </span>
                </span>
                <span className="font-mono font-bold">-{settings.currencySymbol}{calcOverallDiscountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">Total Payable Amount:</span>
              <span className="text-xl font-black text-emerald-400 font-mono">
                {settings.currencySymbol}{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <button
            onClick={handleFinishCheckout}
            disabled={isProcessing}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-black text-base rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <CheckCircle className="w-5 h-5" />
            <span>{isProcessing ? 'Generating Invoice...' : `Complete Bill (${settings.currencySymbol}${grandTotal.toFixed(2)})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
