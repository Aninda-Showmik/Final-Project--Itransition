const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authenticate = require('../middleware/auth');
const adminAccess = require('../middleware/adminAccess');

// Apply admin middleware globally to all routes
router.use(authenticate);
router.use(adminAccess);

// Constants for pagination and role validation
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const VALID_ROLES = ['admin', 'user'];
const MIN_SEARCH_CHARS = 3;

// Get all users (paginated)
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || DEFAULT_PAGE;
    const limit = parseInt(req.query.limit) || DEFAULT_LIMIT;
    const offset = (page - 1) * limit;
    
    // Validate pagination parameters
    if (page < 1 || limit < 1) {
      return res.status(400).json({ message: 'Invalid pagination parameters' });
    }

    const [users, totalUsers] = await Promise.all([
      User.getPaginatedUsers(limit, offset),
      User.getTotalUserCount()
    ]);
    
    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total: parseInt(totalUsers),
        totalPages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (err) {
    console.error('Admin user list error:', err);
    res.status(500).json({ 
      message: 'Failed to fetch users',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// Promote/demote users with enhanced validation
router.put('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    // Validate role
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }

    // Prevent self-demotion
    if (id === req.user.id && role === 'user') {
      return res.status(403).json({ 
        message: 'Cannot remove your own admin privileges' 
      });
    }

    // Check minimum admin count
    if (role === 'user') {
      const adminCount = await User.getAdminCount();
      if (adminCount <= 1) {
        return res.status(403).json({ 
          message: 'System must have at least one admin' 
        });
      }
    }

    const updatedUser = await User.setUserRole(id, role);
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      message: `User role updated to ${role}`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      }
    });
    
  } catch (err) {
    console.error('Role update error:', err);
    res.status(500).json({ 
      message: 'Failed to update user role',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// Enhanced user search with validation
router.get('/users/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < MIN_SEARCH_CHARS) {
      return res.status(400).json({ 
        message: `Search query must be at least ${MIN_SEARCH_CHARS} characters` 
      });
    }
    
    const users = await User.searchUsers(query);
    res.json({
      count: users.length,
      results: users
    });
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ 
      message: 'Search failed',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

module.exports = router;
