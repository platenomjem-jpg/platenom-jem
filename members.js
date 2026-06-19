async function renderMembers() {
    const content = document.getElementById('pageContent');
    try {
        const { members } = await apiRequest('/api/members');

        content.innerHTML = `
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                    <h3>👥 الأعضاء (${members.length})</h3>
                    <button class="btn btn-primary" onclick="showAddMemberModal()">+ إضافة عضو</button>
                </div>
                <input type="text" id="memberSearch" placeholder="بحث بالاسم أو الهاتف..." style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:14px;">
                <div style="overflow-x:auto;">
                <table>
                    <thead><tr><th>الاسم</th><th>الهاتف</th><th>الاشتراك الحالي</th><th>ينتهي في</th><th>الحالة</th><th></th></tr></thead>
                    <tbody id="membersTableBody">
                        ${members.map(m => renderMemberRow(m)).join('')}
                    </tbody>
                </table>
                </div>
            </div>
        `;

        document.getElementById('memberSearch').addEventListener('input', async (e) => {
            const data = await apiRequest('/api/members?search=' + encodeURIComponent(e.target.value));
            document.getElementById('membersTableBody').innerHTML = data.members.map(renderMemberRow).join('');
        });
    } catch (err) {
        content.innerHTML = `<p style="color:red;">خطأ: ${err.message}</p>`;
    }
}

function renderMemberRow(m) {
    const sub = m.latest_subscription;
    let statusBadge = '<span class="badge badge-danger">بدون اشتراك</span>';
    let endDate = '-';
    let planName = '-';

    if (sub) {
        planName = sub.plan_name;
        endDate = formatDate(sub.end_date);
        const isExpired = new Date(sub.end_date) < new Date();
        statusBadge = isExpired
            ? '<span class="badge badge-danger">منتهي</span>'
            : '<span class="badge badge-success">نشط</span>';
    }

    return `
        <tr>
            <td>${m.full_name}</td>
            <td>${m.phone || '-'}</td>
            <td>${planName}</td>
            <td>${endDate}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-secondary" onclick="showSubscribeModal(${m.id}, '${m.full_name}')">تجديد</button>
                <button class="btn btn-primary" onclick="checkInMember(${m.id})">حضور</button>
            </td>
        </tr>
    `;
}

function showAddMemberModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <h3 style="margin-bottom:16px;">إضافة عضو جديد</h3>
            <form id="addMemberForm">
                <div class="form-group"><label>الاسم الكامل *</label><input type="text" id="newFullName" required></div>
                <div class="form-group"><label>رقم الهاتف</label><input type="text" id="newPhone"></div>
                <div class="form-group"><label>الجنس</label>
                    <select id="newGender"><option value="male">ذكر</option><option value="female">أنثى</option></select>
                </div>
                <div class="form-group"><label>تاريخ الميلاد</label><input type="date" id="newBirthDate"></div>
                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">حفظ</button>
                    <button type="button" class="btn btn-secondary" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await apiRequest('/api/members', 'POST', {
                full_name: document.getElementById('newFullName').value,
                phone: document.getElementById('newPhone').value,
                gender: document.getElementById('newGender').value,
                birth_date: document.getElementById('newBirthDate').value || null
            });
            overlay.remove();
            renderMembers();
        } catch (err) {
            alert(err.message);
        }
    });
}

async function showSubscribeModal(memberId, memberName) {
    const { plans } = await apiRequest('/api/members/plans/all');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <h3 style="margin-bottom:16px;">تجديد اشتراك: ${memberName}</h3>
            <form id="subscribeForm">
                <div class="form-group">
                    <label>خطة الاشتراك</label>
                    <select id="planSelect">
                        ${plans.map(p => `<option value="${p.id}">${p.name} - ${formatCurrency(p.price)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>طريقة الدفع</label>
                    <select id="paymentMethod"><option value="cash">نقدي</option><option value="card">بطاقة</option></select>
                </div>
                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">تأكيد الاشتراك</button>
                    <button type="button" class="btn btn-secondary" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('subscribeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await apiRequest(`/api/members/${memberId}/subscribe`, 'POST', {
                plan_id: document.getElementById('planSelect').value,
                payment_method: document.getElementById('paymentMethod').value
            });
            overlay.remove();
            renderMembers();
        } catch (err) {
            alert(err.message);
        }
    });
}

async function checkInMember(memberId) {
    try {
        await apiRequest(`/api/members/${memberId}/checkin`, 'POST');
        alert('✅ تم تسجيل الحضور');
    } catch (err) {
        alert(err.message);
    }
}
