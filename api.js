// دوال مساعدة عامة للتواصل مع API
async function apiRequest(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' // مهم: لإرسال كوكي الجلسة
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || 'حدث خطأ');
    }
    return data;
}

function formatCurrency(num) {
    return parseFloat(num).toLocaleString('ar-IQ') + ' د.ع';
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('ar-IQ');
}
