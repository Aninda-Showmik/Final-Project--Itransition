const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const formAccess = require('../middleware/formAccess');

// Constants
const MAX_ANSWERS_PER_FORM = 100; // Prevent abuse
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

/**
 * @route GET /api/forms/:id
 * @description Get form with answers
 * @access Authenticated user with form access
 */
router.get('/:id', authenticate, formAccess, async (req, res) => {
  try {
    const formId = parseInt(req.params.id);
    
    // Validate form ID
    if (isNaN(formId) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid form ID',
        code: 'INVALID_FORM_ID'
      });
    }

    // Fetch form and answers in parallel
    const [formResult, answersResult] = await Promise.all([
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

    // Check if form exists
    if (formResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Form not found',
        code: 'FORM_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        form: {
          ...formResult.rows[0],
          template_title: req.formData?.template_title // From middleware
        },
        answers: answersResult.rows
      }
    });

  } catch (err) {
    console.error('Failed to fetch form:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to load form data',
      code: 'SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

/**
 * @route POST /api/forms
 * @description Submit new form
 * @access Authenticated user
 */
router.post('/', authenticate, async (req, res) => {
  const { template_id, answers } = req.body;
  const userId = req.userId;

  // Input validation
  if (!template_id || !Array.isArray(answers)) {
    return res.status(400).json({ 
      success: false,
      message: 'template_id and answers array are required',
      code: 'INVALID_INPUT'
    });
  }

  // Prevent too many answers
  if (answers.length > MAX_ANSWERS_PER_FORM) {
    return res.status(400).json({
      success: false,
      message: `Maximum ${MAX_ANSWERS_PER_FORM} answers allowed per form`,
      code: 'ANSWER_LIMIT_EXCEEDED'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify template access
    const templateResult = await client.query(
      `SELECT is_public, user_id as owner_id FROM templates WHERE id = $1`,
      [template_id]
    );

    if (templateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false,
        message: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    const template = templateResult.rows[0];
    const isOwner = template.owner_id === userId;
    const isAdmin = req.userRole === 'admin';
    const isPublic = template.is_public;

    // Check access if not public template
    if (!isPublic && !isOwner && !isAdmin) {
      const accessResult = await client.query(
        `SELECT 1 FROM template_access 
         WHERE template_id = $1 AND user_id = $2`,
        [template_id, userId]
      );
      
      if (accessResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ 
          success: false,
          message: 'No access to this template',
          code: 'TEMPLATE_ACCESS_DENIED'
        });
      }
    }

    // Create form
    const formResult = await client.query(
      `INSERT INTO forms (template_id, user_id)
       VALUES ($1, $2) RETURNING id, created_at`,
      [template_id, userId]
    );
    const formId = formResult.rows[0].id;

    // Validate and insert answers
    const answerValues = answers.map(answer => {
      if (!answer.question_id || answer.value === undefined) {
        throw new Error('Invalid answer format');
      }
      return [formId, answer.question_id, answer.value];
    });

    await client.query(
      `INSERT INTO answers (form_id, question_id, value)
       SELECT * FROM UNNEST($1::int[], $2::int[], $3::text[])`,
      [
        answerValues.map(a => a[0]),
        answerValues.map(a => a[1]),
        answerValues.map(a => a[2])
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({ 
      success: true,
      message: 'Form submitted successfully',
      data: {
        formId,
        createdAt: formResult.rows[0].created_at
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Form submission error:', err);
    
    const statusCode = err.message.includes('Invalid answer format') ? 400 : 500;
    res.status(statusCode).json({ 
      success: false,
      message: statusCode === 400 ? 'Invalid answer format' : 'Failed to submit form',
      code: statusCode === 400 ? 'INVALID_ANSWER_FORMAT' : 'SUBMISSION_FAILED',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  } finally {
    client.release();
  }
});

/**
 * @route GET /api/forms
 * @description Get paginated forms for current user
 * @access Authenticated user
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_PAGE_SIZE, 
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * limit;

    // Get forms with template info
    const formsResult = await pool.query(
      `SELECT f.*, t.title as template_title 
       FROM forms f
       JOIN templates t ON f.template_id = t.id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );

    // Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM forms WHERE user_id = $1`,
      [req.userId]
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        forms: formsResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error('Failed to fetch forms:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to load forms',
      code: 'FETCH_FORMS_FAILED',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

module.exports = router;
