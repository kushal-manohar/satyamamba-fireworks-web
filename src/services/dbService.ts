import { Product, Invoice, StoreSettings, UserSession, AuthCredentials, StaffUser, UpiAccount } from '../types';
import { getEffectiveUpiAccounts } from '../utils/upi';
import { getSupabaseClient } from '../utils/supabaseClient';
import {
  getProducts as getLocalProducts,
  saveProducts as saveLocalProducts,
  getInvoices as getLocalInvoices,
  saveInvoice as saveLocalInvoice,
  getSettings as getLocalSettings,
  saveSettings as saveLocalSettings,
  getNextInvoiceId as getLocalNextInvoiceId,
  getCredentials as getLocalCredentials,
  saveCredentials as saveLocalCredentials,
} from '../utils/storage';

// ----------------------------------------------------------------------
// DATA MAPPERS (Database Snake_Case <-> App CamelCase)
// ----------------------------------------------------------------------
export const mapDbProductToApp = (row: any): Product => ({
  id: row.id,
  barcode: row.barcode,
  name: row.name,
  category: row.category,
  price: Number(row.price),
  taxRate: Number(row.tax_rate ?? 18),
  stock: Number(row.stock ?? 0),
  unit: row.unit || 'pcs',
  description: row.description || '',
});

export const mapAppProductToDb = (p: Product) => ({
  id: p.id,
  barcode: p.barcode,
  name: p.name,
  category: p.category,
  price: p.price,
  tax_rate: p.taxRate,
  stock: p.stock,
  unit: p.unit,
  description: p.description || '',
  updated_at: new Date().toISOString(),
});

export const mapDbInvoiceToApp = (row: any): Invoice => {
  const items = Array.isArray(row.items) ? row.items : [];
  const itemWithUpi = items.find((it: any) => it && it._selectedUpiId);
  const selectedUpi = itemWithUpi?._selectedUpiId || (items[0] as any)?._selectedUpiId || row.selected_upi_id || undefined;

  return {
    id: row.id,
    timestamp: row.timestamp || new Date().toISOString(),
    cashierName: row.cashier_name || 'Staff',
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone || '',
    includeTax: Boolean(row.include_tax ?? true),
    overallDiscountType: row.overall_discount_type || 'PERCENT',
    overallDiscountValue: Number(row.overall_discount_value ?? 0),
    items: items.map((it: any) => {
      if (it && it._selectedUpiId) {
        const { _selectedUpiId, ...cleanIt } = it;
        return cleanIt;
      }
      return it;
    }),
    subtotal: Number(row.subtotal ?? 0),
    taxTotal: Number(row.tax_total ?? 0),
    discountTotal: Number(row.discount_total ?? 0),
    grandTotal: Number(row.grand_total ?? 0),
    paymentMethod: row.payment_method || 'CASH',
    selectedUpiId: selectedUpi,
    cashTendered: row.cash_tendered !== null && row.cash_tendered !== undefined ? Number(row.cash_tendered) : undefined,
    changeDue: row.change_due !== null && row.change_due !== undefined ? Number(row.change_due) : undefined,
    syncStatus: (row.sync_status as any) || 'SYNCED',
  };
};

export const mapAppInvoiceToDb = (inv: Invoice) => {
  const itemsWithMeta = inv.items.map((it, idx) => {
    if (idx === 0 && inv.selectedUpiId) {
      return { ...it, _selectedUpiId: inv.selectedUpiId };
    }
    return it;
  });

  return {
    id: inv.id,
    timestamp: inv.timestamp,
    cashier_name: inv.cashierName,
    customer_name: inv.customerName || null,
    customer_phone: inv.customerPhone || null,
    include_tax: inv.includeTax,
    overall_discount_type: inv.overallDiscountType || 'PERCENT',
    overall_discount_value: inv.overallDiscountValue || 0,
    items: itemsWithMeta,
    subtotal: inv.subtotal,
    tax_total: inv.taxTotal,
    discount_total: inv.discountTotal,
    grand_total: inv.grandTotal,
    payment_method: inv.paymentMethod,
    cash_tendered: inv.cashTendered !== undefined ? inv.cashTendered : null,
    change_due: inv.changeDue !== undefined ? inv.changeDue : null,
    sync_status: 'SYNCED',
  };
};

