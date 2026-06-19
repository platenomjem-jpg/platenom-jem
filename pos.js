let cart = [];

async function renderPOS() {
    const content = document.getElementById('pageContent');
    cart = [];
    try {
        const { products } = await apiRequest('/api/products');

        content.innerHTML = `
            <div class="pos-grid">
                <div class="card">
                    <h3 style="margin-bottom:14px;">☕ المنتجات</h3>
                    <div class="product-grid">
                        ${products.map(p => `
                            <div class="product-card" onclick="addToCart(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${p.price})">
                                <div class="pname">${p.name}</div>
                                <div class="pprice">${formatCurrency(p.price)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom:14px;">🧾 الفيش الحالي</h3>
                    <div id="cartItems"><p style="color:#9ca3af;font-size:13px;">السلة فاضية</p></div>
                    <div style="margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px;">
                        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;margin-bottom:12px;">
                            <span>الإجمالي:</span><span id="cartTotal">0 د.ع</span>
                        </div>
                        <select id="posPaymentMethod" style="width:100%;padding:8px;margin-bottom:10px;border:1px solid #d1d5db;border-radius:6px;">
                            <option value="cash">نقدي</option>
                            <option value="card">بطاقة</option>
                        </select>
                        <button class="btn btn-primary" style="width:100%;padding:12px;" onclick="completeOrder()">تأكيد البيع</button>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<p style="color:red;">خطأ: ${err.message}</p>`;
    }
}

function addToCart(id, name, price) {
    const existing = cart.find(item => item.product_id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ product_id: id, name, price: parseFloat(price), quantity: 1 });
    }
    renderCart();
}

function renderCart() {
    const cartEl = document.getElementById('cartItems');
    if (cart.length === 0) {
        cartEl.innerHTML = '<p style="color:#9ca3af;font-size:13px;">السلة فاضية</p>';
        document.getElementById('cartTotal').textContent = formatCurrency(0);
        return;
    }

    let total = 0;
    cartEl.innerHTML = cart.map((item, idx) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        return `
            <div class="cart-item">
                <span>${item.name} × ${item.quantity}</span>
                <span>${formatCurrency(subtotal)}
                    <button onclick="removeFromCart(${idx})" style="border:none;background:none;color:#dc2626;cursor:pointer;margin-right:6px;">✕</button>
                </span>
            </div>
        `;
    }).join('');

    document.getElementById('cartTotal').textContent = formatCurrency(total);
}

function removeFromCart(idx) {
    cart.splice(idx, 1);
    renderCart();
}

async function completeOrder() {
    if (cart.length === 0) return alert('السلة فاضية');
    try {
        const result = await apiRequest('/api/orders', 'POST', {
            items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
            payment_method: document.getElementById('posPaymentMethod').value
        });
        alert(`✅ تم تأكيد البيع - فيش رقم ${result.order.id}`);
        renderPOS();
    } catch (err) {
        alert(err.message);
    }
}
