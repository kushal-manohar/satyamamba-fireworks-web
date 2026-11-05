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
  const [activeTab, setActiveTab] = useState<'billing' | 'inventory' | 'reports' | 'settings'>('billing');
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

  // Barcode detection handler
  const handleScanSuccess = (scannedBarcode: string) => {
    const foundProduct = products.find(p => p.barcode === scannedBarcode);

    if (foundProduct) {
      setCart(prevCart => {
        const existingIdx = prevCart.findIndex(item => item.product.id === foundProduct.id);
        if (existingIdx > -1) {
          const updated = [...prevCart];
          updated[existingIdx].quantity += 1;
          return updated;
        } else {
          return [
            ...prevCart,
            {
              product: foundProduct,
              quantity: 1,
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

    // Clear cart and show receipt view modal
    setCart([]);
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            {/* Left Column: Barcode Scanner Viewfinder & Dropdown Selector */}
            <div className="lg:col-span-6 space-y-4">
              <BarcodeScanner
                onScanSuccess={handleScanSuccess}
                products={products}
                enableSound={settings.enableSound}
                enableHaptics={settings.enableHaptics}
                currencySymbol={settings.currencySymbol}
                theme={theme}
              />
            </div>

            {/* Right Column: Real-time Cart & Checkout */}
            <div className="lg:col-span-6">
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
            setActiveTab('billing');
          }}
        />
      )}
    </div>
  );
};

export default App;