// ----------------------------------------------------------------------
// PRODUCTS / INVENTORY
// ----------------------------------------------------------------------
export const fetchProducts = async (): Promise<Product[]> => {
  const localList = getLocalProducts();
  const client = getSupabaseClient();
  if (!client) return localList;

  try {
    const { data, error } = await client
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error || !data) {
      return localList;
    }

    const cloudProducts = data.map(mapDbProductToApp);
    saveLocalProducts(cloudProducts);
    return cloudProducts;
  } catch (e) {
    console.warn('Could not fetch products from Supabase, using local cache:', e);
    return localList;
  }
};

export const saveProductRecord = async (product: Product): Promise<void> => {
  const current = getLocalProducts();
  const exists = current.some((p) => p.id === product.id);
  const updated = exists
    ? current.map((p) => (p.id === product.id ? product : p))
    : [product, ...current];
  saveLocalProducts(updated);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('products').upsert(mapAppProductToDb(product));
    } catch (e) {
      console.error('Failed to sync product to Supabase:', e);
    }
  }
};

export const deleteProductRecord = async (productId: string): Promise<void> => {
  const current = getLocalProducts();
  const filtered = current.filter((p) => p.id !== productId);
  saveLocalProducts(filtered);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('products').delete().eq('id', productId);
    } catch (e) {
      console.error('Failed to delete product from Supabase:', e);
    }
  }
};

// ----------------------------------------------------------------------
// INVOICES & SALES
// ----------------------------------------------------------------------
export const fetchInvoices = async (): Promise<Invoice[]> => {
  const localInvoices = getLocalInvoices();
  const client = getSupabaseClient();
  if (!client) return localInvoices;

  try {
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200);

    if (error || !data) return localInvoices;

    const cloudInvoices = data.map(mapDbInvoiceToApp);
    const localMap = new Map(localInvoices.map((inv) => [inv.id, inv]));

    // Self-healing: if cloud invoice is missing selectedUpiId but local invoice had it,
    // preserve local's selectedUpiId and backfill Supabase row
    const repairedCloudInvoices = cloudInvoices.map((cloudInv) => {
      const localMatch = localMap.get(cloudInv.id);
      if (!cloudInv.selectedUpiId && localMatch?.selectedUpiId) {
        const itemsWithMeta = (cloudInv.items || []).map((it, idx) =>
          idx === 0 ? { ...it, _selectedUpiId: localMatch.selectedUpiId } : it
        );
        client.from('invoices').update({ items: itemsWithMeta }).eq('id', cloudInv.id).then();
        return {
          ...cloudInv,
          selectedUpiId: localMatch.selectedUpiId,
        };
      }
      return cloudInv;
    });

    // Keep only true unsynced offline invoices created locally
    const cloudIds = new Set(repairedCloudInvoices.map((i) => i.id));
    const unsyncedLocals = localInvoices.filter(
      (i) =>
        i.syncStatus === 'LOCAL' &&
        !cloudIds.has(i.id) &&
        i.cashierName !== 'Store Cashier' &&
        !i.items?.some((item) => item.productId?.startsWith('prod-'))
    );

    const merged = [...unsyncedLocals, ...repairedCloudInvoices];
    localStorage.setItem('fireworks_pos_invoices', JSON.stringify(merged));
    saveLocalSettings({
      ...getLocalSettings(),
      lastSyncedAt: new Date().toISOString(),
    });
    return merged;
  } catch (e) {
    console.warn('Failed to load invoices from Supabase, using local:', e);
    return localInvoices;
  }
};

