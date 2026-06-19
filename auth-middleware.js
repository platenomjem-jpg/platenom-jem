// middleware للتحقق من أن المستخدم مسجل دخول
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول أولاً' });
}

// middleware للتحقق من الصلاحية (دور واحد أو أكثر مسموح لهم)
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول أولاً' });
        }
        if (!allowedRoles.includes(req.session.role)) {
            return res.status(403).json({ success: false, message: 'لا تملك صلاحية الوصول لهذه الميزة' });
        }
        return next();
    };
}

module.exports = { requireAuth, requireRole };
