const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authenticate = require('../middleware/auth');
const adminAccess = require('../middleware/adminAccess');

// Apply admin middleware globally to all routes in this file
router.use(authenticate);
router.use(adminAccess);

// Get all users (paginated)
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const users = await User.getPaginatedUsers(limit, offset);
    const totalUsers = await User.getTotalUserCount();
    
    res.json({
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalUsers),
        totalPages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (err) {
    console.error('Admin user list error:', err);
    res.status(500).json({ 
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Promote/demote users with validation
router.put('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    // Validate role
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    // Prevent self-demotion
    if (id === req.user.id && role === 'user') {
      return res.status(403).json({ message: 'Cannot remove your own admin privileges' });
    }

    // Check minimum admin count
    if (role === 'user') {
      const adminCount = await User.getAdminCount();
      if (adminCount <= 1) {
        return res.status(403).json({ message: 'System must have at least one admin' });
      }
    }

    await User.setUserRole(id, role);
    
    res.json({ 
      message: `User role updated to ${role}`,
      newRole: role
    });
    
  } catch (err) {
    console.error('Role update error:', err);
    res.status(400).json({ 
      message: 'Failed to update user role',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Enhanced user search
router.get('/users/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 3) {
      return res.status(400).json({ message: 'Search query must be at least 3 characters' });
    }
    
    const users = await User.searchUsers(query);
    res.json(users);
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ message: 'Search failed' });
  }
});

module.exports = router;