export const recordInvoice = async (invoice: Invoice): Promise<Invoice> => {
  const client = getSupabaseClient();
  let syncSuccess = false;

  // Prepare payload with _selectedUpiId embedded in items[0] for RPC and direct inserts
  const itemsWithMeta = (invoice.items || []).map((it, idx) => {
    if (idx === 0 && invoice.selectedUpiId) {
      return { ...it, _selectedUpiId: invoice.selectedUpiId };
    }
    return it;
  });

  const invoicePayload = {
    ...invoice,
    items: itemsWithMeta,
  };

  if (client) {
    try {
      // 1. Try atomic RPC stock deduction + invoice insert
      const { data: rpcRes, error: rpcErr } = await client.rpc(
        'record_invoice_and_deduct_stock',
        { invoice_data: invoicePayload }
      );

      if (!rpcErr) {
        syncSuccess = true;
      } else {
        // Fallback: direct insert to invoices table
        const { error: insertErr } = await client
          .from('invoices')
          .insert(mapAppInvoiceToDb(invoice));

        if (!insertErr) {
          syncSuccess = true;
          // Decrement stock in products table
          for (const item of invoice.items) {
            try {
              const { data: currentProd } = await client
                .from('products')
                .select('stock')
                .eq('id', item.productId)
                .single();
              if (currentProd) {
                const nextStock = Math.max(0, (currentProd.stock || 0) - item.quantity);
                await client.from('products').update({ stock: nextStock }).eq('id', item.productId);
              }
            } catch {
              // ignore individual stock decrement failures
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to sync invoice to Supabase immediately (saved locally):', e);
    }
  }

  const finalInvoice: Invoice = {
    ...invoice,
    syncStatus: syncSuccess ? 'SYNCED' : 'LOCAL',
  };

  saveLocalInvoice(finalInvoice);
  return finalInvoice;
};

export const syncOfflineInvoices = async (): Promise<{ syncedCount: number; errors: number }> => {
  const client = getSupabaseClient();
  if (!client) return { syncedCount: 0, errors: 0 };

  const localInvoices = getLocalInvoices();
  const pending = localInvoices.filter((i) => i.syncStatus === 'LOCAL');
  if (pending.length === 0) return { syncedCount: 0, errors: 0 };

  let syncedCount = 0;
  let errors = 0;

  for (const inv of pending) {
    try {
      const { error } = await client.from('invoices').upsert(mapAppInvoiceToDb(inv));
      if (!error) {
        inv.syncStatus = 'SYNCED';
        syncedCount++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  if (syncedCount > 0) {
    // Re-save local storage with updated syncStatus
    localStorage.setItem('fireworks_pos_invoices', JSON.stringify(localInvoices));
  }

  return { syncedCount, errors };
};

export const getNextInvoiceNumber = async (): Promise<string> => {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.rpc('get_next_invoice_number');
      if (!error && data) {
        return String(data);
      }
    } catch {
      // ignore
    }
  }
  return getLocalNextInvoiceId();
};

// ----------------------------------------------------------------------
// STORE SETTINGS
// ----------------------------------------------------------------------
export const fetchStoreSettings = async (): Promise<StoreSettings> => {
  const local = getLocalSettings();
  const client = getSupabaseClient();
  if (!client) return local;

  try {
    const { data, error } = await client
      .from('store_settings')
      .select('*')
      .in('id', ['primary', 'upi_registry']);

    if (error || !data || data.length === 0) return local;

    const primaryRow = data.find((r: any) => r.id === 'primary') || data[0];
    const upiRow = data.find((r: any) => r.id === 'upi_registry');

    let cloudUpiAccounts: UpiAccount[] = [];
    if (upiRow && upiRow.address) {
      try {
        const parsed = JSON.parse(upiRow.address);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cloudUpiAccounts = parsed;
        }
      } catch (err) {
        console.warn('Could not parse cloud upi_registry:', err);
      }
    }

    const mergedAccounts = cloudUpiAccounts.length > 0 ? cloudUpiAccounts : (local.upiAccounts || []);

    const merged: StoreSettings = {
      ...local,
      storeName: primaryRow?.store_name || local.storeName,
      address: primaryRow?.address || local.address,
      phone: primaryRow?.phone || local.phone,
      gstin: primaryRow?.gstin || local.gstin,
      currencySymbol: primaryRow?.currency_symbol || local.currencySymbol,
      upiId: primaryRow?.upi_id || local.upiId,
      managerPasscode: primaryRow?.manager_passcode || local.managerPasscode,
      receiptFooter: primaryRow?.receipt_footer || local.receiptFooter,
      printerPaperWidth: (primaryRow?.printer_paper_width as any) || local.printerPaperWidth,
      enableHaptics: primaryRow?.enable_haptics ?? local.enableHaptics,
      enableSound: primaryRow?.enable_sound ?? local.enableSound,
      defaultIncludeTax: primaryRow?.default_include_tax ?? local.defaultIncludeTax,
      upiAccounts: mergedAccounts,
      lastSyncedAt: new Date().toISOString(),
    };

    // Ensure effective accounts (with primary UPI included and default flagged)
    merged.upiAccounts = getEffectiveUpiAccounts(merged);

    saveLocalSettings(merged);

    // If cloud had no upi_registry row yet but we have accounts locally, initialize it on Supabase
    if (!upiRow && merged.upiAccounts.length > 0) {
      saveStoreSettings(merged).catch(() => {});
    }

    return merged;
  } catch (e) {
    return local;
  }
};

export const saveStoreSettings = async (settings: StoreSettings): Promise<void> => {
  saveLocalSettings(settings);

  const client = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
  if (client) {
    try {
      const effectiveAccounts = getEffectiveUpiAccounts(settings);
      const defaultAccount = effectiveAccounts.find((a) => a.isDefault) || effectiveAccounts[0];
      const primaryUpi = defaultAccount ? defaultAccount.upiId : settings.upiId;

      await client.from('store_settings').upsert({
        id: 'primary',
        store_name: settings.storeName,
        address: settings.address,
        phone: settings.phone,
        gstin: settings.gstin,
        currency_symbol: settings.currencySymbol,
        upi_id: primaryUpi,
        manager_passcode: settings.managerPasscode,
        receipt_footer: settings.receiptFooter,
        printer_paper_width: settings.printerPaperWidth,
        enable_haptics: settings.enableHaptics,
        enable_sound: settings.enableSound,
        default_include_tax: settings.defaultIncludeTax,
        updated_at: new Date().toISOString(),
      });

      // Upsert full UPI registry row so multi-device/Expo apps sync all UPI IDs
      await client.from('store_settings').upsert({
        id: 'upi_registry',
        store_name: 'UPI_REGISTRY',
        address: JSON.stringify(effectiveAccounts),
        phone: '',
        gstin: '',
        currency_symbol: '',
        upi_id: primaryUpi,
        manager_passcode: '',
        receipt_footer: '',
        printer_paper_width: '80mm',
        enable_haptics: false,
        enable_sound: false,
        default_include_tax: false,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to sync settings to Supabase:', e);
    }
  }
};

// ----------------------------------------------------------------------
// REALTIME SUBSCRIPTIONS
// ----------------------------------------------------------------------
export const subscribeToRealtimeChanges = (callbacks: {
  onProductsUpdate?: () => void;
  onInvoicesUpdate?: () => void;
  onSettingsUpdate?: () => void;
  onStaffUpdate?: () => void;
}): (() => void) => {
  const client = getSupabaseClient();
  if (!client) return () => {};

  try {
    const channel = client
      .channel('realtime_pos_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => callbacks.onProductsUpdate?.()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        () => callbacks.onInvoicesUpdate?.()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_settings' },
        () => callbacks.onSettingsUpdate?.()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_users' },
        () => callbacks.onStaffUpdate?.()
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Realtime subscription setup failed:', err);
    return () => {};
  }
};

// ----------------------------------------------------------------------
// STAFF & EMPLOYEE ACCOUNT MANAGEMENT (ADMIN ONLY)
// ----------------------------------------------------------------------
export const fetchStaffUsers = async (): Promise<StaffUser[]> => {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('app_users')
      .select('id, username, role, display_name, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((u: any) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      displayName: u.display_name || u.username,
      createdAt: u.created_at,
    }));
  } catch {
    return [];
  }
};

export const createStaffEmployee = async (
  username: string,
  pass: string,
  displayName: string
): Promise<{ success: boolean; message: string }> => {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Database is not connected.' };
  }

  const cleanUser = username.trim();
  const cleanPass = pass.trim();
  if (!cleanUser || !cleanPass) {
    return { success: false, message: 'Username and password are required.' };
  }

  try {
    const { error } = await client.from('app_users').insert({
      username: cleanUser,
      password: cleanPass,
      role: 'EMPLOYEE',
      display_name: displayName.trim() || cleanUser,
    });

    if (error) {
      if (error.code === '23505') {
        return { success: false, message: `Username "${cleanUser}" already exists.` };
      }
      return { success: false, message: error.message };
    }
    return { success: true, message: `Employee account "${cleanUser}" created successfully!` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to create employee.' };
  }
};

export const deleteStaffEmployee = async (userId: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('app_users')
      .delete()
      .eq('id', userId)
      .eq('role', 'EMPLOYEE'); // Safety: never delete admin

    return !error;
  } catch {
    return false;
  }
};

export const fetchAdminPassword = async (): Promise<string | null> => {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('app_users')
        .select('password')
        .eq('username', 'SatyamambaFireworks')
        .maybeSingle();

      if (!error && data?.password) {
        try {
          const creds = getLocalCredentials();
          creds.adminUser = 'SatyamambaFireworks';
          creds.adminPass = data.password;
          saveLocalCredentials(creds);
        } catch {
          // ignore
        }
        return data.password;
      }
    } catch {
      // ignore
    }
  }
  const localCreds = getLocalCredentials();
  return localCreds.adminPass || null;
};

