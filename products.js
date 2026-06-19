async function renderProducts() {
    const content = document.getElementById('pageContent');
    try {
        const { products } = await apiRequest('/api/products');

        content.innerHTML = `
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                    <h3>📦 المنتجات والمخزون (${products.length})</h3>
                    <button class="btn btn-primary" onclick="showAddProductModal()">+ إضافة منتج</button>
                </div>
                <div style="overflow-x:auto;">
                <table>
                    <thead><tr><th>المنتج</th><th>الفئة</th><th>السعر</th><th>المخزون</th><th></th></tr></thead>
                    <tbody>
                        ${products.map(p => `
                            <tr>
                                <td>${p.name}</td>
                                <td>${p.category_name || '-'}</td>
                                <td>${formatCurrency(p.price)}</td>
                                <td>${parseFloat(p.stock_quantity) <= parseFloat(p.low_stock_threshold)
                                    ? `<span class="badge badge-danger">${p.stock_quantity} ${p.unit}</span>`
                                    : `${p.stock_quantity} ${p.unit}`}</td>
                                <td><button class="btn btn-secondary" onclick="showStockModal(${p.id}, '${p.name}')">تعديل مخزون</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<p style="color:red;">خطأ: ${err.message}</p>`;
    }
}

async function showAddProductModal() {
    const { categories } = await apiRequest('/api/products/categories/all');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <h3 style="margin-bottom:16px;">إضافة منتج جديد</h3>
            <form id="addProductForm">
                <div class="form-group"><label>اسم المنتج *</label><input type="text" id="pName" required></div>
                <div class="form-group"><label>الفئة</label>
                    <select id="pCategory">${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>سعر البيع *</label><input type="number" step="0.01" id="pPrice" required></div>
                <div class="form-group"><label>الكمية الابتدائية</label><input type="number" step="0.01" id="pStock" value="0"></div>
                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">حفظ</button>
                    <button type="button" class="btn btn-secondary" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await apiRequest('/api/products', 'POST', {
                name: document.getElementById('pName').value,
                category_id: document.getElementById('pCategory').value,
                price: document.getElementById('pPrice').value,
                stock_quantity: document.getElementById('pStock').value
            });
            overlay.remove();
            renderProducts();
        } catch (err) {
            alert(err.message);
        }
    });
}

function showStockModal(productId, productName) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <h3 style="margin-bottom:16px;">تعديل مخزون: ${productName}</h3>
            <form id="stockForm">
                <div class="form-group">
                    <label>نوع الحركة</label>
                    <select id="movementType">
                        <option value="in">إضافة (وارد)</option>
                        <option value="out">سحب (صادر)</option>
                        <option value="adjustment">تعيين قيمة جديدة (تسوية)</option>
                    </select>
                </div>
                <div class="form-group"><label>الكمية</label><input type="number" step="0.01" id="movementQty" required></div>
                <div class="form-group"><label>السبب (اختياري)</label><input type="text" id="movementReason"></div>
                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">تأكيد</button>
                    <button type="button" class="btn btn-secondary" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('stockForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await apiRequest(`/api/products/${productId}/stock-movement`, 'POST', {
                movement_type: document.getElementById('movementType').value,
                quantity: document.getElementById('movementQty').value,
                reason: document.getElementById('movementReason').value
            });
            overlay.remove();
            renderProducts();
        } catch (err) {
            alert(err.message);
        }
    });
}
