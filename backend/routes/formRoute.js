const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const formAccess = require('../middleware/formAccess');

// Get form with answers
router.get('/:id', authenticate, formAccess, async (req, res) => {
  try {
    const answers = await pool.query(
      `SELECT a.id, a.value, q.title as question, q.type as question_type
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE a.form_id = $1
       ORDER BY q.position`,
      [req.params.id]
    );

    res.json({
      form: req.formData,
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

  try {
    // Verify template access first
    const template = await pool.query(
      `SELECT is_public FROM templates WHERE id = $1`,
      [template_id]
    );

    if (template.rows.length === 0) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (!template.rows[0].is_public) {
      const access = await pool.query(
        `SELECT 1 FROM template_access 
         WHERE template_id = $1 AND user_id = $2`,
        [template_id, userId]
      );
      if (access.rows.length === 0) {
        return res.status(403).json({ message: 'No access to this template' });
      }
    }

    // Create form
    const form = await pool.query(
      `INSERT INTO forms (template_id, user_id)
       VALUES ($1, $2) RETURNING *`,
      [template_id, userId]
    );

    // Insert answers
    for (const answer of answers) {
      await pool.query(
        `INSERT INTO answers (form_id, question_id, value)
         VALUES ($1, $2, $3)`,
        [form.rows[0].id, answer.question_id, answer.value]
      );
    }

    res.status(201).json({ 
      message: 'Form submitted successfully',
      formId: form.rows[0].id
    });
  } catch (err) {
    console.error('Form submission error:', err);
    res.status(500).json({ message: 'Failed to submit form' });
  }
});

module.exports = router;