export const updateUserPassword = async (
  username: string,
  newPass: string
): Promise<{ success: boolean; message: string }> => {
  const cleanPass = newPass.trim();
  const cleanUser = username.trim();

  // Also update local credentials
  try {
    const creds = getLocalCredentials();
    if (cleanUser === 'SatyamambaFireworks' || cleanUser === creds.adminUser) {
      creds.adminUser = 'SatyamambaFireworks';
      creds.adminPass = cleanPass;
      saveLocalCredentials(creds);
    } else if (cleanUser === creds.employeeUser) {
      creds.employeePass = cleanPass;
      saveLocalCredentials(creds);
    }
  } catch (e) {
    // ignore
  }

  const client = getSupabaseClient();
  if (!client) return { success: true, message: 'Password updated locally (offline mode).' };

  try {
    const { error } = await client
      .from('app_users')
      .update({ password: cleanPass, updated_at: new Date().toISOString() })
      .eq('username', cleanUser);

    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Password updated successfully in database!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to update password.' };
  }
};

export const authenticateUser = async (
  user: string,
  pass: string
): Promise<UserSession | null> => {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('app_users')
        .select('*')
        .eq('username', user.trim())
        .eq('password', pass.trim())
        .maybeSingle();

      if (!error && data) {
        return {
          username: data.username,
          role: data.role as 'ADMIN' | 'EMPLOYEE',
          displayName: data.display_name || (data.role === 'ADMIN' ? 'Administrator' : 'Billing Staff'),
          loginTime: new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn('Supabase auth query failed, falling back to local credentials:', e);
    }
  }

  // Local fallback
  const localCreds = getLocalCredentials();
  if (user === localCreds.adminUser && pass === localCreds.adminPass) {
    return {
      username: user,
      role: 'ADMIN',
      displayName: 'Store Administrator',
      loginTime: new Date().toISOString(),
    };
  } else if (user === localCreds.employeeUser && pass === localCreds.employeePass) {
    return {
      username: user,
      role: 'EMPLOYEE',
      displayName: 'Billing Counter Staff',
      loginTime: new Date().toISOString(),
    };
  }

  return null;
};

