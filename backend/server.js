require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

// Database Connection
// Database Connection for Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false  // Required for connecting securely to Render PostgreSQL
  }
});

// Test database connection
pool.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch(err => console.error('Database connection error:', err));

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://final-project-itransition-frontend.onrender.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Better JSON parsing with limit
app.use(express.json({ limit: '10mb' }));

// Enhanced JWT Authentication Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Authorization token required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        message: 'Invalid or expired token' 
      });
    }
    
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  });
};

// Route Imports
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const templateRoutes = require('./routes/templateRoutes');
const formRoutes = require('./routes/formRoutes'); // Updated to match your file
const devRoutes = require('./routes/devRoutes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', authenticate, adminRoutes);
app.use('/api/templates', authenticate, templateRoutes);
app.use('/api/forms', authenticate, formRoutes);

// Development routes
if (process.env.NODE_ENV === 'development') {
  app.use('/api/dev', devRoutes);
  console.log('Development routes enabled');
}

// Enhanced Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date(),
    database: pool ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Improved 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ 
    success: false,
    message: `Route ${req.originalUrl} not found`,
    suggestion: 'Check API documentation for available endpoints'
  });
});

// Enhanced Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Server startup
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});
