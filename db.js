const { Pool } = require('pg');
require('dotenv').config();

// إعداد الاتصال بقاعدة البيانات
// على Railway، متغير DATABASE_URL يكون موجود تلقائياً عند ربط PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
});

pool.on('error', (err) => {
    console.error('❌ خطأ في اتصال قاعدة البيانات:', err.message);
});

module.exports = pool;
