//devRoute.js

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Development Mode Check Middleware
const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ 
      message: 'Development routes are only available in development mode',
      currentEnv: process.env.NODE_ENV || 'development'
    });
  }
  next();
};

// JWT Generator Helper
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      role: user.role || 'user',
      email: user.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * @route GET /api/dev/test-data
 * @description Create complete test environment
 * @access Development only
 */
router.get('/test-data', devOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Clean existing test data
    await client.query(`
      DELETE FROM answers WHERE form_id IN (
        SELECT id FROM forms WHERE user_id IN (
          SELECT id FROM users WHERE email LIKE 'test%@example.com'
        )
      )
    `);
    await client.query(`
      DELETE FROM forms WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE 'test%@example.com'
      )
    `);
    await client.query(`
      DELETE FROM questions WHERE template_id IN (
        SELECT id FROM templates WHERE title LIKE 'Test Template%'
      )
    `);
    await client.query(`
      DELETE FROM templates WHERE title LIKE 'Test Template%'
    `);
    await client.query(`
      DELETE FROM users WHERE email LIKE 'test%@example.com'
    `);

    // 2. Create test users
    const hashedPassword = await bcrypt.hash('test1234', 10);
    const testUsers = await client.query(`
      INSERT INTO users (id, name, email, password, role)
      VALUES 
        (998, 'Test Admin', 'testadmin@example.com', $1, 'admin'),
        (999, 'Test User', 'testuser@example.com', $1, 'user')
      RETURNING *
    `, [hashedPassword]);

    // 3. Create test template
    const testTemplate = await client.query(`
      INSERT INTO templates (id, user_id, title, description, is_public)
      VALUES (999, 998, 'Test Template', 'Sample template for development', true)
      RETURNING *
    `);

    // 4. Add questions
    const testQuestions = await client.query(`
      INSERT INTO questions (template_id, type, title, description, position)
      VALUES 
        (999, 'text', 'Full Name', 'Enter your full name', 1),
        (999, 'textarea', 'Feedback', 'Your detailed feedback', 2),
        (999, 'number', 'Rating', 'Rate from 1-10', 3),
        (999, 'checkbox', 'Subscribe', 'Receive newsletter', 4)
      RETURNING id, type, title
    `);

    // 5. Create test form submission
    const testForm = await client.query(`
      INSERT INTO forms (id, template_id, user_id)
      VALUES (999, 999, 999)
      RETURNING *
    `);

    // 6. Add answers
    await client.query(`
      INSERT INTO answers (form_id, question_id, value)
      VALUES 
        (999, ${testQuestions.rows[0].id}, 'John Doe'),
        (999, ${testQuestions.rows[1].id}, 'This is a test submission'),
        (999, ${testQuestions.rows[2].id}, '9'),
        (999, ${testQuestions.rows[3].id}, 'true')
    `);

    await client.query('COMMIT');

    // Generate tokens
    const adminUser = testUsers.rows.find(u => u.role === 'admin');
    const regularUser = testUsers.rows.find(u => u.role === 'user');

    res.json({
      status: 'success',
      users: {
        admin: {
          id: adminUser.id,
          email: adminUser.email,
          password: 'test1234',
          token: generateToken(adminUser)
        },
        user: {
          id: regularUser.id,
          email: regularUser.email,
          password: 'test1234',
          token: generateToken(regularUser)
        }
      },
      resources: {
        template: {
          id: testTemplate.rows[0].id,
          title: testTemplate.rows[0].title
        },
        questions: testQuestions.rows,
        form: {
          id: testForm.rows[0].id,
          answers: 4
        }
      },
      endpoints: {
        getTemplate: `/api/templates/${testTemplate.rows[0].id}`,
        getForm: `/api/forms/${testForm.rows[0].id}`,
        adminPanel: '/admin' 
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Test data creation failed:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create test environment',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  } finally {
    client.release();
  }
});

/**
 * @route GET /api/dev/reset
 * @description Reset all test data
 * @access Development only
 */
router.get('/reset', devOnly, async (req, res) => {
  try {
    await pool.query(`
      WITH deleted AS (
        DELETE FROM users 
        WHERE email LIKE 'test%@example.com'
        RETURNING id
      )
      SELECT COUNT(*) FROM deleted
    `);

    res.json({
      status: 'success',
      message: 'All test data has been reset'
    });
  } catch (err) {
    console.error('Reset failed:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset test data',
      error: err.message
    });
  }
});

