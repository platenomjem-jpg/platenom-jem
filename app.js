document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadPage(btn.dataset.page);
    });
});

function loadPage(page) {
    const content = document.getElementById('pageContent');
    content.innerHTML = '<p style="text-align:center;padding:40px;color:#9ca3af;">جاري التحميل...</p>';

    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'members': renderMembers(); break;
        case 'pos': renderPOS(); break;
        case 'products': renderProducts(); break;
        case 'reports': renderReports(); break;
        default: content.innerHTML = '<p>الصفحة غير موجودة</p>';
    }
}
