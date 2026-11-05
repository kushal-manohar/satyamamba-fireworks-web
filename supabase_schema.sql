-- ====================================================================
-- SUPABASE DATABASE SCHEMA FOR SATYAMAMBA FIREWORKS BILLING & POS
-- ====================================================================
-- Run this complete script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vxkgxlomnvizqwzachie/sql/new

-- 1. PRODUCTS / INVENTORY TABLE
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    barcode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'box',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 2. INVOICES / SALES BILLS TABLE
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    cashier_name TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    include_tax BOOLEAN DEFAULT FALSE,
    overall_discount_type TEXT DEFAULT 'PERCENT',
    overall_discount_value NUMERIC(10, 2) DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    cash_tendered NUMERIC(10, 2),
    change_due NUMERIC(10, 2),
    sync_status TEXT DEFAULT 'SYNCED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_timestamp ON invoices(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_cashier ON invoices(cashier_name);

-- 3. STORE SETTINGS TABLE (SINGLETON RECORD)
CREATE TABLE IF NOT EXISTS store_settings (
    id TEXT PRIMARY KEY DEFAULT 'primary',
    store_name TEXT NOT NULL DEFAULT 'Satyamamba Fireworks',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    gstin TEXT DEFAULT '',
    currency_symbol TEXT DEFAULT '₹',
    upi_id TEXT DEFAULT '',
    manager_passcode TEXT DEFAULT '1234',
    receipt_footer TEXT DEFAULT 'Thank you for shopping at Satyamamba Fireworks! Wish you a happy & safe celebration.',
    printer_paper_width TEXT DEFAULT '58mm',
    enable_haptics BOOLEAN DEFAULT TRUE,
    enable_sound BOOLEAN DEFAULT TRUE,
    default_include_tax BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. APP USERS / STAFF CREDENTIALS
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE')),
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ATOMIC INVOICE SEQUENCE GENERATOR
CREATE TABLE IF NOT EXISTS invoice_sequence (
    year INTEGER PRIMARY KEY,
    last_val INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION get_next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    cur_year INTEGER := EXTRACT(YEAR FROM CURRENT_TIMESTAMP);
    next_num INTEGER;
BEGIN
    INSERT INTO invoice_sequence (year, last_val)
    VALUES (cur_year, 1)
    ON CONFLICT (year)
    DO UPDATE SET last_val = invoice_sequence.last_val + 1
    RETURNING last_val INTO next_num;

    RETURN 'INV-' || cur_year || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- 6. RPC: ATOMIC INVOICE RECORDING & STOCK DEDUCTION
CREATE OR REPLACE FUNCTION record_invoice_and_deduct_stock(invoice_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    item JSONB;
BEGIN
    -- Insert or update invoice
    INSERT INTO invoices (
        id, timestamp, cashier_name, customer_name, customer_phone,
        include_tax, overall_discount_type, overall_discount_value,
        items, subtotal, tax_total, discount_total, grand_total,
        payment_method, cash_tendered, change_due, sync_status
    ) VALUES (
        invoice_data->>'id',
        (invoice_data->>'timestamp')::timestamptz,
        invoice_data->>'cashierName',
        invoice_data->>'customerName',
        invoice_data->>'customerPhone',
        COALESCE((invoice_data->>'includeTax')::boolean, FALSE),
        COALESCE(invoice_data->>'overallDiscountType', 'PERCENT'),
        COALESCE((invoice_data->>'overallDiscountValue')::numeric, 0),
        invoice_data->'items',
        (invoice_data->>'subtotal')::numeric,
        (invoice_data->>'taxTotal')::numeric,
        (invoice_data->>'discountTotal')::numeric,
        (invoice_data->>'grandTotal')::numeric,
        invoice_data->>'paymentMethod',
        (invoice_data->>'cashTendered')::numeric,
        (invoice_data->>'changeDue')::numeric,
        'SYNCED'
    )
    ON CONFLICT (id) DO UPDATE SET
        sync_status = 'SYNCED';

    -- Deduct inventory stock for each sold item
    FOR item IN SELECT * FROM jsonb_array_elements(invoice_data->'items')
    LOOP
        UPDATE products
        SET stock = GREATEST(0, stock - (item->>'quantity')::integer),
            updated_at = NOW()
        WHERE id = item->>'productId';
    END LOOP;

    RETURN jsonb_build_object('success', true, 'invoice_id', invoice_data->>'id');
END;
$$;

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon all on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on store_settings" ON store_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on app_users" ON app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on invoice_sequence" ON invoice_sequence FOR ALL USING (true) WITH CHECK (true);

-- 8. REALTIME REPLICATION CONFIGURATION
-- Enable Supabase Realtime for instant multi-device live sync
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE products;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE store_settings;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE app_users;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- 9. INITIAL DATA SETUP (ONLY CLEAN STORE SETTINGS & ADMIN ACCOUNT)
-- Store Settings (Tax Free by default)
INSERT INTO store_settings (id, store_name, address, phone, gstin, currency_symbol, upi_id, manager_passcode, receipt_footer, default_include_tax)
VALUES ('primary', 'Satyamamba Fireworks', '', '', '', '₹', '', '1234', 'Thank you for shopping at Satyamamba Fireworks! Wish you a happy & safe celebration.', FALSE)
ON CONFLICT (id) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    default_include_tax = EXCLUDED.default_include_tax;

-- Admin Account (SatyamambaFireworks with initial password SmF_9482_Admin)
INSERT INTO app_users (username, password, role, display_name)
VALUES ('SatyamambaFireworks', 'SmF_9482_Admin', 'ADMIN', 'Satyamamba Fireworks Administrator')
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    role = 'ADMIN',
    display_name = EXCLUDED.display_name;

-- Note: All sample products removed. Products catalog starts clean and empty.
