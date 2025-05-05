const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const formAccess = require('../middleware/formAccess');

// Get form with answers
router.get('/:id', authenticate, formAccess, async (req, res) => {
  const formId = req.params.id;

  // Validate formId is a number
  if (isNaN(formId)) {
    return res.status(400).json({ message: 'Invalid form ID' });
  }

  try {
    const answers = await pool.query(
      `SELECT 
        a.id, 
        a.value, 
        q.title AS question, 
        q.type AS question_type
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE a.form_id = $1
       ORDER BY q.position`,
      [formId]
    );

    res.json({
      form: req.formData,  // Assuming formAccess middleware attaches this
      answers: answers.rows
    });

  } catch (err) {
    console.error('Failed to fetch form:', err);
    res.status(500).json({ message: 'Failed to load form data' });
  }
});

// Submit new form
router.post('/', authenticate, async (req, res) => {
  const { template_id, answers } = req.body;
  const userId = req.user.id;

  // Input validation
  if (!template_id || !Array.isArray(answers)) {
    return res.status(400).json({ message: 'Invalid request data' });
  }

  try {
    // Verify template exists and check access
    const templateQuery = await pool.query(
      `SELECT is_public FROM templates WHERE id = $1`,
      [template_id]
    );

    if (templateQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const template = templateQuery.rows[0];

    // Check template access if not public
    if (!template.is_public) {
      const accessQuery = await pool.query(
        `SELECT 1 FROM template_access 
         WHERE template_id = $1 AND user_id = $2`,
        [template_id, userId]
      );
      
      if (accessQuery.rows.length === 0) {
        return res.status(403).json({ message: 'No access to this template' });
      }
    }

    // Start transaction for atomic operations
    await pool.query('BEGIN');

    // Create form
    const formQuery = await pool.query(
      `INSERT INTO forms (template_id, user_id)
       VALUES ($1, $2) RETURNING id`,
      [template_id, userId]
    );
    const formId = formQuery.rows[0].id;

    // Insert answers
    for (const answer of answers) {
      if (!answer.question_id || answer.value === undefined) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Missing answer data' });
      }

      await pool.query(
        `INSERT INTO answers (form_id, question_id, value)
         VALUES ($1, $2, $3)`,
        [formId, answer.question_id, answer.value]
      );
    }

    await pool.query('COMMIT');
    res.status(201).json({ 
      message: 'Form submitted successfully',
      formId: formId
    });

  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {}); // Silent fail if no transaction
    console.error('Form submission error:', err);
    res.status(500).json({ message: 'Failed to submit form' });
  }
});

module.exports = router;
