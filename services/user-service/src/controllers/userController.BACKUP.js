const { validationResult } = require('express-validator');
const { getPool } = require('../config/database');
const { cacheDel } = require('../config/redis');
const logger = require('../utils/logger');

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const offset = (page - 1) * limit;
    const pool = getPool();

    let query = 'SELECT id, email, name, role, created_at FROM users';
    const params = [];

    if (role) {
      query += ' WHERE role = ?';
      params.push(role);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [users] = await pool.query(query, params);

    // Get total count
    const countQuery = role ? 
      'SELECT COUNT(*) as total FROM users WHERE role = ?' : 
      'SELECT COUNT(*) as total FROM users';
    const countParams = role ? [role] : [];
    const [countResult] = await pool.query(countQuery, countParams);
    const total = countResult[0].total;

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const pool = getPool();

    // Check if user can access this resource
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const [users] = await pool.query(
      'SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: users[0]
      }
    });
  } catch (error) {
    logger.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { name, email } = req.body;
    const pool = getPool();

    // Check if user can update this resource
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }

    if (email) {
      // Check if email already exists
      const [existingUsers] = await pool.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use'
        });
      }

      updates.push('email = ?');
      values.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Get updated user
    const [users] = await pool.query(
      'SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    logger.info(`User updated: ${id}`);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: users[0]
      }
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const pool = getPool();

    // Check if user exists
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete user
    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    logger.info(`User deleted: ${id}`);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { role } = req.body;
    const pool = getPool();

    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);

    const [users] = await pool.query(
      'SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info(`User role updated: ${id} to ${role}`);

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: users[0]
      }
    });
  } catch (error) {
    logger.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
