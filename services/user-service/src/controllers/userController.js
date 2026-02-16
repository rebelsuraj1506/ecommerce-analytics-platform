const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const { getPool } = require('../config/database');
const { cacheDel } = require('../config/redis');
const logger = require('../utils/logger');

// ========== Get all users with statistics ==========
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, role } = req.query;
    const offset = (page - 1) * limit;
    const pool = getPool();

    let query = 'SELECT id, email, name, phone, role, created_at FROM users';
    const params = [];

    if (role) {
      query += ' WHERE role = ?';
      params.push(role);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [users] = await pool.query(query, params);

    // Add order statistics
    const usersWithStats = await Promise.all(users.map(async (user) => {
      let orderCount = 0;
      let totalSpent = 0;
      try {
        const [stats] = await pool.query(`
          SELECT 
            COUNT(*) as order_count,
            COALESCE(SUM(total_amount), 0) as total_spent
          FROM orders
          WHERE user_id = ?
        `, [user.id]);
        orderCount = parseInt(stats[0].order_count);
        totalSpent = parseFloat(stats[0].total_spent);
      } catch (e) {
        // orders table might not exist in user-service DB
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone || null,
        role: user.role,
        createdAt: user.created_at,
        orderCount,
        totalSpent
      };
    }));

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
        users: usersWithStats,
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

// ========== NEW: Admin creates a user/admin manually ==========
exports.createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, name, phone, role = 'customer' } = req.body;
    const pool = getPool();

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (email, password, name, phone, role) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, name, phone || null, role]
    );

    const userId = result.insertId;

    logger.info(`Admin created new ${role}: ${email} (ID: ${userId})`);

    res.status(201).json({
      success: true,
      message: `${role === 'admin' ? 'Admin' : 'User'} created successfully`,
      data: {
        user: {
          id: userId,
          email,
          name,
          phone: phone || null,
          role,
          createdAt: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user creation'
    });
  }
};

// ========== NEW: Delete ALL users (Admin only) ==========
exports.deleteAllUsers = async (req, res) => {
  try {
    const pool = getPool();
    const requesterId = req.user.userId;
    const { includeAdmins = false } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let userFilter = '';
      const params = [];

      if (includeAdmins) {
        // Delete all users EXCEPT the requesting admin
        userFilter = 'WHERE id != ?';
        params.push(requesterId);
      } else {
        // Delete only non-admin users
        userFilter = "WHERE role != 'admin' AND id != ?";
        params.push(requesterId);
      }

      // Get users to be deleted
      const [usersToDelete] = await connection.query(
        `SELECT id, name, email, role FROM users ${userFilter}`,
        params
      );

      if (usersToDelete.length === 0) {
        await connection.commit();
        connection.release();
        return res.status(200).json({
          success: true,
          message: 'No users to delete',
          data: { deletedCount: 0 }
        });
      }

      const userIds = usersToDelete.map(u => u.id);

      // Delete order items for these users' orders
      try {
        await connection.query(`
          DELETE FROM order_items 
          WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (?))
        `, [userIds]);
      } catch (e) { /* table might not exist */ }

      // Delete orders for these users
      try {
        await connection.query(
          'DELETE FROM orders WHERE user_id IN (?)',
          [userIds]
        );
      } catch (e) { /* table might not exist */ }

      // Delete sessions for these users
      try {
        await connection.query(
          'DELETE FROM sessions WHERE user_id IN (?)',
          [userIds]
        );
      } catch (e) { /* table might not exist */ }

      // Delete the users
      const [deleteResult] = await connection.query(
        `DELETE FROM users ${userFilter}`,
        params
      );

      await connection.commit();
      connection.release();

      const deletedCount = deleteResult.affectedRows;

      logger.info(`Admin (ID: ${requesterId}) deleted ${deletedCount} users. Include admins: ${includeAdmins}`);

      res.status(200).json({
        success: true,
        message: `Successfully deleted ${deletedCount} user(s)`,
        data: {
          deletedCount,
          deletedUsers: usersToDelete.map(u => ({ id: u.id, name: u.name, role: u.role })),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('Delete all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
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

    if (req.user.role !== 'admin' && req.user.userId !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const [users] = await pool.query(
      'SELECT id, email, name, phone, role, created_at, updated_at FROM users WHERE id = ?',
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

// ========== Get user details with full information (Admin only) ==========
exports.getUserDetails = async (req, res) => {
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

    const [users] = await pool.query(
      'SELECT id, email, name, role, phone, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Get user's orders
    let orders = [];
    let ordersWithItems = [];
    try {
      const [orderRows] = await pool.query(`
        SELECT 
          id, total_amount, status, payment_method,
          shipping_address, created_at, updated_at
        FROM orders 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `, [id]);
      orders = orderRows;

      ordersWithItems = await Promise.all(orders.map(async (order) => {
        let items = [];
        try {
          const [itemRows] = await pool.query(`
            SELECT product_id, product_name, quantity, price, subtotal
            FROM order_items WHERE order_id = ?
          `, [order.id]);
          items = itemRows;
        } catch (e) {}

        return {
          id: order.id,
          totalAmount: parseFloat(order.total_amount),
          status: order.status,
          paymentMethod: order.payment_method,
          shippingAddress: order.shipping_address,
          items,
          createdAt: order.created_at,
          updatedAt: order.updated_at
        };
      }));
    } catch (e) { /* orders table might not exist */ }

    const totalSpent = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const cancelledOrders = orders.filter(o => ['cancelled', 'cancel_requested'].includes(o.status)).length;

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        statistics: {
          totalOrders: orders.length,
          completedOrders,
          cancelledOrders,
          totalSpent,
          avgOrderValue: orders.length > 0 ? totalSpent / orders.length : 0
        },
        orders: ordersWithItems
      }
    });
  } catch (error) {
    logger.error('Get user details error:', error);
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
    const { name, email, phone } = req.body;
    const pool = getPool();

    if (req.user.role !== 'admin' && req.user.userId !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }

    if (email) {
      const [existingUsers] = await pool.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      );
      if (existingUsers.length > 0) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
      updates.push('email = ?');
      values.push(email);
    }

    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone || null); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const [users] = await pool.query(
      'SELECT id, email, name, phone, role, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    logger.info(`User updated: ${id}`);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user: users[0] }
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ========== Delete user with cascade ==========
exports.deleteUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const pool = getPool();
    const requesterId = req.user.userId;

    if (parseInt(id) === requesterId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const [users] = await pool.query('SELECT id, name, email FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      try {
        await connection.query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)`, [id]);
      } catch (e) {}

      let ordersDeleted = 0;
      try {
        const [orderResult] = await connection.query('DELETE FROM orders WHERE user_id = ?', [id]);
        ordersDeleted = orderResult.affectedRows;
      } catch (e) {}

      try { await connection.query('DELETE FROM sessions WHERE user_id = ?', [id]); } catch (e) {}

      await connection.query('DELETE FROM users WHERE id = ?', [id]);
      await connection.commit();
      connection.release();

      logger.info(`User deleted: ${id} (${user.name}) - ${ordersDeleted} orders deleted`);

      res.status(200).json({
        success: true,
        message: `User "${user.name}" and all associated data deleted successfully`,
        data: {
          deletedUser: { id: user.id, name: user.name },
          deletedOrders: ordersDeleted,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { role } = req.body;
    const pool = getPool();

    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);

    const [users] = await pool.query(
      'SELECT id, email, name, phone, role, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    logger.info(`User role updated: ${id} to ${role}`);

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: { user: users[0] }
    });
  } catch (error) {
    logger.error('Update user role error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
