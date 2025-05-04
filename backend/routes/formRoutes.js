const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const formAccess = require('../middleware/formAccess');

// Get form with answers
router.get('/:id', authenticate, formAccess, async (req, res) => {
  try {
    const formId = parseInt(req.params.id);
    if (isNaN(formId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid form ID' 
      });
    }

    const [form, answers] = await Promise.all([
      pool.query('SELECT * FROM forms WHERE id = $1', [formId]),
      pool.query(
        `SELECT a.id, a.value, q.title as question, q.type as question_type
         FROM answers a
         JOIN questions q ON a.question_id = q.id
         WHERE a.form_id = $1
         ORDER BY q.position`,
        [formId]
      )
    ]);

    if (form.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Form not found' 
      });
    }

    res.json({
      success: true,
      form: {
        ...form.rows[0],
        template_title: req.formData.template_title
      },
      answers: answers.rows
    });
  } catch (err) {
    console.error('Failed to fetch form:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to load form data',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Submit new form
router.post('/', authenticate, async (req, res) => {
  const { template_id, answers } = req.body;
  const userId = req.userId; // Changed from req.user.id to req.userId

  // Input validation
  if (!template_id || !Array.isArray(answers)) {
    return res.status(400).json({ 
      success: false,
      message: 'template_id and answers array are required' 
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify template access
    const template = await client.query(
      `SELECT is_public, user_id as owner_id FROM templates WHERE id = $1`,
      [template_id]
    );

    if (template.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false,
        message: 'Template not found' 
      });
    }

    const isOwner = template.rows[0].owner_id === userId;
    const isAdmin = req.userRole === 'admin';
    const isPublic = template.rows[0].is_public;

    if (!isPublic && !isOwner && !isAdmin) {
      const access = await client.query(
        `SELECT 1 FROM template_access 
         WHERE template_id = $1 AND user_id = $2`,
        [template_id, userId]
      );
      if (access.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ 
          success: false,
          message: 'No access to this template' 
        });
      }
    }

    // Create form
    const form = await client.query(
      `INSERT INTO forms (template_id, user_id)
       VALUES ($1, $2) RETURNING *`,
      [template_id, userId]
    );

    // Validate and insert answers
    const answerPromises = answers.map(async (answer) => {
      if (!answer.question_id || answer.value === undefined) {
        throw new Error('Invalid answer format');
      }
      
      return client.query(
        `INSERT INTO answers (form_id, question_id, value)
         VALUES ($1, $2, $3)`,
        [form.rows[0].id, answer.question_id, answer.value]
      );
    });

    await Promise.all(answerPromises);
    await client.query('COMMIT');

    res.status(201).json({ 
      success: true,
      message: 'Form submitted successfully',
      formId: form.rows[0].id
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Form submission error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to submit form',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    client.release();
  }
});

// Get all forms for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.*, t.title as template_title 
       FROM forms f
       JOIN templates t ON f.template_id = t.id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.userId]
    );

    res.json({
      success: true,
      forms: rows
    });
  } catch (err) {
    console.error('Failed to fetch forms:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to load forms',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;