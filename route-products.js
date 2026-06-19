const express = require('express');
const router = express.Router();
const pool = require('./db');
const { requireAuth, requireRole } = require('./auth-middleware');

router.use(requireAuth);

// ---------- جلب جميع المنتجات (مع الفئة) ----------
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, pc.name AS category_name
            FROM products p
            LEFT JOIN product_categories pc ON pc.id = p.category_id
            WHERE p.is_active = TRUE
            ORDER BY pc.name, p.name
        `);
        res.json({ success: true, products: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب المنتجات' });
    }
});

// ---------- جلب فئات المنتجات ----------
router.get('/categories/all', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM product_categories ORDER BY name');
        res.json({ success: true, categories: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب الفئات' });
    }
});

// ---------- إضافة فئة جديدة ----------
router.post('/categories', requireRole('admin'), async (req, res) => {
    try {
        const { name } = req.body;
        const result = await pool.query(
            'INSERT INTO product_categories (name) VALUES ($1) RETURNING *', [name]
        );
        res.json({ success: true, category: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في إضافة الفئة' });
    }
});

// ---------- إضافة منتج جديد ----------
router.post('/', requireRole('admin'), async (req, res) => {
    try {
        const { category_id, name, price, cost, stock_quantity, unit, low_stock_threshold, image_url } = req.body;
        if (!name || price === undefined) {
            return res.status(400).json({ success: false, message: 'اسم المنتج والسعر مطلوبان' });
        }
        const result = await pool.query(`
            INSERT INTO products (category_id, name, price, cost, stock_quantity, unit, low_stock_threshold, image_url)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [category_id || null, name, price, cost || 0, stock_quantity || 0, unit || 'piece', low_stock_threshold || 5, image_url || null]);

        res.json({ success: true, product: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في إضافة المنتج' });
    }
});

// ---------- تعديل منتج ----------
router.put('/:id', requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, name, price, cost, stock_quantity, unit, low_stock_threshold, image_url, is_active } = req.body;

        const result = await pool.query(`
            UPDATE products SET
                category_id = COALESCE($1, category_id),
                name = COALESCE($2, name),
                price = COALESCE($3, price),
                cost = COALESCE($4, cost),
                stock_quantity = COALESCE($5, stock_quantity),
                unit = COALESCE($6, unit),
                low_stock_threshold = COALESCE($7, low_stock_threshold),
                image_url = COALESCE($8, image_url),
                is_active = COALESCE($9, is_active)
            WHERE id = $10 RETURNING *
        `, [category_id, name, price, cost, stock_quantity, unit, low_stock_threshold, image_url, is_active, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
        }
        res.json({ success: true, product: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في تعديل المنتج' });
    }
});

// ---------- حذف منتج (إخفاء فقط) ----------
router.delete('/:id', requireRole('admin'), async (req, res) => {
    try {
        await pool.query('UPDATE products SET is_active = FALSE WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'تم حذف المنتج' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في حذف المنتج' });
    }
});

// ---------- المنتجات منخفضة المخزون ----------
router.get('/alerts/low-stock', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM products
            WHERE is_active = TRUE AND stock_quantity <= low_stock_threshold
            ORDER BY stock_quantity ASC
        `);
        res.json({ success: true, lowStock: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب تنبيهات المخزون' });
    }
});

// ---------- تسجيل حركة مخزون (وارد / تسوية) ----------
router.post('/:id/stock-movement', requireRole('admin'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { movement_type, quantity, reason } = req.body; // movement_type: in / out / adjustment

        await client.query('BEGIN');

        let updateQuery;
        if (movement_type === 'in') {
            updateQuery = 'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2 RETURNING *';
        } else if (movement_type === 'out') {
            updateQuery = 'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2 RETURNING *';
        } else {
            updateQuery = 'UPDATE products SET stock_quantity = $1 WHERE id = $2 RETURNING *'; // adjustment = تعيين قيمة مباشرة
        }

        const updated = await client.query(updateQuery, [quantity, id]);

        await client.query(`
            INSERT INTO inventory_movements (product_id, movement_type, quantity, reason, created_by)
            VALUES ($1,$2,$3,$4,$5)
        `, [id, movement_type, quantity, reason || null, req.session.userId]);

        await client.query('COMMIT');
        res.json({ success: true, product: updated.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في تسجيل حركة المخزون' });
    } finally {
        client.release();
    }
});

module.exports = router;
