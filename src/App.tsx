import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BarcodeScanner } from './components/BarcodeScanner';
import { CartView, CheckoutDetails } from './components/CartView';
import { CheckoutModal } from './components/CheckoutModal';
import { ReceiptViewModal } from './components/ReceiptViewModal';
import { InventoryManager } from './components/InventoryManager';
import { SalesReports } from './components/SalesReports';
import { SettingsModal } from './components/SettingsModal';
import { LoginPage } from './components/LoginPage';
import { OfflineBilling } from './components/OfflineBilling';
import { Product, CartItem, Invoice, StoreSettings, Role, ThemeMode, UserSession, DiscountType } from './types';
import {
  getProducts,
  saveProducts,
  getInvoices,
  getSettings,
  getThemePreference,
  saveThemePreference,
  getUserSession,
  saveUserSession,
  clearUserSession,
  purgeOldSampleData
} from './utils/storage';
import {
  fetchProducts,
  saveProductRecord,
  deleteProductRecord,
  fetchInvoices,
  recordInvoice,
  fetchStoreSettings,
  saveStoreSettings,
  syncOfflineInvoices,
  subscribeToRealtimeChanges
} from './services/dbService';

export const App: React.FC = () => {
  // Theme Preference
  const [theme, setTheme] = useState<ThemeMode>(getThemePreference());

  // Active User Authentication Session
  const [session, setSession] = useState<UserSession | null>(getUserSession());

  // App Navigation Tabs
  const [activeTab, setActiveTab] = useState<'billing' | 'offline' | 'inventory' | 'reports' | 'settings'>('billing');
  const [billingSubTab, setBillingSubTab] = useState<'search' | 'barcode' | 'cart'>('search');
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(getSettings());

  // Active Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Modals & Checkout Config
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutDetails>({
    includeTax: false, // Default Tax Free!
    overallDiscountType: 'PERCENT',
    overallDiscountValue: 0,
    overallDiscountAmount: 0,
  });
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Sync theme with document.body class
  useEffect(() => {
    document.body.className = theme === 'dark' ? 'theme-dark' : 'theme-light';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Load initial dataset and subscribe to Supabase Realtime updates
  useEffect(() => {
    // 0. Purge any legacy sample data
    purgeOldSampleData();

    // 1. Immediate local render for instant startup
    setProducts(getProducts());
    setInvoices(getInvoices());

    // 2. Fetch latest from database & sync pending offline invoices
    const syncDb = async () => {
      try {
        const cloudSettings = await fetchStoreSettings();
        setSettings(cloudSettings);
        const cloudProducts = await fetchProducts();
        setProducts(cloudProducts);
        const cloudInvoices = await fetchInvoices();
        setInvoices(cloudInvoices);
        await syncOfflineInvoices();
      } catch (err) {
        console.warn('Initial database sync error:', err);
      }
    };
    syncDb();

    // 3. True Realtime subscription across all billing terminals
    const unsubscribe = subscribeToRealtimeChanges({
      onProductsUpdate: async () => {
        const p = await fetchProducts();
        setProducts(p);
      },
      onInvoicesUpdate: async () => {
        const invs = await fetchInvoices();
        setInvoices(invs);
      },
      onSettingsUpdate: async () => {
        const s = await fetchStoreSettings();
        setSettings(s);
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Theme toggle handler
  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      saveThemePreference(next);
      return next;
    });
  };

  // Auth handlers
  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    saveUserSession(newSession);
    // If employee logs in, automatically land on billing counter
    setActiveTab('billing');
  };

  const handleLogout = () => {
    clearUserSession();
    setSession(null);
    setActiveTab('billing');
  };

  // Barcode detection handler with quantity support
  const handleScanSuccess = (scannedBarcode: string, quantity: number = 1) => {
    const qtyToAdd = Math.max(1, quantity);
    const foundProduct = products.find(p => p.barcode === scannedBarcode);

    if (foundProduct) {
      setCart(prevCart => {
        const existingIdx = prevCart.findIndex(item => item.product.id === foundProduct.id);
        if (existingIdx > -1) {
          const updated = [...prevCart];
          updated[existingIdx].quantity += qtyToAdd;
          return updated;
        } else {
          return [
            ...prevCart,
            {
              product: foundProduct,
              quantity: qtyToAdd,
              discountType: 'PERCENT',
              discountValue: 0,
              discountPercent: 0,
              discountAmount: 0,
            }
          ];
        }
      });
    } else {
      // Unmapped product scanned!
      if (session?.role === 'ADMIN') {
        if (confirm(`Unrecognized barcode scanned: "${scannedBarcode}". Would you like to map it to a new product now?`)) {
          setActiveTab('inventory');
        }
      } else {
        alert(`Unrecognized barcode "${scannedBarcode}". Contact store admin to register this item in Catalog.`);
      }
    }
  };

  // Cart quantity update
  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveCartItem(productId);
      return;
    }
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity } : item));
  };

  // Cart item remove
  const handleRemoveCartItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Line discount (supports % and Flat Rupees)
  const handleApplyLineDiscount = (productId: string, type: DiscountType, value: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id !== productId) return item;
      const basePrice = item.product.price * item.quantity;
      const flatAmount = type === 'FLAT' 
        ? Math.min(value, basePrice)
        : (basePrice * value) / 100;
      const percent = basePrice > 0 ? (flatAmount / basePrice) * 100 : 0;
      return {
        ...item,
        discountType: type,
        discountValue: value,
        discountPercent: percent,
        discountAmount: flatAmount,
      };
    }));
  };

  // Proceed to Checkout
  const handleProceedToCheckout = (details: CheckoutDetails) => {
    setCheckoutConfig(details);
    setIsCheckoutOpen(true);
  };

  // Checkout complete callback
  const handleCompleteCheckout = async (newInvoice: Invoice) => {
    // 1. Record invoice in database and local storage
    const saved = await recordInvoice(newInvoice);
    setInvoices(prev => [saved, ...prev.filter(i => i.id !== saved.id)]);

    // 2. Deduct inventory stock locally and in cloud
    const updatedProducts = products.map(p => {
      const cartMatch = newInvoice.items.find(i => i.productId === p.id);
      if (cartMatch) {
        const nextProd = { ...p, stock: Math.max(0, p.stock - cartMatch.quantity) };
        saveProductRecord(nextProd);
        return nextProd;
      }
      return p;
    });
    setProducts(updatedProducts);

    // Clear cart, reset bill discounts, and show receipt view modal
    setCart([]);
    setCheckoutConfig({
      includeTax: settings.defaultIncludeTax ?? false,
      overallDiscountType: 'PERCENT',
      overallDiscountValue: 0,
      overallDiscountAmount: 0,
    });
    setIsCheckoutOpen(false);
    setViewingInvoice(saved);
  };

  // Inventory Save
  const handleSaveProduct = async (updatedProduct: Product) => {
    const exists = products.some(p => p.id === updatedProduct.id);
    let nextList: Product[];
    if (exists) {
      nextList = products.map(p => p.id === updatedProduct.id ? updatedProduct : p);
    } else {
      nextList = [updatedProduct, ...products];
    }
    setProducts(nextList);
    await saveProductRecord(updatedProduct);
  };

  // Inventory Delete
  const handleDeleteProduct = async (productId: string) => {
    const nextList = products.filter(p => p.id !== productId);
    setProducts(nextList);
    await deleteProductRecord(productId);
  };

  // Save Settings
  const handleSaveSettings = async (newSettings: StoreSettings) => {
    setSettings(newSettings);
    await saveStoreSettings(newSettings);
  };

  // If no user is logged in, show the Login Page
  if (!session) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        storeName={settings.storeName}
      />
    );
  }

  const isDark = theme === 'dark';
  const role: Role = session.role;
  const isAdmin = role === 'ADMIN';

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-indigo-500 selection:text-white ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Top Mobile Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
        role={role}
        storeName={settings.storeName}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        session={session}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 overflow-hidden">
        {/* Billing Counter - Accessible to Employee and Admin */}
        {activeTab === 'billing' && (
          <div className="space-y-4">
            {billingSubTab === 'cart' ? (
              /* When Cart tab is selected: Full-focus Cart View with 3-tab switcher */
              <div className="max-w-4xl mx-auto space-y-4">
                <BarcodeScanner
                  onScanSuccess={handleScanSuccess}
                  products={products}
                  enableSound={settings.enableSound}
                  enableHaptics={settings.enableHaptics}
                  currencySymbol={settings.currencySymbol}
                  theme={theme}
                  activeSubTab={billingSubTab}
                  onSubTabChange={setBillingSubTab}
                  cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
                />
                <CartView
                  cart={cart}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveCartItem}
                  onApplyLineDiscount={handleApplyLineDiscount}
                  onClearCart={() => setCart([])}
                  onProceedToCheckout={handleProceedToCheckout}
                  settings={settings}
                  theme={theme}
                />
              </div>
            ) : (
              /* When Type & Search or Barcode is selected */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
                {/* Left Column: Barcode Scanner / Search View with 3 Tabs */}
                <div className="lg:col-span-7 space-y-3">
                  <BarcodeScanner
                    onScanSuccess={handleScanSuccess}
                    products={products}
                    enableSound={settings.enableSound}
                    enableHaptics={settings.enableHaptics}
                    currencySymbol={settings.currencySymbol}
                    theme={theme}
                    activeSubTab={billingSubTab}
                    onSubTabChange={setBillingSubTab}
                    cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
                  />

                  {/* On Mobile / Small Screens: Fast Action Pill to Switch to Cart */}
                  <div className="lg:hidden">
                    <button
                      type="button"
                      onClick={() => setBillingSubTab('cart')}
                      className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-between shadow-lg transition-all cursor-pointer ${
                        cart.length > 0
                          ? 'bg-purple-600 hover:bg-purple-500 text-white'
                          : isDark
                          ? 'bg-slate-900 text-slate-400 border border-slate-800'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <span>🛒 View Cart</span>
                        {cart.length > 0 && (
                          <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-mono text-[10px]">
                            {cart.reduce((s, i) => s + i.quantity, 0)} items
                          </span>
                        )}
                      </span>
                      <span>Switch to Cart Tab →</span>
                    </button>
                  </div>
                </div>

                {/* Right Column: Real-time Cart & Checkout (Always accessible on desktop) */}
                <div className="hidden lg:block lg:col-span-5">
                  <CartView
                    cart={cart}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemoveItem={handleRemoveCartItem}
                    onApplyLineDiscount={handleApplyLineDiscount}
                    onClearCart={() => setCart([])}
                    onProceedToCheckout={handleProceedToCheckout}
                    settings={settings}
                    theme={theme}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Offline Transactions - Hand-Calculated Billing without items */}
        {activeTab === 'offline' && (
          <OfflineBilling
            onCompleteCheckout={handleCompleteCheckout}
            settings={settings}
            theme={theme}
            cashierName={session.displayName || (isAdmin ? 'Manager (Admin)' : 'Store Cashier')}
          />
        )}

        {/* Catalog & Stock - Admin Only */}
        {activeTab === 'inventory' && isAdmin && (
          <InventoryManager
            products={products}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onImportProducts={(imported) => {
              setProducts(imported);
              saveProducts(imported);
            }}
            settings={settings}
            theme={theme}
          />
        )}

        {/* Sales & Invoices Reports - Admin Only */}
        {activeTab === 'reports' && isAdmin && (
          <SalesReports
            invoices={invoices}
            settings={settings}
            onViewInvoice={(inv) => setViewingInvoice(inv)}
            theme={theme}
          />
        )}

        {/* System Settings - Admin Only */}
        {activeTab === 'settings' && isAdmin && (
          <SettingsModal
            settings={settings}
            onSaveSettings={handleSaveSettings}
            role={role}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}
      </main>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          cart={cart}
          includeTax={checkoutConfig.includeTax}
          overallDiscountType={checkoutConfig.overallDiscountType}
          overallDiscountValue={checkoutConfig.overallDiscountValue}
          overallDiscountAmount={checkoutConfig.overallDiscountAmount}
          onClose={() => setIsCheckoutOpen(false)}
          onCompleteCheckout={handleCompleteCheckout}
          settings={settings}
          cashierName={session.displayName || (isAdmin ? 'Manager (Admin)' : 'Store Cashier')}
        />
      )}

      {/* Receipt View Modal */}
      {viewingInvoice && (
        <ReceiptViewModal
          invoice={viewingInvoice}
          settings={settings}
          onClose={() => setViewingInvoice(null)}
          onNewBill={() => {
            setViewingInvoice(null);
            setCart([]);
            setCheckoutConfig({
              includeTax: settings.defaultIncludeTax ?? false,
              overallDiscountType: 'PERCENT',
              overallDiscountValue: 0,
              overallDiscountAmount: 0,
            });
            setActiveTab('billing');
            setBillingSubTab('search');
          }}
        />
      )}
    </div>
  );
};

export default App;
