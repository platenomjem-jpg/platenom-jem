const express = require('express');
const router = express.Router();
const pool = require('./db');
const { requireAuth } = require('./auth-middleware');

router.use(requireAuth);

// ---------- جلب جميع الأعضاء (مع بحث اختياري) ----------
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT m.*,
                (SELECT row_to_json(s) FROM (
                    SELECT sub.id, sub.end_date, sub.status, mp.name AS plan_name
                    FROM subscriptions sub
                    JOIN membership_plans mp ON mp.id = sub.plan_id
                    WHERE sub.member_id = m.id
                    ORDER BY sub.end_date DESC LIMIT 1
                ) s) AS latest_subscription
            FROM members m
        `;
        const params = [];
        if (search) {
            query += ` WHERE m.full_name ILIKE $1 OR m.phone ILIKE $1`;
            params.push(`%${search}%`);
        }
        query += ' ORDER BY m.created_at DESC';

        const result = await pool.query(query, params);
        res.json({ success: true, members: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب الأعضاء' });
    }
});

// ---------- جلب عضو واحد بالتفصيل (مع تاريخ الاشتراكات والحضور) ----------
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const member = await pool.query('SELECT * FROM members WHERE id = $1', [id]);
        if (member.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'العضو غير موجود' });
        }

        const subscriptions = await pool.query(`
            SELECT sub.*, mp.name AS plan_name
            FROM subscriptions sub
            JOIN membership_plans mp ON mp.id = sub.plan_id
            WHERE sub.member_id = $1
            ORDER BY sub.start_date DESC
        `, [id]);

        const attendance = await pool.query(`
            SELECT * FROM attendance WHERE member_id = $1
            ORDER BY check_in_time DESC LIMIT 30
        `, [id]);

        res.json({
            success: true,
            member: member.rows[0],
            subscriptions: subscriptions.rows,
            attendance: attendance.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب بيانات العضو' });
    }
});

// ---------- إضافة عضو جديد ----------
router.post('/', async (req, res) => {
    try {
        const { full_name, phone, gender, birth_date, address, emergency_contact, notes, photo_url } = req.body;
        if (!full_name) {
            return res.status(400).json({ success: false, message: 'الاسم الكامل مطلوب' });
        }

        const result = await pool.query(`
            INSERT INTO members (full_name, phone, gender, birth_date, address, emergency_contact, notes, photo_url)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [full_name, phone || null, gender || null, birth_date || null, address || null, emergency_contact || null, notes || null, photo_url || null]);

        res.json({ success: true, member: result.rows[0] });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'رقم الهاتف مستخدم مسبقاً' });
        }
        res.status(500).json({ success: false, message: 'خطأ في إضافة العضو' });
    }
});

// ---------- تعديل بيانات عضو ----------
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, phone, gender, birth_date, address, emergency_contact, notes, photo_url, is_active } = req.body;

        const result = await pool.query(`
            UPDATE members SET
                full_name = COALESCE($1, full_name),
                phone = COALESCE($2, phone),
                gender = COALESCE($3, gender),
                birth_date = COALESCE($4, birth_date),
                address = COALESCE($5, address),
                emergency_contact = COALESCE($6, emergency_contact),
                notes = COALESCE($7, notes),
                photo_url = COALESCE($8, photo_url),
                is_active = COALESCE($9, is_active)
            WHERE id = $10 RETURNING *
        `, [full_name, phone, gender, birth_date, address, emergency_contact, notes, photo_url, is_active, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'العضو غير موجود' });
        }
        res.json({ success: true, member: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في تعديل بيانات العضو' });
    }
});

// ---------- حذف عضو ----------
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM members WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'تم حذف العضو' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في حذف العضو' });
    }
});

// ============================================
// الاشتراكات (Subscriptions)
// ============================================

// جلب خطط الاشتراك المتاحة
router.get('/plans/all', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM membership_plans WHERE is_active = TRUE ORDER BY price ASC');
        res.json({ success: true, plans: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب خطط الاشتراك' });
    }
});

// إنشاء اشتراك جديد لعضو (تجديد أو اشتراك أول)
router.post('/:id/subscribe', async (req, res) => {
    try {
        const { id } = req.params; // member_id
        const { plan_id, payment_method, start_date } = req.body;

        const plan = await pool.query('SELECT * FROM membership_plans WHERE id = $1', [plan_id]);
        if (plan.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'خطة الاشتراك غير موجودة' });
        }

        const planData = plan.rows[0];
        const startDate = start_date ? new Date(start_date) : new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + planData.duration_days);

        const result = await pool.query(`
            INSERT INTO subscriptions (member_id, plan_id, start_date, end_date, price_paid, payment_method, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
        `, [id, plan_id, startDate, endDate, planData.price, payment_method || 'cash', req.session.userId]);

        res.json({ success: true, subscription: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في إنشاء الاشتراك' });
    }
});

// ---------- الاشتراكات التي ستنتهي قريباً (تنبيهات) ----------
router.get('/alerts/expiring', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const result = await pool.query(`
            SELECT sub.id, sub.end_date, m.id AS member_id, m.full_name, m.phone, mp.name AS plan_name
            FROM subscriptions sub
            JOIN members m ON m.id = sub.member_id
            JOIN membership_plans mp ON mp.id = sub.plan_id
            WHERE sub.status = 'active'
            AND sub.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + $1::int)
            ORDER BY sub.end_date ASC
        `, [days]);
        res.json({ success: true, expiring: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب التنبيهات' });
    }
});

// ============================================
// الحضور (Attendance)
// ============================================

// تسجيل حضور عضو
router.post('/:id/checkin', async (req, res) => {
    try {
        const { id } = req.params;

        // التحقق من وجود اشتراك فعال
        const activeSub = await pool.query(`
            SELECT * FROM subscriptions
            WHERE member_id = $1 AND status = 'active' AND end_date >= CURRENT_DATE
            ORDER BY end_date DESC LIMIT 1
        `, [id]);

        if (activeSub.rows.length === 0) {
            return res.status(400).json({ success: false, message: '⚠️ لا يوجد اشتراك فعّال لهذا العضو' });
        }

        const result = await pool.query(`
            INSERT INTO attendance (member_id, checked_by) VALUES ($1, $2) RETURNING *
        `, [id, req.session.userId]);

        res.json({ success: true, attendance: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في تسجيل الحضور' });
    }
});

module.exports = router;
