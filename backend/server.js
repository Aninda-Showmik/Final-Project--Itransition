require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path'); // Added for path resolution

const app = express();
const PORT = process.env.PORT || 10000;

// Database Configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Database Connection Test
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    await client.query('SELECT NOW()');
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
})();

// Security Middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// CORS Configuration
const corsOptions = {
  origin: [
    'https://final-project-itransition-frontend.onrender.com',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Request Logger (Temporary for debugging)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// JWT Authentication Middleware
const authenticate = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
      });
    }
    
    req.user = { id: decoded.userId, role: decoded.role };
    next();
  });
};

// Route Imports with absolute paths
const authRoutes = require(path.join(__dirname, 'routes', 'authRoutes'));
const adminRoutes = require(path.join(__dirname, 'routes', 'adminRoutes'));
const templateRoutes = require(path.join(__dirname, 'routes', 'templateRoutes'));
const formRoutes = require(path.join(__dirname, 'routes', 'formRoutes'));

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', authenticate, adminRoutes);
app.use('/api/templates', authenticate, templateRoutes);
app.use('/api/forms', authenticate, formRoutes);

// Test Route (Temporary - remove in production)
app.get('/api/auth/test', (req, res) => {
  res.json({ success: true, message: "Auth routes are working!" });
});

// Development routes
if (process.env.NODE_ENV === 'development') {
  const devRoutes = require(path.join(__dirname, 'routes', 'devRoutes'));
  app.use('/api/dev', devRoutes);
  console.log('🚧 Development routes enabled');
}

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date()
    });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    attemptedPath: req.originalUrl
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Server error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Server Startup
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    pool.end()
      .then(() => console.log('✅ Database pool drained'))
      .catch(err => console.error('❌ Error draining pool:', err))
      .finally(() => process.exit(0));
  });
});
