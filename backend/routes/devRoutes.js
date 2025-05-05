const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Enhanced Development Mode Check Middleware
const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    console.warn(`Attempted access to dev route in ${process.env.NODE_ENV} mode`);
    return res.status(403).json({ 
      message: 'Development routes disabled in production',
      environment: process.env.NODE_ENV
    });
  }
  next();
};

// Secure JWT Generator
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role || 'user',
      email: user.email,
      iss: 'dev-issuer',
      aud: 'dev-audience'
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // Shorter lifespan for dev tokens
  );
};

// Test Data Constants
const TEST_USER_PREFIX = 'testuser';
const TEST_EMAIL_DOMAIN = '@example.com';
const TEST_PASSWORD = 'test1234';
const TEST_TEMPLATE_PREFIX = 'Test Template';

/**
 * @route GET /api/dev/test-data
 * @description Create complete test environment
 * @access Development only
 */
router.get('/test-data', devOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cleanup existing test data
    await cleanTestData(client);

    // Create test users
    const testUsers = await createTestUsers(client);
    
    // Create test template and questions
    const { template, questions } = await createTestTemplate(client, testUsers.admin.id);
    
    // Create test form and answers
    const form = await createTestForm(client, template.id, testUsers.user.id, questions);

    await client.query('COMMIT');

    res.json({
      status: 'success',
      users: {
        admin: formatUserResponse(testUsers.admin),
        user: formatUserResponse(testUsers.user)
      },
      resources: {
        template: formatTemplateResponse(template),
        questions: formatQuestionsResponse(questions),
        form: formatFormResponse(form, questions.length)
      },
      endpoints: generateTestEndpoints(template.id, form.id)
    });

  } catch (err) {
    await client.query('ROLLBACK');
    handleError(res, err, 'Test data creation failed');
  } finally {
    client.release();
  }
});

// Helper Functions
async function cleanTestData(client) {
  const cleanupQueries = [
    `DELETE FROM answers WHERE form_id IN (
      SELECT id FROM forms WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE '${TEST_USER_PREFIX}%${TEST_EMAIL_DOMAIN}'
      )
    )`,
    `DELETE FROM forms WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '${TEST_USER_PREFIX}%${TEST_EMAIL_DOMAIN}'
    )`,
    `DELETE FROM questions WHERE template_id IN (
      SELECT id FROM templates WHERE title LIKE '${TEST_TEMPLATE_PREFIX}%'
    )`,
    `DELETE FROM templates WHERE title LIKE '${TEST_TEMPLATE_PREFIX}%'`,
    `DELETE FROM users WHERE email LIKE '${TEST_USER_PREFIX}%${TEST_EMAIL_DOMAIN}'`
  ];

  await Promise.all(cleanupQueries.map(q => client.query(q)));
}

async function createTestUsers(client) {
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
  const result = await client.query(`
    INSERT INTO users (id, name, email, password, role)
    VALUES 
      (998, 'Test Admin', 'testadmin${TEST_EMAIL_DOMAIN}', $1, 'admin'),
      (999, 'Test User', 'testuser${TEST_EMAIL_DOMAIN}', $1, 'user')
    RETURNING id, name, email, role
  `, [hashedPassword]);

  return {
    admin: result.rows.find(u => u.role === 'admin'),
    user: result.rows.find(u => u.role === 'user')
  };
}

async function createTestTemplate(client, userId) {
  const template = await client.query(`
    INSERT INTO templates (id, user_id, title, description, is_public)
    VALUES (999, $1, '${TEST_TEMPLATE_PREFIX}', 'Sample template for development', true)
    RETURNING id, title
  `, [userId]);

  const questions = await client.query(`
    INSERT INTO questions (template_id, type, title, description, position)
    VALUES 
      (999, 'text', 'Full Name', 'Enter your full name', 1),
      (999, 'textarea', 'Feedback', 'Your detailed feedback', 2),
      (999, 'number', 'Rating', 'Rate from 1-10', 3),
      (999, 'checkbox', 'Subscribe', 'Receive newsletter', 4)
    RETURNING id, type, title
  `);

  return { template: template.rows[0], questions: questions.rows };
}

async function createTestForm(client, templateId, userId, questions) {
  const form = await client.query(`
    INSERT INTO forms (id, template_id, user_id)
    VALUES (999, $1, $2)
    RETURNING id
  `, [templateId, userId]);

  await client.query(`
    INSERT INTO answers (form_id, question_id, value)
    VALUES 
      (999, $1, 'John Doe'),
      (999, $2, 'This is a test submission'),
      (999, $3, '9'),
      (999, $4, 'true')
  `, questions.map(q => q.id));

  return form.rows[0];
}

function formatUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    password: TEST_PASSWORD,
    token: generateToken(user)
  };
}

function formatTemplateResponse(template) {
  return {
    id: template.id,
    title: template.title
  };
}

function formatQuestionsResponse(questions) {
  return questions.map(q => ({
    id: q.id,
    type: q.type,
    title: q.title
  }));
}

function formatFormResponse(form, answerCount) {
  return {
    id: form.id,
    answers: answerCount
  };
}

function generateTestEndpoints(templateId, formId) {
  return {
    getTemplate: `/api/templates/${templateId}`,
    getForm: `/api/forms/${formId}`,
    adminPanel: '/admin'
  };
}

function handleError(res, err, context) {
  console.error(`${context}:`, err);
  res.status(500).json({
    status: 'error',
    message: context,
    ...(process.env.NODE_ENV === 'development' && {
      error: err.message,
      stack: err.stack
    })
  });
}

// Other routes remain the same but use similar helper patterns...

module.exports = router;
