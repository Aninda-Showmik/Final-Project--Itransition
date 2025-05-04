const pool = require('../config/db');

class User {
  // Get users with pagination
  static async getPaginatedUsers(limit = 10, offset = 0) {
    const result = await pool.query(
      `SELECT id, name, email, role, created_at 
       FROM users 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  // Get total user count
  static async getTotalUserCount() {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    return parseInt(result.rows[0].count);
  }

  // Get admin count
  static async getAdminCount() {
    const result = await pool.query(
      'SELECT COUNT(*) FROM users WHERE role = $1',
      ['admin']
    );
    return parseInt(result.rows[0].count);
  }

  // Set user role with validation
  static async setUserRole(userId, newRole) {
    if (!['admin', 'user'].includes(newRole)) {
      throw new Error('Invalid role specified');
    }

    await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2',
      [newRole, userId]
    );
  }

  // Search users by name or email
  static async searchUsers(query, limit = 10) {
    const result = await pool.query(
      `SELECT id, name, email, role 
       FROM users 
       WHERE name ILIKE $1 OR email ILIKE $1 
       ORDER BY name 
       LIMIT $2`,
      [`%${query}%`, limit]
    );
    return result.rows;
  }

  // Get user by ID
  static async getUserById(userId) {
    const result = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0];
  }

  // Legacy methods (keep for backward compatibility)
  static async makeAdmin(userId) {
    await this.setUserRole(userId, 'admin');
  }

  static async revokeAdmin(userId) {
    const adminCount = await this.getAdminCount();
    if (adminCount <= 1) {
      throw new Error('Cannot remove last admin');
    }
    await this.setUserRole(userId, 'user');
  }

  static async getUsers() {
    return this.getPaginatedUsers(100, 0); // Default large page size
  }
}

module.exports = User;