module.exports = (req, res, next) => {
  // 1. Deep check for valid user object
  if (!req.user?.role || !req.user?.id) {
    return res.status(401).json({ 
      code: 'INVALID_AUTH_PAYLOAD',
      message: 'Malformed authentication data' 
    });
  }

  // 2. Role validation with enum check
  const ADMIN_ROLE = 'admin';
  if (req.user.role !== ADMIN_ROLE) {
    console.warn(`Admin access attempt by ${req.user.role} user`, {
      userId: req.user.id,
      endpoint: req.originalUrl,
      timestamp: new Date().toISOString()
    });

    return res.status(403).json({
      code: 'INSUFFICIENT_PRIVILEGES',
      message: 'Requires ADMIN role',
      requiredRole: ADMIN_ROLE,
      currentRole: req.user.role,
      supportContact: process.env.SUPPORT_EMAIL || 'admin@example.com'
    });
  }

  // 3. Additional security checks
  if (req.user.isSuspended) {
    return res.status(403).json({
      code: 'ACCOUNT_SUSPENDED',
      message: 'Admin account is suspended'
    });
  }

  next();
};
