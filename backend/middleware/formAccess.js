const pool = require('../config/db');

module.exports = async (req, res, next) => {
  const { id: formId } = req.params;
  const { id: userId, role } = req.user;

  try {
    // Get form with template owner info
    const formQuery = await pool.query(
      `SELECT f.*, t.user_id as template_owner_id 
       FROM forms f
       JOIN templates t ON f.template_id = t.id
       WHERE f.id = $1`,
      [formId]
    );

    if (formQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const form = formQuery.rows[0];
    req.formData = form; // Attach to request

    // Access Control Logic
    const isOwner = userId === form.user_id;
    const isTemplateOwner = userId === form.template_owner_id;
    const isAdmin = role === 'admin';

    if (isOwner || isTemplateOwner || isAdmin) {
      return next();
    }

    // Check if template is public and user has access
    const accessCheck = await pool.query(
      `SELECT 1 FROM template_access 
       WHERE template_id = $1 AND user_id = $2`,
      [form.template_id, userId]
    );

    if (accessCheck.rows.length > 0) {
      return next();
    }

    res.status(403).json({ message: 'Access denied' });
  } catch (err) {
    console.error('Access check error:', err);
    res.status(500).json({ message: 'Server error during access verification' });
  }
};