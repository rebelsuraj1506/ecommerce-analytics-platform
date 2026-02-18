const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

// Map snake_case DB columns to camelCase for frontend
const normalizeAddress = (row) => ({
  id: row.id,
  userId: row.user_id,
  label: row.label,
  street: row.street,
  city: row.city,
  state: row.state,
  zipCode: row.zip_code,
  country: row.country,
  phone: row.phone,
  isDefault: row.is_default === 1 || row.is_default === true,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
const { getPool } = require('../config/database');
const logger = require('../utils/logger');

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.userId;

    const [users] = await pool.query(
      'SELECT id, email, name, phone, role, created_at FROM users WHERE id = ?',
      [userId]
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
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  try {
    const pool = getPool();
    const userId = req.user.userId;
    const { name, email, phone, currentPassword, newPassword } = req.body;

    // Get current user data
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // If email is being changed, check it's not already taken by another user
    if (email && email !== user.email) {
      const [emailCheck] = await pool.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );
      if (emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email address is already in use by another account'
        });
      }
    }

    // If changing password, verify current password
    if (currentPassword && newPassword) {
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update with new password
      await pool.query(
        'UPDATE users SET name = ?, email = ?, phone = ?, password = ? WHERE id = ?',
        [name, email || user.email, phone, hashedPassword, userId]
      );
    } else {
      // Update without password change
      await pool.query(
        'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
        [name, email || user.email, phone, userId]
      );
    }

    // Get updated user data
    const [updatedUsers] = await pool.query(
      'SELECT id, email, name, phone, role FROM users WHERE id = ?',
      [userId]
    );

    logger.info(`Profile updated for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUsers[0]
      }
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get user addresses
exports.getAddresses = async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.userId;

    const [addresses] = await pool.query(
      'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [userId]
    );

    res.status(200).json({
      success: true,
      data: {
        addresses: addresses.map(normalizeAddress)
      }
    });
  } catch (error) {
    logger.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Add new address
exports.addAddress = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  try {
    const pool = getPool();
    const userId = req.user.userId;
    const { label, street, city, state, zipCode, country, phone, isDefault } = req.body;

    // If setting as default, remove default from other addresses
    if (isDefault) {
      await pool.query(
        'UPDATE user_addresses SET is_default = 0 WHERE user_id = ?',
        [userId]
      );
    }

    const [result] = await pool.query(
      'INSERT INTO user_addresses (user_id, label, street, city, state, zip_code, country, phone, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, label, street, city, state, zipCode, country || 'India', phone, isDefault ? 1 : 0]
    );

    // Get the newly created address
    const [addresses] = await pool.query(
      'SELECT * FROM user_addresses WHERE id = ?',
      [result.insertId]
    );

    logger.info(`Address added for user: ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: {
        address: normalizeAddress(addresses[0])
      }
    });
  } catch (error) {
    logger.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update address
exports.updateAddress = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  try {
    const pool = getPool();
    const userId = req.user.userId;
    const addressId = req.params.id;
    const { label, street, city, state, zipCode, country, phone, isDefault } = req.body;

    // Verify address belongs to user
    const [existing] = await pool.query(
      'SELECT * FROM user_addresses WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // If setting as default, remove default from other addresses
    if (isDefault) {
      await pool.query(
        'UPDATE user_addresses SET is_default = 0 WHERE user_id = ? AND id != ?',
        [userId, addressId]
      );
    }

    await pool.query(
      'UPDATE user_addresses SET label = ?, street = ?, city = ?, state = ?, zip_code = ?, country = ?, phone = ?, is_default = ? WHERE id = ? AND user_id = ?',
      [label, street, city, state, zipCode, country, phone, isDefault ? 1 : 0, addressId, userId]
    );

    // Get updated address
    const [addresses] = await pool.query(
      'SELECT * FROM user_addresses WHERE id = ?',
      [addressId]
    );

    logger.info(`Address updated: ${addressId} for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: {
        address: normalizeAddress(addresses[0])
      }
    });
  } catch (error) {
    logger.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Delete address
exports.deleteAddress = async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.userId;
    const addressId = req.params.id;

    // Verify address belongs to user
    const [existing] = await pool.query(
      'SELECT * FROM user_addresses WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    await pool.query(
      'DELETE FROM user_addresses WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );

    logger.info(`Address deleted: ${addressId} for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    logger.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Set default address
exports.setDefaultAddress = async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.userId;
    const addressId = req.params.id;

    // Verify address belongs to user
    const [existing] = await pool.query(
      'SELECT * FROM user_addresses WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Remove default from all addresses
    await pool.query(
      'UPDATE user_addresses SET is_default = 0 WHERE user_id = ?',
      [userId]
    );

    // Set new default
    await pool.query(
      'UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );

    logger.info(`Default address set: ${addressId} for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Default address updated'
    });
  } catch (error) {
    logger.error('Set default address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = exports;