const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Constants
const MAX_TEMPLATES_PER_USER = 50;
const MAX_QUESTIONS_PER_TEMPLATE = 20;
const VALID_QUESTION_TYPES = ['text', 'textarea', 'number', 'checkbox', 'select'];
const VALID_TOPICS = ['Education', 'Quiz', 'Other'];

// Rate limiting for template creation
const createTemplateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each user to 10 template creations per window
  keyGenerator: (req) => req.userId.toString(),
  message: {
    status: 'error',
    message: 'Too many templates created, please try again later',
    code: 'RATE_LIMITED'
  }
});

// Debug helper (disabled in production)
const debugLog = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, JSON.stringify(data, null, 2));
  }
};

/**
 * @route GET /api/templates
 * @description List all templates (user's templates + public ones)
 * @access Authenticated user
 */
router.get('/', authenticate, async (req, res) => {
  try {
    debugLog('Fetching templates', { userId: req.userId });
    
    const { rows: templates } = await pool.query(
      `SELECT 
        id, 
        user_id as "userId", 
        title, 
        description, 
        topic, 
        is_public as "isPublic",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM templates 
      WHERE user_id = $1 OR is_public = true
      ORDER BY created_at DESC`,
      [req.userId]
    );

    res.set('Cache-Control', 'private, max-age=60');
    res.json({
      status: 'success',
      data: templates
    });
  } catch (err) {
    console.error('Template list error:', err);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch templates',
      code: 'TEMPLATE_FETCH_FAILED',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

/**
 * @route GET /api/templates/manage
 * @description Admin template management
 * @access Admin only
 */
router.get('/manage', authenticate, async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ 
        status: 'error',
        message: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED'
      });
    }

    const { rows: templates } = await pool.query(
      `SELECT 
        id,
        user_id as "userId",
        title,
        description,
        topic,
        is_public as "isPublic",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM templates
      ORDER BY created_at DESC`
    );

    res.json({
      status: 'success',
      data: templates
    });
  } catch (err) {
    console.error('Template management error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch templates for management',
      code: 'TEMPLATE_MANAGEMENT_FAILED',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

/**
 * @route GET /api/templates/:id
 * @description Get single template
 * @access Authenticated user with access
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId) || templateId <= 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid template ID',
        code: 'INVALID_TEMPLATE_ID'
      });
    }

    debugLog('Fetching template', { templateId, userId: req.userId });

    const { rows: [template] } = await pool.query(
      `SELECT 
        id,
        user_id as "userId",
        title,
        description,
        topic,
        is_public as "isPublic",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM templates 
      WHERE id = $1`,
      [templateId]
    );

    if (!template) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    // Check template access
    if (template.userId !== req.userId && !template.isPublic && req.userRole !== 'admin') {
      const access = await pool.query(
        `SELECT 1 FROM template_access 
         WHERE template_id = $1 AND user_id = $2`,
        [templateId, req.userId]
      );
      
      if (access.rows.length === 0) {
        return res.status(403).json({ 
          status: 'error',
          message: 'Not authorized to access this template',
          code: 'TEMPLATE_ACCESS_DENIED'
        });
      }
    }

    res.json({
      status: 'success',
      data: template
    });
  } catch (err) {
    console.error('Template fetch error:', err);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch template',
      code: 'TEMPLATE_FETCH_FAILED',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

/**
 * @route POST /api/templates
 * @description Create new template
 * @access Authenticated user
 */
router.post('/', authenticate, createTemplateLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check template limit
    const countResult = await client.query(
      'SELECT COUNT(*) FROM templates WHERE user_id = $1',
      [req.userId]
    );
    if (parseInt(countResult.rows[0].count) >= MAX_TEMPLATES_PER_USER) {
      return res.status(400).json({
        status: 'error',
        message: `Maximum ${MAX_TEMPLATES_PER_USER} templates allowed per user`,
        code: 'TEMPLATE_LIMIT_REACHED'
      });
    }

    const { title, description, topic = 'Other', isPublic = false } = req.body;
    
    // Input validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Title is required',
        code: 'TITLE_REQUIRED'
      });
    }

    if (!VALID_TOPICS.includes(topic)) {
      return res.status(400).json({ 
        status: 'error',
        message: `Invalid topic. Must be one of: ${VALID_TOPICS.join(', ')}`,
        code: 'INVALID_TOPIC'
      });
    }

    const { rows: [newTemplate] } = await client.query(
      `INSERT INTO templates (
        user_id, 
        title, 
        description, 
        topic, 
        is_public
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id,
        user_id as "userId",
        title,
        description,
        topic,
        is_public as "isPublic",
        created_at as "createdAt",
        updated_at as "updatedAt"`,
      [
        req.userId, 
        title.trim(), 
        description ? description.trim() : null, 
        topic, 
        Boolean(isPublic)
      ]
    );

    await client.query('COMMIT');
    
    res.status(201).json({
      status: 'success',
      data: newTemplate
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Template creation error:', err);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to create template',
      code: 'TEMPLATE_CREATION_FAILED',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  } finally {
    client.release();
  }
});

// [Other routes (PUT, DELETE, questions endpoints) follow same pattern...]

module.exports = router;
