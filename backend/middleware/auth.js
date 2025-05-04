const jwt = require('jsonwebtoken');
const pool = require('../config/db');

module.exports = async (req, res, next) => {
  try {
    // 1. Extract token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error('Missing token');

    // 2. Verify token (with explicit expiry check)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { 
      ignoreExpiration: false 
    });

    // 3. Validate user exists
    const { rows: [user] } = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (!user) throw new Error('User not found');

    // 4. Attach user data
    req.user = user;
    req.userId = user.id;
    req.userRole = user.role;

    next();
  } catch (err) {
    console.error('Auth Middleware:', {
      error: err.message,
      path: req.path,
      token: token ? `${token.slice(0, 5)}...${token.slice(-5)}` : null
    });

    const message = err.name === 'TokenExpiredError' 
      ? 'Token expired' 
      : 'Invalid token';
    
    res.status(401).json({ 
      message,
      ...(process.env.NODE_ENV === 'development' && { detail: err.message }) 
    });
  }
};