const pool = require('../config/db');

class User {
  // Get users with pagination
  static async getPaginatedUsers(limit = 10, offset = 0) {
    try {
      const result = await pool.query(
        `SELECT id, name, email, role, created_at 
         FROM users 
         ORDER BY created_at DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error fetching paginated users: ${error.message}`);
    }
  }

  // Get total user count and admin count
  static async getUserCounts() {
    const result = await pool.query(
      `SELECT COUNT(*) AS total_users, 
              COUNT(CASE WHEN role = 'admin' THEN 1 END) AS admin_count 
       FROM users`
    );
    return {
      totalUsers: parseInt(result.rows[0].total_users),
      adminCount: parseInt(result.rows[0].admin_count)
    };
  }

  // Set user role with validation
  static async setUserRole(userId, newRole) {
    if (!['admin', 'user'].includes(newRole)) {
      throw new Error('Invalid role specified');
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
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
    const { adminCount } = await this.getUserCounts();
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
