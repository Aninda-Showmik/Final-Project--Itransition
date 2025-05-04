const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting for template creation
const createTemplateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each user to 10 template creations per window
  keyGenerator: (req) => req.userId.toString(),
  message: 'Too many templates created, please try again later'
});

// Debug helper
const debugLog = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, data);
  }
};

// GET /api/templates - List all templates (user's templates + public ones)
router.get('/', authenticate, async (req, res) => {
  try {
    debugLog('Fetching templates for user', { userId: req.userId });
    
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
    res.json(templates);
  } catch (err) {
    console.error('Template list error:', err);
    res.status(500).json({ 
      message: 'Failed to fetch templates',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// GET /api/templates/manage - Admin template management
router.get('/manage', authenticate, async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
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

    res.json(templates);
  } catch (err) {
    console.error('Template management error:', err);
    res.status(500).json({
      message: 'Failed to fetch templates for management',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// GET /api/templates/:id - Get single template
router.get('/:id', authenticate, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId) || templateId <= 0) {
      return res.status(400).json({ message: 'Invalid template ID' });
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
      return res.status(404).json({ message: 'Template not found' });
    }

    // Authorization check
    if (template.userId !== req.userId && !template.isPublic && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this template' });
    }

    res.json(template);
  } catch (err) {
    console.error('Template fetch error:', err);
    res.status(500).json({ 
      message: 'Failed to fetch template',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// POST /api/templates - Create new template
router.post('/', authenticate, createTemplateLimiter, async (req, res) => {
  try {
    debugLog('Create template request', { 
      userId: req.userId, 
      body: req.body 
    });

    const { title, description, topic = 'Other', isPublic = false } = req.body;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const validTopics = ['Education', 'Quiz', 'Other'];
    if (!validTopics.includes(topic)) {
      return res.status(400).json({ message: 'Invalid topic' });
    }

    const { rows: [newTemplate] } = await pool.query(
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

    debugLog('Template created successfully', { templateId: newTemplate.id });
    res.status(201).json(newTemplate);
  } catch (err) {
    console.error('Template creation error:', err);
    res.status(500).json({ 
      message: 'Failed to create template',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// PUT /api/templates/:id - Update template
router.put('/:id', authenticate, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId) || templateId <= 0) {
      return res.status(400).json({ message: 'Invalid template ID' });
    }

    debugLog('Update template request', { 
      templateId, 
      userId: req.userId,
      body: req.body
    });

    const { rows: [existing] } = await pool.query(
      'SELECT user_id FROM templates WHERE id = $1',
      [templateId]
    );

    if (!existing) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (existing.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this template' });
    }

    const { title, description, topic, isPublic } = req.body;
    
    const validTopics = ['Education', 'Quiz', 'Other'];
    if (topic && !validTopics.includes(topic)) {
      return res.status(400).json({ message: 'Invalid topic' });
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE templates SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        topic = COALESCE($3, topic),
        is_public = COALESCE($4, is_public),
        updated_at = NOW()
      WHERE id = $5
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
        title ? title.trim() : null,
        description ? description.trim() : null,
        topic,
        isPublic !== undefined ? Boolean(isPublic) : null,
        templateId
      ]
    );

    debugLog('Template updated successfully', { templateId });
    res.json(updated);
  } catch (err) {
    console.error('Template update error:', err);
    res.status(500).json({ 
      message: 'Failed to update template',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId) || templateId <= 0) {
      return res.status(400).json({ message: 'Invalid template ID' });
    }

    debugLog('Delete template request', { templateId, userId: req.userId });

    const { rows: [existing] } = await pool.query(
      'SELECT user_id FROM templates WHERE id = $1',
      [templateId]
    );

    if (!existing) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (existing.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this template' });
    }

    await pool.query('DELETE FROM templates WHERE id = $1', [templateId]);
    
    debugLog('Template deleted successfully', { templateId });
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    console.error('Template deletion error:', err);
    res.status(500).json({ 
      message: 'Failed to delete template',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// GET /api/templates/:id/questions - Get all questions for a template
router.get('/:id/questions', authenticate, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId) || templateId <= 0) {
      return res.status(400).json({ message: 'Invalid template ID' });
    }

    // Verify template access
    const { rows: [template] } = await pool.query(
      `SELECT user_id, is_public FROM templates WHERE id = $1`,
      [templateId]
    );

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (template.user_id !== req.userId && !template.is_public && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view these questions' });
    }

    const { rows: questions } = await pool.query(
      `SELECT 
        id,
        template_id as "templateId",
        type,
        title,
        description,
        position,
        config
      FROM questions 
      WHERE template_id = $1
      ORDER BY position ASC`,
      [templateId]
    );

    res.json(questions);
  } catch (err) {
    console.error('Questions fetch error:', err);
    res.status(500).json({ 
      message: 'Failed to fetch questions',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// POST /api/templates/:id/questions - Add a question to a template
router.post('/:id/questions', authenticate, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId) || templateId <= 0) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const validTypes = ['text', 'textarea', 'number', 'checkbox', 'select'];
    if (!validTypes.includes(req.body.type)) {
      return res.status(400).json({ error: 'Invalid question type' });
    }

    if (!req.body.title || req.body.title.trim().length === 0) {
      return res.status(400).json({ error: 'Question title is required' });
    }

    const { rows: [template] } = await pool.query(
      `SELECT user_id FROM templates WHERE id = $1`,
      [templateId]
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to add questions to this template' });
    }

    const positionResult = await pool.query(
      'SELECT COUNT(*) FROM questions WHERE template_id = $1',
      [templateId]
    );

    const position = parseInt(positionResult.rows[0].count) + 1;

    const { rows } = await pool.query(
      `INSERT INTO questions 
       (template_id, type, title, description, position, config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        templateId,
        req.body.type,
        req.body.title.trim(),
        req.body.description ? req.body.description.trim() : null,
        position,
        req.body.config || null
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Add question error:', err);
    res.status(500).json({
      message: 'Failed to add question',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// PUT /api/templates/:id/questions/order - Update question order
router.put('/:id/questions/order', authenticate, async (req, res) => {
  let client;
  try {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId) || templateId <= 0) {
      return res.status(400).json({ message: 'Invalid template ID' });
    }

    const { questionIds } = req.body;
    if (!Array.isArray(questionIds)) {
      return res.status(400).json({ message: 'questionIds must be an array' });
    }

    // Verify template ownership
    client = await pool.connect();
    await client.query('BEGIN');

    const { rows: [template] } = await client.query(
      'SELECT user_id FROM templates WHERE id = $1 FOR UPDATE',
      [templateId]
    );

    if (!template) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Template not found' });
    }

    if (template.user_id !== req.userId && req.userRole !== 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Verify all questions belong to this template
    const { rows } = await client.query(
      `SELECT COUNT(*) FROM questions 
       WHERE id = ANY($1::int[]) AND template_id = $2`,
      [questionIds, templateId]
    );

    if (parseInt(rows[0].count) !== questionIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid question IDs' });
    }

    // Update positions
    for (let i = 0; i < questionIds.length; i++) {
      await client.query(
        'UPDATE questions SET position = $1 WHERE id = $2',
        [i + 1, questionIds[i]]
      );
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Question order updated' });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    console.error('Question reorder error:', err);
    res.status(500).json({ 
      message: 'Failed to update question order',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Unhandled route error:', err);
  res.status(500).json({ 
    message: 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { 
      error: err.message,
      stack: err.stack 
    })
  });
});

module.exports = router;