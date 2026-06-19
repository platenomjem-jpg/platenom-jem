async function renderDashboard() {
    const content = document.getElementById('pageContent');
    try {
        const { dashboard } = await apiRequest('/api/reports/dashboard');

        content.innerHTML = `
            <div class="grid-stats">
                <div class="stat-box">
                    <div class="stat-value">${formatCurrency(dashboard.cafeRevenueToday)}</div>
                    <div class="stat-label">إيرادات الكافيه اليوم</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${formatCurrency(dashboard.subscriptionRevenueToday)}</div>
                    <div class="stat-label">إيرادات الاشتراكات اليوم</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${dashboard.activeMembers}</div>
                    <div class="stat-label">الأعضاء النشطون</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${dashboard.attendanceToday}</div>
                    <div class="stat-label">حضور اليوم</div>
                </div>
                <div class="stat-box warning">
                    <div class="stat-value">${dashboard.expiringSoonCount}</div>
                    <div class="stat-label">اشتراكات تنتهي قريباً (7 أيام)</div>
                </div>
                <div class="stat-box danger">
                    <div class="stat-value">${dashboard.lowStockCount}</div>
                    <div class="stat-label">منتجات منخفضة المخزون</div>
                </div>
            </div>
            <div class="card">
                <p style="color:#6b7280;font-size:14px;">
                    👋 مرحباً بك في نظام إدارة النادي الرياضي والكافيه. استخدم القائمة أعلاه للتنقل بين الأعضاء، نقطة البيع، المخزون، والتقارير.
                </p>
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<p style="color:red;">خطأ في تحميل لوحة التحكم: ${err.message}</p>`;
    }
}
