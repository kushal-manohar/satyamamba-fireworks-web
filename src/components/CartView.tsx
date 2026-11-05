import React, { useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Tag,
  Percent,
  ArrowRight,
  Sparkles,
  X,
  Check,
  ShieldCheck,
  ShieldAlert,
  Coins
} from 'lucide-react';
import { CartItem, StoreSettings, ThemeMode, DiscountType } from '../types';

export interface CheckoutDetails {
  includeTax: boolean;
  overallDiscountType: DiscountType;
  overallDiscountValue: number;
  overallDiscountAmount: number;
}

interface CartViewProps {
  cart: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onApplyLineDiscount: (productId: string, discountType: DiscountType, discountValue: number) => void;
  onClearCart: () => void;
  onProceedToCheckout: (details: CheckoutDetails) => void;
  settings: StoreSettings;
  theme?: ThemeMode;
}

export const CartView: React.FC<CartViewProps> = ({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onApplyLineDiscount,
  onClearCart,
  onProceedToCheckout,
  settings,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  // Tax Option: Include or Exclude Tax from the bill (Default: Tax Free 0%)
  const [includeTax, setIncludeTax] = useState<boolean>(settings.defaultIncludeTax ?? false);

  // Overall Bill Discount State: Switch between % and ₹
  const [overallDiscountMode, setOverallDiscountMode] = useState<DiscountType>('PERCENT');
  const [overallDiscountVal, setOverallDiscountVal] = useState<number>(0);
  const [customOverallDiscountInput, setCustomOverallDiscountInput] = useState<string>('');

  // Per-Item Discount Editing State
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [editingLineMode, setEditingLineMode] = useState<DiscountType>('PERCENT');
  const [tempDiscountVal, setTempDiscountVal] = useState<string>('');

  // Calculations
  const rawSubtotal = cart.reduce((acc, item) => {
    return acc + (item.product.price * item.quantity);
  }, 0);

  const totalLineDiscounts = cart.reduce((acc, item) => {
    return acc + (item.discountAmount || 0);
  }, 0);

  const subtotalAfterLineDiscounts = Math.max(0, rawSubtotal - totalLineDiscounts);

  // Tax Calculation: only applied if includeTax is true
  const totalTax = includeTax
    ? cart.reduce((acc, item) => {
        const itemNet = Math.max(0, (item.product.price * item.quantity) - (item.discountAmount || 0));
        return acc + (itemNet * (item.product.taxRate / 100));
      }, 0)
    : 0;

  // Overall Discount Calculation
  let overallDiscountAmount = 0;
  if (overallDiscountMode === 'PERCENT') {
    overallDiscountAmount = (subtotalAfterLineDiscounts * overallDiscountVal) / 100;
  } else {
    overallDiscountAmount = Math.min(overallDiscountVal, subtotalAfterLineDiscounts);
  }

  const totalDiscounts = totalLineDiscounts + overallDiscountAmount;
  const grandTotal = Math.max(0, subtotalAfterLineDiscounts + totalTax - overallDiscountAmount);

  // Apply Line Discount Helper
  const handleSaveLineDiscount = (productId: string) => {
    const val = parseFloat(tempDiscountVal) || 0;
    onApplyLineDiscount(productId, editingLineMode, val);
    setEditingDiscountId(null);
  };

  return (
    <div
      className={`border rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full transition-colors duration-200 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'
      }`}
    >
      {/* Cart Header */}
      <div
        className={`p-3.5 border-b flex items-center justify-between transition-colors ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center space-x-2">
          <ShoppingCart className="w-5 h-5 text-indigo-500" />
          <span className={`font-extrabold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Active Order Cart
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-500 border border-indigo-500/30">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} items
          </span>
        </div>
        {cart.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-xs text-rose-500 hover:text-rose-600 font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Cart</span>
          </button>
        )}
      </div>

      {/* NEW FEATURE: Tax Include/Exclude Header Bar */}
      <div
        className={`px-3 py-2 border-b flex items-center justify-between text-xs transition-colors ${
          isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-100/70 border-slate-200'
        }`}
      >
        <div className="flex items-center space-x-2">
          {includeTax ? (
            <span className="inline-flex items-center text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-indigo-400" />
              Tax Included in Bill (GST)
            </span>
          ) : (
            <span className="inline-flex items-center text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <ShieldAlert className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              Tax Excluded from Bill (0% Free)
            </span>
          )}
        </div>

        {/* Tax Toggle Button */}
        <button
          type="button"
          onClick={() => setIncludeTax(!includeTax)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center space-x-1 ${
            includeTax
              ? isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-xs'
              : 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
          }`}
          title="Toggle Tax Calculation on this bill"
        >
          <span>{includeTax ? 'Switch to Tax-Free' : 'Enable Standard Tax'}</span>
        </button>
      </div>

      {/* Cart Item List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[380px] scrollbar-thin">
        {cart.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30 text-indigo-400" />
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Cart is empty
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Scan a product barcode or tap product chips to add items.
            </p>
          </div>
        ) : (
          cart.map((item) => {
            const unitPrice = item.product.price;
            const lineBase = unitPrice * item.quantity;
            const lineDisc = item.discountAmount || 0;
            const lineNet = Math.max(0, lineBase - lineDisc);
            const lineTax = includeTax ? (lineNet * (item.product.taxRate / 100)) : 0;
            const lineTotal = lineNet + lineTax;

            return (
              <div
                key={item.product.id}
                className={`border rounded-xl p-3 transition-all flex flex-col space-y-2 shadow-sm ${
                  isDark
                    ? 'bg-slate-950/90 border-slate-800/80 hover:border-indigo-500/40 text-white'
                    : 'bg-slate-50/90 border-slate-200 hover:border-indigo-400 text-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <h4 className={`text-xs font-bold leading-snug ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {item.product.name}
                    </h4>
                    <div className="flex items-center flex-wrap gap-1.5 mt-1">
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          isDark
                            ? 'text-slate-400 bg-slate-900 border-slate-800'
                            : 'text-slate-600 bg-white border-slate-200'
                        }`}
                      >
                        {item.product.barcode}
                      </span>
                      <span className="text-[10px] text-indigo-500 font-medium">
                        Tax: {includeTax ? `${item.product.taxRate}%` : '0% (Exempt)'}
                      </span>

                      {/* Display line discount badge in % or ₹ */}
                      {item.discountAmount > 0 && (
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                          {item.discountType === 'FLAT'
                            ? `${settings.currencySymbol}${item.discountValue} OFF`
                            : `${item.discountPercent}% OFF`}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveItem(item.product.id)}
                    className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Quantity Controls & Price Breakdown */}
                <div
                  className={`flex items-center justify-between pt-1 border-t ${
                    isDark ? 'border-slate-800/60' : 'border-slate-200'
                  }`}
                >
                  <div
                    className={`flex items-center space-x-1 border rounded-lg p-0.5 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                    }`}
                  >
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span
                      className={`w-8 text-center text-xs font-extrabold ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Discount: Switch between % and ₹ */}
                  {editingDiscountId === item.product.id ? (
                    <div className="flex items-center space-x-1">
                      {/* Mini Switch between % and Currency Symbol */}
                      <div className="flex items-center border border-amber-500/40 rounded bg-slate-900 p-0.5">
                        <button
                          type="button"
                          onClick={() => setEditingLineMode('PERCENT')}
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            editingLineMode === 'PERCENT'
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLineMode('FLAT')}
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            editingLineMode === 'FLAT'
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {settings.currencySymbol}
                        </button>
                      </div>

                      <input
                        type="number"
                        min="0"
                        step={editingLineMode === 'PERCENT' ? '1' : '0.5'}
                        value={tempDiscountVal}
                        onChange={(e) => setTempDiscountVal(e.target.value)}
                        placeholder={editingLineMode === 'PERCENT' ? '%' : settings.currencySymbol}
                        className={`w-14 px-1.5 py-0.5 border border-amber-500 rounded text-xs text-center font-mono focus:outline-none ${
                          isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                        }`}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveLineDiscount(item.product.id)}
                        className="p-1 bg-amber-500 text-slate-950 rounded hover:bg-amber-400 cursor-pointer"
                        title="Apply line discount"
                      >
                        <Check className="w-3 h-3 font-bold" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDiscountId(item.product.id);
                        setEditingLineMode(item.discountType || 'PERCENT');
                        setTempDiscountVal(
                          (item.discountType === 'FLAT' ? item.discountValue : item.discountPercent)?.toString() || ''
                        );
                      }}
                      className="text-[11px] text-amber-500 hover:underline flex items-center space-x-1 font-medium cursor-pointer"
                    >
                      <Tag className="w-3 h-3" />
                      <span>
                        {item.discountAmount > 0
                          ? item.discountType === 'FLAT'
                            ? `Disc: ${settings.currencySymbol}${item.discountValue}`
                            : `Disc: ${item.discountPercent}%`
                          : '+ Add Disc'}
                      </span>
                    </button>
                  )}

                  {/* Item Total Amount */}
                  <div className="text-right">
                    <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {settings.currencySymbol}{lineTotal.toFixed(2)}
                    </span>
                    {item.quantity > 1 && (
                      <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        @{settings.currencySymbol}{unitPrice.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bill Calculation & Checkout Footer */}
      {cart.length > 0 && (
        <div
          className={`p-3.5 border-t space-y-3 transition-colors ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {/* NEW FEATURE: Switch between Percentage (%) and Rupees (₹) for Overall Bill Discount */}
          <div
            className={`p-2.5 rounded-xl border space-y-2 ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold flex items-center space-x-1.5 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                <Percent className="w-3.5 h-3.5 text-amber-500" />
                <span>Overall Bill Discount:</span>
              </span>

              {/* Mode Toggle Tab: % Percentage vs ₹ Rupees */}
              <div className="flex items-center border border-amber-500/30 rounded-lg p-0.5 bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setOverallDiscountMode('PERCENT');
                    setOverallDiscountVal(0);
                    setCustomOverallDiscountInput('');
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    overallDiscountMode === 'PERCENT'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  % Percentage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOverallDiscountMode('FLAT');
                    setOverallDiscountVal(0);
                    setCustomOverallDiscountInput('');
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    overallDiscountMode === 'FLAT'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {settings.currencySymbol} Rupees (Flat)
                </button>
              </div>
            </div>

            {/* Quick Chips & Custom Input */}
            <div className="flex items-center space-x-1.5 pt-0.5 overflow-x-auto pb-0.5">
              {overallDiscountMode === 'PERCENT' ? (
                // Percentage Preset Chips
                [0, 5, 10, 15, 20].map((disc) => (
                  <button
                    key={disc}
                    type="button"
                    onClick={() => {
                      setOverallDiscountVal(disc);
                      setCustomOverallDiscountInput(disc > 0 ? disc.toString() : '');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      overallDiscountVal === disc && customOverallDiscountInput === (disc > 0 ? disc.toString() : '')
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                        : isDark
                        ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {disc}%
                  </button>
                ))
              ) : (
                // Flat Rupees Preset Chips
                [0, 50, 100, 200, 500].map((flatVal) => (
                  <button
                    key={flatVal}
                    type="button"
                    onClick={() => {
                      setOverallDiscountVal(flatVal);
                      setCustomOverallDiscountInput(flatVal > 0 ? flatVal.toString() : '');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      overallDiscountVal === flatVal && customOverallDiscountInput === (flatVal > 0 ? flatVal.toString() : '')
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                        : isDark
                        ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {settings.currencySymbol}{flatVal}
                  </button>
                ))
              )}

              {/* Custom Input for any arbitrary % or ₹ */}
              <div className="flex items-center space-x-1 pl-1">
                <input
                  type="number"
                  min="0"
                  step={overallDiscountMode === 'PERCENT' ? '1' : '10'}
                  placeholder={overallDiscountMode === 'PERCENT' ? 'Custom %' : `Custom ${settings.currencySymbol}`}
                  value={customOverallDiscountInput}
                  onChange={(e) => {
                    const text = e.target.value;
                    setCustomOverallDiscountInput(text);
                    const val = parseFloat(text) || 0;
                    setOverallDiscountVal(val);
                  }}
                  className={`w-20 px-2 py-1 rounded-lg text-[10px] font-bold border text-center font-mono focus:outline-none focus:border-amber-500 ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Breakdown Totals */}
          <div className="space-y-1.5 text-xs">
            <div className={`flex justify-between ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>Subtotal:</span>
              <span className={`font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {settings.currencySymbol}{rawSubtotal.toFixed(2)}
              </span>
            </div>

            {/* Total Line Discounts if any */}
            {totalLineDiscounts > 0 && (
              <div className="flex justify-between text-amber-500 font-semibold">
                <span>Product Discounts:</span>
                <span className="font-mono">-{settings.currencySymbol}{totalLineDiscounts.toFixed(2)}</span>
              </div>
            )}

            {/* Overall Bill Discount */}
            {overallDiscountAmount > 0 && (
              <div className="flex justify-between text-amber-500 font-semibold">
                <span>
                  Bill Discount (
                  {overallDiscountMode === 'PERCENT'
                    ? `${overallDiscountVal}%`
                    : `${settings.currencySymbol}${overallDiscountVal}`}
                  ):
                </span>
                <span className="font-mono">-{settings.currencySymbol}{overallDiscountAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Tax Total (or Excluded) */}
            <div className={`flex justify-between ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <div className="flex items-center space-x-1.5">
                <span>Tax (GST/VAT):</span>
                {!includeTax && (
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1 rounded">
                    Tax Excluded
                  </span>
                )}
              </div>
              <span className={`font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {includeTax ? `${settings.currencySymbol}${totalTax.toFixed(2)}` : `${settings.currencySymbol}0.00`}
              </span>
            </div>

            {/* Grand Total */}
            <div
              className={`pt-2 border-t flex justify-between items-baseline ${
                isDark ? 'border-slate-800 text-white' : 'border-slate-200 text-slate-900'
              }`}
            >
              <span className="font-extrabold text-sm">Grand Total:</span>
              <span className="font-black text-lg text-emerald-500 font-mono">
                {settings.currencySymbol}{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            type="button"
            onClick={() =>
              onProceedToCheckout({
                includeTax,
                overallDiscountType: overallDiscountMode,
                overallDiscountValue: overallDiscountVal,
                overallDiscountAmount,
              })
            }
            className="w-full py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 fill-white/20" />
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
