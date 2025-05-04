const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // MUST HAVE THIS FOR RENDER
});

module.exports = pool;
