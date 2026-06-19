const express = require('express');
const router = express.Router();
const pool = require('./db');
const { requireAuth, requireRole } = require('./auth-middleware');

router.use(requireAuth);

// ---------- ملخص لوحة التحكم الرئيسية ----------
router.get('/dashboard', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const cafeToday = await pool.query(`
            SELECT COALESCE(SUM(total_amount),0) AS total
            FROM orders WHERE status = 'completed' AND created_at::date = $1
        `, [today]);

        const subsToday = await pool.query(`
            SELECT COALESCE(SUM(price_paid),0) AS total
            FROM subscriptions WHERE created_at::date = $1
        `, [today]);

        const activeMembers = await pool.query(`
            SELECT COUNT(DISTINCT member_id) AS count
            FROM subscriptions WHERE status = 'active' AND end_date >= CURRENT_DATE
        `);

        const attendanceToday = await pool.query(`
            SELECT COUNT(*) AS count FROM attendance WHERE check_in_time::date = $1
        `, [today]);

        const expiringSoon = await pool.query(`
            SELECT COUNT(*) AS count FROM subscriptions
            WHERE status = 'active' AND end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7)
        `);

        const lowStock = await pool.query(`
            SELECT COUNT(*) AS count FROM products WHERE is_active = TRUE AND stock_quantity <= low_stock_threshold
        `);

        res.json({
            success: true,
            dashboard: {
                cafeRevenueToday: parseFloat(cafeToday.rows[0].total),
                subscriptionRevenueToday: parseFloat(subsToday.rows[0].total),
                activeMembers: parseInt(activeMembers.rows[0].count),
                attendanceToday: parseInt(attendanceToday.rows[0].count),
                expiringSoonCount: parseInt(expiringSoon.rows[0].count),
                lowStockCount: parseInt(lowStock.rows[0].count)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب ملخص لوحة التحكم' });
    }
});

// ---------- تقرير الإيرادات (كافيه + اشتراكات) بين تاريخين ----------
router.get('/revenue', requireRole('admin', 'accountant'), async (req, res) => {
    try {
        const { from, to } = req.query;
        const fromDate = from || '2000-01-01';
        const toDate = to || new Date().toISOString().split('T')[0];

        const cafeRevenue = await pool.query(`
            SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS orders_count
            FROM orders WHERE status = 'completed' AND created_at::date BETWEEN $1 AND $2
        `, [fromDate, toDate]);

        const subsRevenue = await pool.query(`
            SELECT COALESCE(SUM(price_paid),0) AS total, COUNT(*) AS subs_count
            FROM subscriptions WHERE created_at::date BETWEEN $1 AND $2
        `, [fromDate, toDate]);

        const expensesTotal = await pool.query(`
            SELECT COALESCE(SUM(amount),0) AS total
            FROM expenses WHERE expense_date BETWEEN $1 AND $2
        `, [fromDate, toDate]);

        const cafeTotal = parseFloat(cafeRevenue.rows[0].total);
        const subsTotal = parseFloat(subsRevenue.rows[0].total);
        const expTotal = parseFloat(expensesTotal.rows[0].total);

        res.json({
            success: true,
            period: { from: fromDate, to: toDate },
            cafeRevenue: cafeTotal,
            cafeOrdersCount: parseInt(cafeRevenue.rows[0].orders_count),
            subscriptionRevenue: subsTotal,
            subscriptionsCount: parseInt(subsRevenue.rows[0].subs_count),
            totalRevenue: cafeTotal + subsTotal,
            totalExpenses: expTotal,
            netProfit: (cafeTotal + subsTotal) - expTotal
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب تقرير الإيرادات' });
    }
});

// ---------- تقرير المبيعات اليومية (للرسم البياني) ----------
router.get('/daily-sales', requireRole('admin', 'accountant'), async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const result = await pool.query(`
            SELECT created_at::date AS day, COALESCE(SUM(total_amount),0) AS total
            FROM orders
            WHERE status = 'completed' AND created_at >= CURRENT_DATE - $1::int
            GROUP BY day ORDER BY day ASC
        `, [days]);
        res.json({ success: true, dailySales: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب المبيعات اليومية' });
    }
});

// ---------- أفضل المنتجات مبيعاً ----------
router.get('/top-products', requireRole('admin', 'accountant'), async (req, res) => {
    try {
        const { from, to } = req.query;
        const fromDate = from || '2000-01-01';
        const toDate = to || new Date().toISOString().split('T')[0];

        const result = await pool.query(`
            SELECT p.name, SUM(oi.quantity) AS total_quantity, SUM(oi.subtotal) AS total_revenue
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            JOIN orders o ON o.id = oi.order_id
            WHERE o.status = 'completed' AND o.created_at::date BETWEEN $1 AND $2
            GROUP BY p.name
            ORDER BY total_revenue DESC
            LIMIT 10
        `, [fromDate, toDate]);

        res.json({ success: true, topProducts: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب أفضل المنتجات' });
    }
});

// ============================================
// المصروفات (Expenses)
// ============================================

router.get('/expenses', requireRole('admin', 'accountant'), async (req, res) => {
    try {
        const { from, to } = req.query;
        let query = 'SELECT e.*, u.full_name AS created_by_name FROM expenses e LEFT JOIN users u ON u.id = e.created_by WHERE 1=1';
        const params = [];
        if (from) { params.push(from); query += ` AND expense_date >= $${params.length}`; }
        if (to) { params.push(to); query += ` AND expense_date <= $${params.length}`; }
        query += ' ORDER BY expense_date DESC';

        const result = await pool.query(query, params);
        res.json({ success: true, expenses: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب المصروفات' });
    }
});

router.post('/expenses', requireRole('admin', 'accountant'), async (req, res) => {
    try {
        const { category, description, amount, expense_date } = req.body;
        if (!category || !amount) {
            return res.status(400).json({ success: false, message: 'الفئة والمبلغ مطلوبان' });
        }
        const result = await pool.query(`
            INSERT INTO expenses (category, description, amount, expense_date, created_by)
            VALUES ($1,$2,$3,$4,$5) RETURNING *
        `, [category, description || null, amount, expense_date || new Date().toISOString().split('T')[0], req.session.userId]);

        res.json({ success: true, expense: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في إضافة المصروف' });
    }
});

router.delete('/expenses/:id', requireRole('admin', 'accountant'), async (req, res) => {
    try {
        await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'تم حذف المصروف' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في حذف المصروف' });
    }
});

module.exports = router;
