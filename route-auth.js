const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('./db');

// تسجيل الدخول
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
        }

        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND is_active = TRUE',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        // حفظ بيانات الجلسة
        req.session.userId = user.id;
        req.session.fullName = user.full_name;
        req.session.role = user.role;

        res.json({
            success: true,
            user: { id: user.id, fullName: user.full_name, role: user.role, username: user.username }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
});

// تسجيل الخروج
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true, message: 'تم تسجيل الخروج' });
    });
});

// معرفة المستخدم الحالي (لإعادة تسجيل دخول تلقائي عند فتح الصفحة)
router.get('/me', (req, res) => {
    if (req.session && req.session.userId) {
        return res.json({
            success: true,
            user: {
                id: req.session.userId,
                fullName: req.session.fullName,
                role: req.session.role
            }
        });
    }
    res.status(401).json({ success: false, message: 'غير مسجل دخول' });
});

module.exports = router;
