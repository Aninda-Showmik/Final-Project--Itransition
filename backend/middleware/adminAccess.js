module.exports = (req, res, next) => {
    // 1. Check if user exists on request (from auth middleware)
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
  
    // 2. Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Admin privileges required',
        currentRole: req.user.role // Helpful for debugging
      });
    }
  
    // 3. Proceed if admin
    next();
  };
