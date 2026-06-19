require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const cors = require('cors');

const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware عام ----------
app.use(cors());
app.use(express.json({ limit: '10mb' })); // limit أعلى للصور (base64)
app.use(express.urlencoded({ extended: true }));

// ---------- إعداد الجلسات (تُحفظ في PostgreSQL، تستمر بعد إعادة تشغيل السيرفر) ----------
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'dev_secret_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // أسبوع
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}));

// ---------- الملفات الثابتة (الواجهة) - مجلد public فقط، بدون مجلدات فرعية ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- مسارات API ----------
app.use('/api/auth', require('./route-auth'));
app.use('/api/members', require('./route-members'));
app.use('/api/products', require('./route-products'));
app.use('/api/orders', require('./route-orders'));
app.use('/api/reports', require('./route-reports'));

// ---------- فحص صحة السيرفر ----------
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'السيرفر يعمل بشكل طبيعي', time: new Date().toISOString() });
});

// ---------- توجيه كل المسارات غير المعروفة إلى الواجهة (SPA fallback) ----------
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'المسار غير موجود' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- معالج الأخطاء العام ----------
app.use((err, req, res, next) => {
    console.error('خطأ غير متوقع:', err);
    res.status(500).json({ success: false, message: 'حدث خطأ غير متوقع في الخادم' });
});

app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
});
