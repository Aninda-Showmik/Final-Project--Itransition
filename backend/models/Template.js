const pool = require('../config/db');

class Template {
  static async create({ userId, title, description, isPublic = false }) {
    const result = await pool.query(
      `INSERT INTO templates (user_id, title, description, is_public)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, title, description, isPublic]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT * FROM templates WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async update(id, { title, description, isPublic }) {
    const result = await pool.query(
      `UPDATE templates 
       SET title = $1, description = $2, is_public = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [title, description, isPublic, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM templates WHERE id = $1', [id]);
  }

  static async getUserTemplates(userId) {
    const result = await pool.query(
      `SELECT * FROM templates WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }
}

module.exports = Template;