/**
 * @route GET /api/dev/db-stats
 * @description Get database statistics
 * @access Development only
 */
router.get('/db-stats', devOnly, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM templates) AS templates,
        (SELECT COUNT(*) FROM questions) AS questions,
        (SELECT COUNT(*) FROM forms) AS forms,
        (SELECT COUNT(*) FROM answers) AS answers
    `);

    const testData = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE email LIKE 'test%@example.com') AS test_users,
        (SELECT COUNT(*) FROM templates WHERE title LIKE 'Test%') AS test_templates
    `);

    res.json({
      status: 'success',
      totals: stats.rows[0],
      test_data: testData.rows[0]
    });
  } catch (err) {
    console.error('DB stats error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get database statistics'
    });
  }
});

/**
 * @route POST /api/dev/generate
 * @description Generate bulk test data
 * @access Development only
 */
router.post('/generate', devOnly, async (req, res) => {
  const { users = 5, templates = 3, formsPerTemplate = 2 } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate test users
    const generatedUsers = [];
    for (let i = 0; i < users; i++) {
      const email = `testuser${i}@example.com`;
      const hashedPassword = await bcrypt.hash('test1234', 10);
      const user = await client.query(
        `INSERT INTO users (name, email, password)
         VALUES ($1, $2, $3)
         RETURNING id, email`,
        [`Test User ${i}`, email, hashedPassword]
      );
      generatedUsers.push(user.rows[0]);
    }

    // Generate templates
    const generatedTemplates = [];
    for (let i = 0; i < templates; i++) {
      const template = await client.query(
        `INSERT INTO templates (user_id, title, description, is_public)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title`,
        [998, `Test Template ${i}`, `Description for template ${i}`, i % 2 === 0]
      );
      generatedTemplates.push(template.rows[0]);

      // Add questions
      await client.query(
        `INSERT INTO questions (template_id, type, title, position)
         VALUES 
           ($1, 'text', 'Question 1', 1),
           ($1, 'textarea', 'Question 2', 2)`,
        [template.rows[0].id]
      );
    }

    // Generate forms
    const generatedForms = [];
    for (const template of generatedTemplates) {
      for (let i = 0; i < formsPerTemplate; i++) {
        const formUser = generatedUsers[i % generatedUsers.length];
        const form = await client.query(
          `INSERT INTO forms (template_id, user_id)
           VALUES ($1, $2)
           RETURNING id`,
          [template.id, formUser.id]
        );
        generatedForms.push(form.rows[0]);

        // Add answers
        await client.query(
          `INSERT INTO answers (form_id, question_id, value)
           VALUES 
             ($1, (SELECT id FROM questions WHERE template_id = $2 LIMIT 1), 'Answer 1'),
             ($1, (SELECT id FROM questions WHERE template_id = $2 LIMIT 1 OFFSET 1), 'Answer 2')`,
          [form.rows[0].id, template.id]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      status: 'success',
      generated: {
        users: generatedUsers.length,
        templates: generatedTemplates.length,
        forms: generatedForms.length
      },
      sample_user: {
        email: 'testadmin@example.com',
        password: 'test1234'
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bulk generation failed:', err);
    res.status(500).json({
      status: 'error',
      message: 'Bulk data generation failed',
      error: err.message
    });
  } finally {
    client.release();
  }
});

/**
 * @route GET /api/dev/test-token/:role
 * @description Generate a test JWT token
 * @access Development only
 */
router.get('/test-token/:role', devOnly, (req, res) => {
  const { role } = req.params;
  const validRoles = ['admin', 'user'];
  
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid role',
      valid_roles: validRoles
    });
  }

  const testUser = {
    id: role === 'admin' ? 998 : 999,
    email: `test${role}@example.com`,
    role
  };

  res.json({
    status: 'success',
    token: generateToken(testUser),
    user: testUser
  });
});

module.exports = router;