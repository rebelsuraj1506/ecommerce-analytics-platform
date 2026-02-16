const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getPool } = require('../config/database');
const router = express.Router();

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Middleware to extract user from token (simplified - should validate JWT)
const extractUser = (req, res, next) => {
  // In a real app, decode JWT token from Authorization header
  // For now, we'll use a simple approach
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // Decode JWT (simplified - in production use jsonwebtoken)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
      req.user = { id: payload.userId, email: payload.email, role: payload.role };
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }
  next();
};

// Get all orders for the logged-in user
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isString()
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const offset = (page - 1) * limit;
    const userId = req.user.id;

    let whereClause = 'WHERE user_id = $1';
    const params = [userId];
    
    if (req.query.status) {
      whereClause += ' AND status = $2';
      params.push(req.query.status);
    }

    // Get orders
    const ordersQuery = `
      SELECT id, user_id, total_amount, status, payment_method, 
             shipping_address, created_at, updated_at
      FROM orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const ordersResult = await client.query(ordersQuery, [...params, limit, offset]);

    // Get order items for each order
    const orders = await Promise.all(ordersResult.rows.map(async (order) => {
      const itemsQuery = `
        SELECT product_id, product_name, quantity, price, subtotal
        FROM order_items
        WHERE order_id = $1
      `;
      const itemsResult = await client.query(itemsQuery, [order.id]);
      
      return {
        id: order.id,
        userId: order.user_id,
        totalAmount: parseFloat(order.total_amount),
        status: order.status,
        paymentMethod: order.payment_method,
        shippingAddress: order.shipping_address,
        items: itemsResult.rows,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      };
    }));

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM orders ${whereClause}`;
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Create order
router.post('/', [
  body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
  body('items.*.productId').notEmpty().withMessage('Product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.price').isFloat({ min: 0 }).withMessage('Price must be non-negative'),
  body('paymentMethod').isIn(['credit_card', 'debit_card', 'paypal', 'cash']).withMessage('Invalid payment method'),
  body('shippingAddress').notEmpty().withMessage('Shipping address is required')
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { items, paymentMethod, shippingAddress } = req.body;
    const userId = req.user.id;

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    // Insert order
    const orderQuery = `
      INSERT INTO orders (user_id, total_amount, payment_method, shipping_address, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, user_id, total_amount, status, payment_method, shipping_address, created_at, updated_at
    `;
    const orderResult = await client.query(orderQuery, [userId, totalAmount, paymentMethod, shippingAddress]);
    const order = orderResult.rows[0];

    // Insert order items
    const itemsData = [];
    for (const item of items) {
      const itemQuery = `
        INSERT INTO order_items (order_id, product_id, quantity, price, subtotal)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, product_id, quantity, price, subtotal
      `;
      const subtotal = item.quantity * item.price;
      const itemResult = await client.query(itemQuery, [
        order.id,
        item.productId,
        item.quantity,
        item.price,
        subtotal
      ]);
      itemsData.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: {
          id: order.id,
          userId: order.user_id,
          totalAmount: parseFloat(order.total_amount),
          status: order.status,
          paymentMethod: order.payment_method,
          shippingAddress: order.shipping_address,
          items: itemsData,
          createdAt: order.created_at,
          updatedAt: order.updated_at
        }
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Get order by ID
router.get('/:id', [
  param('id').isInt().withMessage('Invalid order ID')
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const orderId = req.params.id;
    const userId = req.user.id;

    // Get order
    const orderQuery = `
      SELECT id, user_id, total_amount, status, payment_method, 
             shipping_address, created_at, updated_at
      FROM orders
      WHERE id = $1 AND user_id = $2
    `;
    const orderResult = await client.query(orderQuery, [orderId, userId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsQuery = `
      SELECT product_id, product_name, quantity, price, subtotal
      FROM order_items
      WHERE order_id = $1
    `;
    const itemsResult = await client.query(itemsQuery, [orderId]);

    res.status(200).json({
      success: true,
      data: {
        order: {
          id: order.id,
          userId: order.user_id,
          totalAmount: parseFloat(order.total_amount),
          status: order.status,
          paymentMethod: order.payment_method,
          shippingAddress: order.shipping_address,
          items: itemsResult.rows,
          createdAt: order.created_at,
          updatedAt: order.updated_at
        }
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Update order status
router.patch('/:id/status', [
  param('id').isInt().withMessage('Invalid order ID'),
  body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid status')
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    const { status } = req.body;

    const updateQuery = `
      UPDATE orders
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
      RETURNING id, user_id, total_amount, status, payment_method, shipping_address, created_at, updated_at
    `;
    const result = await client.query(updateQuery, [status, orderId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;
