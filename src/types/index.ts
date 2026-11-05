export type PaymentMethod = 'CASH' | 'UPI' | 'CARD';
export type Role = 'ADMIN' | 'EMPLOYEE' | 'CASHIER' | 'MANAGER';
export type ThemeMode = 'dark' | 'light';
export type DiscountType = 'PERCENT' | 'FLAT';

export interface UserSession {
  username: string;
  role: 'ADMIN' | 'EMPLOYEE';
  displayName: string;
  loginTime: string;
}

export interface StaffUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'EMPLOYEE';
  displayName: string;
  createdAt?: string;
}

export interface AuthCredentials {
  adminUser: string;
  adminPass: string;
  employeeUser: string;
  employeePass: string;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  taxRate: number; // e.g. 18 for 18% GST/VAT, 0 for 0% Tax Free
  stock: number;
  unit: string; // 'pcs', 'box', 'pack'
  description?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountType: DiscountType; // 'PERCENT' (%) or 'FLAT' (₹)
  discountValue: number; // Value entered (e.g. 10 for 10% or 50 for ₹50)
  discountPercent: number; // calculated or explicit %
  discountAmount: number; // calculated flat rupee discount amount
}

export interface UpiAccount {
  id: string;
  upiId: string;
  label: string;
  isDefault?: boolean;
}

export interface Invoice {
  id: string; // e.g. INV-2026-0001
  timestamp: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  includeTax: boolean; // whether tax was included or excluded on this bill
  overallDiscountType?: DiscountType; // 'PERCENT' (%) or 'FLAT' (₹)
  overallDiscountValue?: number; // entered value
  items: {
    productId: string;
    barcode: string;
    name: string;
    unitPrice: number;
    taxRate: number;
    quantity: number;
    discountType?: DiscountType;
    discountValue?: number;
    lineDiscount: number;
    lineSubtotal: number;
    lineTax: number;
    lineTotal: number;
  }[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  selectedUpiId?: string;
  cashTendered?: number;
  changeDue?: number;
  syncStatus: 'LOCAL' | 'SYNCED';
}

export interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
  gstin: string; // Tax ID
  currencySymbol: string;
  upiId: string;
  upiAccounts?: UpiAccount[];
  managerPasscode: string;
  receiptFooter: string;
  printerPaperWidth: '58mm' | '80mm';
  enableHaptics: boolean;
  enableSound: boolean;
  theme?: ThemeMode;
  credentials?: AuthCredentials;
  defaultIncludeTax?: boolean; // whether bills default to include tax
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  lastSyncedAt?: string;
}

export interface DailySummary {
  date: string;
  totalSales: number;
  totalTransactions: number;
  cashTotal: number;
  upiTotal: number;
  cardTotal: number;
  taxCollected: number;
}
