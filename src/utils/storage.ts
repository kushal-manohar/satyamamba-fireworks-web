import { Product, Invoice, StoreSettings, ThemeMode, UserSession, AuthCredentials } from '../types';

const STORAGE_KEYS = {
  PRODUCTS: 'fireworks_pos_products',
  INVOICES: 'fireworks_pos_invoices',
  SETTINGS: 'fireworks_pos_settings',
  INVOICE_COUNTER: 'fireworks_pos_inv_counter',
  THEME: 'fireworks_pos_theme',
  AUTH_SESSION: 'fireworks_pos_auth_session',
  CREDENTIALS: 'fireworks_pos_credentials',
};

export const DEFAULT_CREDENTIALS: AuthCredentials = {
  adminUser: 'SatyamambaFireworks',
  adminPass: 'SmF_9482_Admin',
  employeeUser: '',
  employeePass: '',
};

// Initial empty catalog (sample products removed)
export const INITIAL_PRODUCTS: Product[] = [];

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Satyamamba Fireworks',
  address: '',
  phone: '',
  gstin: '',
  currencySymbol: '₹',
  upiId: '',
  managerPasscode: '1234',
  receiptFooter: 'Thank you for shopping at Satyamamba Fireworks! Wish you a happy & safe celebration.',
  printerPaperWidth: '58mm',
  enableHaptics: true,
  enableSound: true,
  defaultIncludeTax: false,
  supabaseUrl: 'https://vxkgxlomnvizqwzachie.supabase.co',
  supabaseAnonKey: 'sb_publishable_NK0EaOo2owEELvqH0a-NeQ_oI4LvPXG',
};

// Purge old sample data automatically
export const purgeOldSampleData = () => {
  try {
    const prodRaw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (prodRaw) {
      const list: Product[] = JSON.parse(prodRaw);
      const hasSample = list.some(
        (p) =>
          p.id?.startsWith('prod-') ||
          p.name?.toLowerCase().includes('sparklers') ||
          p.name?.toLowerCase().includes('flower pots')
      );
      if (hasSample) {
        localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
      }
    }

    const invRaw = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (invRaw) {
      const invList: Invoice[] = JSON.parse(invRaw);
      const hasSampleInv = invList.some(
        (inv) =>
          inv.cashierName === 'Store Cashier' ||
          inv.items?.some(
            (i) =>
              i.productId?.startsWith('prod-') ||
              i.name?.toLowerCase().includes('sparklers')
          )
      );
      if (hasSampleInv) {
        localStorage.removeItem(STORAGE_KEYS.INVOICES);
        localStorage.removeItem(STORAGE_KEYS.INVOICE_COUNTER);
      }
    }

    const credsRaw = localStorage.getItem(STORAGE_KEYS.CREDENTIALS);
    if (credsRaw) {
      const parsed = JSON.parse(credsRaw);
      if (parsed.adminUser !== 'SatyamambaFireworks') {
        parsed.adminUser = 'SatyamambaFireworks';
        localStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(parsed));
      }
    }
  } catch (e) {
    // ignore
  }
};

purgeOldSampleData();

// Storage helper functions
export const getProducts = (): Product[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!data) {
      return [];
    }
    const parsed: Product[] = JSON.parse(data);
    const cleaned = parsed.filter(
      (p) =>
        !p.id?.startsWith('prod-') &&
        !p.name?.toLowerCase().includes('sparklers') &&
        !p.name?.toLowerCase().includes('flower pots')
    );
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
};

export const saveProducts = (products: Product[]) => {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
};

export const getInvoices = (): Invoice[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (!data) return [];
    const parsed: Invoice[] = JSON.parse(data);
    const cleaned = parsed.filter(
      (inv) =>
        inv.cashierName !== 'Store Cashier' &&
        !inv.items?.some(
          (i) =>
            i.productId?.startsWith('prod-') ||
            i.name?.toLowerCase().includes('sparklers')
        )
    );
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
};

export const saveInvoice = (invoice: Invoice): Invoice[] => {
  const current = getInvoices();
  const updated = [invoice, ...current];
  localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(updated));
  return updated;
};

export const getSettings = (): StoreSettings => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: StoreSettings) => {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
};

export const getNextInvoiceId = (): string => {
  try {
    const current = localStorage.getItem(STORAGE_KEYS.INVOICE_COUNTER);
    const num = current ? parseInt(current, 10) + 1 : 1;
    localStorage.setItem(STORAGE_KEYS.INVOICE_COUNTER, num.toString());
    const year = new Date().getFullYear();
    const formattedNum = num.toString().padStart(4, '0');
    return `INV-${year}-${formattedNum}`;
  } catch (e) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `INV-${new Date().getFullYear()}-${randomSuffix}`;
  }
};

// Theme Preference
export const getThemePreference = (): ThemeMode => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode;
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark'; // default theme
  } catch {
    return 'dark';
  }
};

export const saveThemePreference = (theme: ThemeMode) => {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (e) {
    console.error('Failed to save theme preference', e);
  }
};

// User Session & Authentication
export const getUserSession = (): UserSession | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const saveUserSession = (session: UserSession | null) => {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    }
  } catch (e) {
    console.error('Failed to save session', e);
  }
};

export const clearUserSession = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
  } catch (e) {
    console.error('Failed to clear session', e);
  }
};

// System Credentials
export const getCredentials = (): AuthCredentials => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CREDENTIALS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(DEFAULT_CREDENTIALS));
      return DEFAULT_CREDENTIALS;
    }
    const parsed = JSON.parse(data);
    const result: AuthCredentials = {
      ...DEFAULT_CREDENTIALS,
      ...parsed,
      adminUser: 'SatyamambaFireworks',
    };
    if (parsed.adminUser !== 'SatyamambaFireworks') {
      localStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(result));
    }
    return result;
  } catch {
    return DEFAULT_CREDENTIALS;
  }
};

export const saveCredentials = (creds: AuthCredentials) => {
  try {
    const safeCreds = { ...creds, adminUser: 'SatyamambaFireworks' };
    localStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(safeCreds));
  } catch (e) {
    console.error('Failed to save credentials', e);
  }
};

