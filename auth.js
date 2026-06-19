let currentUser = null;

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    try {
        const data = await apiRequest('/api/auth/login', 'POST', { username, password });
        currentUser = data.user;
        showApp();
    } catch (err) {
        errorEl.textContent = err.message;
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await apiRequest('/api/auth/logout', 'POST');
    currentUser = null;
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
});

function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    document.getElementById('userName').textContent = `${currentUser.fullName} (${roleLabel(currentUser.role)})`;
    loadPage('dashboard');
}

function roleLabel(role) {
    const labels = { admin: 'مدير', receptionist: 'استقبال', cashier: 'كاشير', accountant: 'محاسب' };
    return labels[role] || role;
}

// التحقق من وجود جلسة فعالة عند فتح الصفحة (بدون الحاجة لتسجيل دخول جديد كل مرة)
(async function checkSession() {
    try {
        const data = await apiRequest('/api/auth/me');
        currentUser = data.user;
        showApp();
    } catch (err) {
        // لا يوجد جلسة فعالة، يبقى على شاشة تسجيل الدخول
    }
})();
