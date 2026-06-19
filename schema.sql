-- ============================================
-- نظام إدارة النادي الرياضي والكافيه
-- قاعدة البيانات الكاملة - PostgreSQL
-- ============================================

-- ---------- جدول المستخدمين (الموظفين/الإدارة) ----------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'cashier', -- admin / receptionist / cashier / accountant
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ---------- جدول خطط الاشتراك ----------
CREATE TABLE IF NOT EXISTS membership_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,         -- مثال: شهري، 3 أشهر، سنوي
    duration_days INTEGER NOT NULL,     -- مدة الخطة بالأيام
    price NUMERIC(12,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ---------- جدول الأعضاء ----------
CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    gender VARCHAR(10),
    birth_date DATE,
    photo_url TEXT,
    address TEXT,
    emergency_contact VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ---------- جدول الاشتراكات الفعلية للأعضاء ----------
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES membership_plans(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_paid NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash', -- cash / card
    status VARCHAR(20) DEFAULT 'active', -- active / expired / frozen / cancelled
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ---------- جدول سجل الحضور ----------
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    check_in_time TIMESTAMP DEFAULT NOW(),
    checked_by INTEGER REFERENCES users(id)
);

-- ---------- جدول فئات منتجات الكافيه ----------
CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL -- مشروبات بادرة / مشروبات ساخنة / سناكات ...
);

-- ---------- جدول منتجات الكافيه ----------
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES product_categories(id),
    name VARCHAR(150) NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    cost NUMERIC(12,2) DEFAULT 0,        -- تكلفة المنتج (لحساب الربح)
    stock_quantity NUMERIC(12,2) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'piece',    -- piece / kg / liter ...
    low_stock_threshold NUMERIC(12,2) DEFAULT 5,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ---------- جدول الطلبات (فواتير الكافيه) ----------
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id), -- اختياري: قد يكون زائر بدون عضوية
    total_amount NUMERIC(12,2) NOT NULL,
    discount NUMERIC(12,2) DEFAULT 0,
    payment_method VARCHAR(20) DEFAULT 'cash',
    status VARCHAR(20) DEFAULT 'completed', -- completed / cancelled
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ---------- جدول عناصر الطلب ----------
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL
);

-- ---------- جدول حركة المخزون (وارد/صادر/تسوية) ----------
CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    movement_type VARCHAR(20) NOT NULL, -- in / out / adjustment
    quantity NUMERIC(12,2) NOT NULL,
    reason TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ---------- جدول المصروفات ----------
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL, -- رواتب / فواتير / صيانة / مشتريات مخزون ...
    description TEXT,
    amount NUMERIC(12,2) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- فهارس لتحسين الأداء
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_enddate ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_time ON attendance(check_in_time);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- ============================================
-- بيانات أولية (Seed Data) - اختياري
-- ============================================
INSERT INTO membership_plans (name, duration_days, price, description)
VALUES
    ('اشتراك شهري', 30, 25000, 'اشتراك شهر واحد'),
    ('اشتراك 3 أشهر', 90, 65000, 'اشتراك ثلاثة أشهر'),
    ('اشتراك سنوي', 365, 220000, 'اشتراك سنة كاملة')
ON CONFLICT DO NOTHING;

INSERT INTO product_categories (name) VALUES
    ('مشروبات بادرة'),
    ('مشروبات ساخنة'),
    ('سناكات'),
    ('مكملات غذائية')
ON CONFLICT DO NOTHING;
