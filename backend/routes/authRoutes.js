//authRoute.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Login endpoint
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        userId: user.rows[0].id,
        role: user.rows[0].role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.rows[0].id,
        name: user.rows[0].name,
        email: user.rows[0].email,
        role: user.rows[0].role
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Register endpoint
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, hashedPassword, 'user']
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.rows[0].id,
        name: newUser.rows[0].name,
        email: newUser.rows[0].email,
        role: newUser.rows[0].role
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// User info endpoint
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    res.json({ user: user.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;