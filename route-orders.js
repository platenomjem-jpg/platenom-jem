const express = require('express');
const router = express.Router();
const pool = require('./db');
const { requireAuth } = require('./auth-middleware');

router.use(requireAuth);

// ---------- إنشاء طلب بيع جديد (فيش كافيه) ----------
// يستقبل: { member_id (اختياري), items: [{product_id, quantity}], payment_method, discount }
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { member_id, items, payment_method, discount } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'الطلب يجب أن يحتوي على منتج واحد على الأقل' });
        }

        await client.query('BEGIN');

        let totalAmount = 0;
        const lineItems = [];

        // التحقق من توفر المخزون وحساب الإجمالي
        for (const item of items) {
            const productRes = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
            if (productRes.rows.length === 0) {
                throw new Error(`المنتج رقم ${item.product_id} غير موجود`);
            }
            const product = productRes.rows[0];

            if (product.stock_quantity < item.quantity) {
                throw new Error(`الكمية غير متوفرة للمنتج: ${product.name} (المتوفر: ${product.stock_quantity})`);
            }

            const subtotal = parseFloat(product.price) * parseFloat(item.quantity);
            totalAmount += subtotal;
            lineItems.push({
                product_id: product.id,
                quantity: item.quantity,
                unit_price: product.price,
                subtotal
            });
        }

        totalAmount -= parseFloat(discount || 0);

        // إنشاء الطلب
        const orderRes = await client.query(`
            INSERT INTO orders (member_id, total_amount, discount, payment_method, created_by)
            VALUES ($1,$2,$3,$4,$5) RETURNING *
        `, [member_id || null, totalAmount, discount || 0, payment_method || 'cash', req.session.userId]);

        const order = orderRes.rows[0];

        // إضافة عناصر الطلب وخصم المخزون
        for (const line of lineItems) {
            await client.query(`
                INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
                VALUES ($1,$2,$3,$4,$5)
            `, [order.id, line.product_id, line.quantity, line.unit_price, line.subtotal]);

            await client.query(`
                UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2
            `, [line.quantity, line.product_id]);

            await client.query(`
                INSERT INTO inventory_movements (product_id, movement_type, quantity, reason, created_by)
                VALUES ($1, 'out', $2, $3, $4)
            `, [line.product_id, line.quantity, `بيع - فيش رقم ${order.id}`, req.session.userId]);
        }

        await client.query('COMMIT');
        res.json({ success: true, order, items: lineItems });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ success: false, message: err.message || 'خطأ في إنشاء الطلب' });
    } finally {
        client.release();
    }
});

// ---------- جلب الطلبات (مع فلترة بالتاريخ) ----------
router.get('/', async (req, res) => {
    try {
        const { from, to } = req.query;
        let query = `
            SELECT o.*, m.full_name AS member_name, u.full_name AS cashier_name
            FROM orders o
            LEFT JOIN members m ON m.id = o.member_id
            LEFT JOIN users u ON u.id = o.created_by
            WHERE o.status = 'completed'
        `;
        const params = [];
        if (from) {
            params.push(from);
            query += ` AND o.created_at >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            query += ` AND o.created_at <= $${params.length}`;
        }
        query += ' ORDER BY o.created_at DESC LIMIT 200';

        const result = await pool.query(query, params);
        res.json({ success: true, orders: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب الطلبات' });
    }
});

// ---------- تفاصيل طلب واحد (لطباعة الفيش) ----------
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const order = await pool.query(`
            SELECT o.*, m.full_name AS member_name, u.full_name AS cashier_name
            FROM orders o
            LEFT JOIN members m ON m.id = o.member_id
            LEFT JOIN users u ON u.id = o.created_by
            WHERE o.id = $1
        `, [id]);

        if (order.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        }

        const items = await pool.query(`
            SELECT oi.*, p.name AS product_name
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = $1
        `, [id]);

        res.json({ success: true, order: order.rows[0], items: items.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في جلب تفاصيل الطلب' });
    }
});

// ---------- إلغاء طلب (مع إرجاع المخزون) ----------
router.post('/:id/cancel', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');

        const items = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        for (const item of items.rows) {
            await client.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2', [item.quantity, item.product_id]);
            await client.query(`
                INSERT INTO inventory_movements (product_id, movement_type, quantity, reason, created_by)
                VALUES ($1, 'in', $2, $3, $4)
            `, [item.product_id, item.quantity, `إلغاء فيش رقم ${id}`, req.session.userId]);
        }

        await client.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [id]);
        await client.query('COMMIT');
        res.json({ success: true, message: 'تم إلغاء الطلب وإرجاع المخزون' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'خطأ في إلغاء الطلب' });
    } finally {
        client.release();
    }
});

module.exports = router;
