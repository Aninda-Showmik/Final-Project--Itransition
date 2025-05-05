require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const helmet = require('helmet'); // Added for security headers
const rateLimit = require('express-rate-limit'); // Added for rate limiting

const app = express();
const PORT = process.env.PORT || 10000; // Render uses 10000 by default

// Database Configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Set connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Database Connection Test
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1); // Exit if DB connection fails
  }
})();

// Security Middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://final-project-itransition-frontend.onrender.com',
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// JWT Authentication Middleware (Optimized)
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
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

// Route Imports
const routes = [
  { path: '/api/auth', handler: require('./routes/authRoutes') },
  { path: '/api/admin', handler: require('./routes/adminRoutes'), middleware: [authenticate] },
  { path: '/api/templates', handler: require('./routes/templateRoutes'), middleware: [authenticate] },
  { path: '/api/forms', handler: require('./routes/formRoutes'), middleware: [authenticate] }
];

// Dynamic Route Registration
routes.forEach(route => {
  if (route.middleware) {
    app.use(route.path, ...route.middleware, route.handler);
  } else {
    app.use(route.path, route.handler);
  }
});

// Development routes
if (process.env.NODE_ENV === 'development') {
  app.use('/api/dev', require('./routes/devRoutes'));
  console.log('🚧 Development routes enabled');
}

// Health Check Endpoint
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

// Error Handling
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
  });
});

// Server Startup
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    pool.end();
    console.log('Server closed. Database pool drained.');
    process.exit(0);
  });
});
