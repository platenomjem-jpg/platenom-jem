// سكربت تهيئة قاعدة البيانات: ينشئ كل الجداول من schema.sql
// استخدام: npm run init-db
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function initDb() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('⏳ جاري إنشاء الجداول...');
        await pool.query(schema);
        console.log('✅ تم إنشاء جميع الجداول بنجاح');

        // إنشاء مستخدم أدمن افتراضي إذا لم يوجد أي مستخدم
        const bcrypt = require('bcryptjs');
        const result = await pool.query('SELECT COUNT(*) FROM users');
        if (parseInt(result.rows[0].count) === 0) {
            const defaultPassword = 'admin123';
            const hash = await bcrypt.hash(defaultPassword, 10);
            await pool.query(
                `INSERT INTO users (full_name, username, password_hash, role)
                 VALUES ($1, $2, $3, $4)`,
                ['المدير العام', 'admin', hash, 'admin']
            );
            console.log('✅ تم إنشاء مستخدم أدمن افتراضي:');
            console.log('   اسم المستخدم: admin');
            console.log('   كلمة المرور: admin123');
            console.log('   ⚠️  غيّر كلمة المرور فوراً بعد أول تسجيل دخول!');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ فشل تهيئة قاعدة البيانات:', err);
        process.exit(1);
    }
}

initDb();
