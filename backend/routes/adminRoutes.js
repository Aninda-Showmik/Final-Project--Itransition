const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authenticate = require('../middleware/auth');
const adminAccess = require('../middleware/adminAccess');

// Constants
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const VALID_ROLES = ['admin', 'user'];
const MIN_SEARCH_CHARS = 3;

// Apply middleware
router.use(authenticate);
router.use(adminAccess);

/**
 * @route GET /api/admin/health
 * @description Database health check
 */
router.get('/health', async (req, res) => {
  try {
    await User.db.db.admin().ping();
    res.json({
      status: 'OK',
      dbState: User.db.readyState,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(503).json({
      status: 'DB_ERROR',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * @route GET /api/admin/users
 * @description Get paginated users with enhanced validation
 */
router.get('/users', async (req, res) => {
  try {
    // Validate and sanitize inputs
    const page = Math.max(DEFAULT_PAGE, parseInt(req.query.page) || DEFAULT_PAGE);
    const limit = Math.min(
      MAX_LIMIT, 
      Math.max(1, parseInt(req.query.limit) || DEFAULT_LIMIT
    );
    const offset = Math.max(0, (page - 1) * limit);

    // Execute parallel queries
    const [users, total] = await Promise.all([
      User.find()
        .select('-password -__v -refreshToken')
        .skip(offset)
        .limit(limit)
        .lean(),
      User.countDocuments()
    ]);

    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] User list error:`, err);
    res.status(500).json({
      message: 'Failed to fetch users',
      requestId: req.id,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
});

/**
 * @route PUT /api/admin/users/:id/role
 * @description Update user role with safety checks
 */
router.put('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate input
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
      });
    }

    // Security checks
    if (id === req.user.id && role === 'user') {
      return res.status(403).json({
        message: 'Cannot remove your own admin privileges'
      });
    }

    const adminCount = await User.countDocuments({ role: 'admin' });
    if (role === 'user' && adminCount <= 1) {
      return res.status(403).json({
        message: 'System must maintain at least one admin'
      });
    }

    // Update with atomic operation
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    ).select('-password -__v -refreshToken');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: `Successfully updated role to ${role}`,
      user: updatedUser
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Role update error:`, {
      params: req.params,
      error: err.stack
    });
    
    const status = err.name === 'CastError' ? 400 : 500;
    res.status(status).json({
      message: 'Role update failed',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

/**
 * @route GET /api/admin/users/search
 * @description Search users with validation
 */
router.get('/users/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < MIN_SEARCH_CHARS) {
      return res.status(400).json({
        message: `Search query requires at least ${MIN_SEARCH_CHARS} characters`
      });
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    })
    .select('-password -__v -refreshToken')
    .limit(50);

    res.json({
      count: users.length,
      results: users
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Search error:`, err);
    res.status(500).json({
      message: 'Search failed',
      requestId: req.id
    });
  }
});

module.exports = router;
