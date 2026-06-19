async function renderReports() {
    const content = document.getElementById('pageContent');
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().setDate(1)).toISOString().split('T')[0];

    content.innerHTML = `
        <div class="card">
            <h3 style="margin-bottom:14px;">💰 تقرير الإيرادات والمصروفات</h3>
            <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
                <input type="date" id="reportFrom" value="${monthStart}">
                <input type="date" id="reportTo" value="${today}">
                <button class="btn btn-primary" onclick="loadRevenueReport()">عرض التقرير</button>
            </div>
            <div id="revenueReportResult"></div>
        </div>
        <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3>📉 المصروفات</h3>
                <button class="btn btn-primary" onclick="showAddExpenseModal()">+ إضافة مصروف</button>
            </div>
            <div id="expensesList"></div>
        </div>
    `;

    loadRevenueReport();
    loadExpenses();
}

async function loadRevenueReport() {
    const from = document.getElementById('reportFrom').value;
    const to = document.getElementById('reportTo').value;
    try {
        const r = await apiRequest(`/api/reports/revenue?from=${from}&to=${to}`);
        document.getElementById('revenueReportResult').innerHTML = `
            <div class="grid-stats">
                <div class="stat-box">
                    <div class="stat-value">${formatCurrency(r.cafeRevenue)}</div>
                    <div class="stat-label">إيرادات الكافيه (${r.cafeOrdersCount} فيش)</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${formatCurrency(r.subscriptionRevenue)}</div>
                    <div class="stat-label">إيرادات الاشتراكات (${r.subscriptionsCount})</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${formatCurrency(r.totalRevenue)}</div>
                    <div class="stat-label">إجمالي الإيرادات</div>
                </div>
                <div class="stat-box danger">
                    <div class="stat-value">${formatCurrency(r.totalExpenses)}</div>
                    <div class="stat-label">إجمالي المصروفات</div>
                </div>
                <div class="stat-box" style="border-right-color:${r.netProfit >= 0 ? '#16a34a' : '#dc2626'}">
                    <div class="stat-value" style="color:${r.netProfit >= 0 ? '#16a34a' : '#dc2626'}">${formatCurrency(r.netProfit)}</div>
                    <div class="stat-label">صافي الربح</div>
                </div>
            </div>
        `;
    } catch (err) {
        document.getElementById('revenueReportResult').innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

async function loadExpenses() {
    try {
        const { expenses } = await apiRequest('/api/reports/expenses');
        document.getElementById('expensesList').innerHTML = `
            <div style="overflow-x:auto;">
            <table>
                <thead><tr><th>التاريخ</th><th>الفئة</th><th>الوصف</th><th>المبلغ</th><th></th></tr></thead>
                <tbody>
                    ${expenses.map(e => `
                        <tr>
                            <td>${formatDate(e.expense_date)}</td>
                            <td>${e.category}</td>
                            <td>${e.description || '-'}</td>
                            <td>${formatCurrency(e.amount)}</td>
                            <td><button class="btn btn-danger" onclick="deleteExpense(${e.id})">حذف</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        `;
    } catch (err) {
        document.getElementById('expensesList').innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

function showAddExpenseModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <h3 style="margin-bottom:16px;">إضافة مصروف</h3>
            <form id="expenseForm">
                <div class="form-group"><label>الفئة *</label><input type="text" id="expCategory" placeholder="رواتب / فواتير / صيانة..." required></div>
                <div class="form-group"><label>الوصف</label><input type="text" id="expDescription"></div>
                <div class="form-group"><label>المبلغ *</label><input type="number" step="0.01" id="expAmount" required></div>
                <div class="form-group"><label>التاريخ</label><input type="date" id="expDate" value="${new Date().toISOString().split('T')[0]}"></div>
                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">حفظ</button>
                    <button type="button" class="btn btn-secondary" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await apiRequest('/api/reports/expenses', 'POST', {
                category: document.getElementById('expCategory').value,
                description: document.getElementById('expDescription').value,
                amount: document.getElementById('expAmount').value,
                expense_date: document.getElementById('expDate').value
            });
            overlay.remove();
            loadExpenses();
            loadRevenueReport();
        } catch (err) {
            alert(err.message);
        }
    });
}

async function deleteExpense(id) {
    if (!confirm('تأكيد حذف المصروف؟')) return;
    try {
        await apiRequest(`/api/reports/expenses/${id}`, 'DELETE');
        loadExpenses();
        loadRevenueReport();
    } catch (err) {
        alert(err.message);
    }
}
