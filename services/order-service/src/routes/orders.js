const express = require('express');
const axios = require('axios');
const { body, param, query, validationResult } = require('express-validator');
const { getPool } = require('../config/database');
const router = express.Router();

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:8002';

// Adjust product inventory (change: negative = deduct, positive = restore). Returns { success, error? }.
async function adjustProductInventory(productId, change) {
  try {
    const res = await axios.patch(
      `${PRODUCT_SERVICE_URL}/api/products/${productId}/inventory`,
      { change },
      { timeout: 10000 }
    );
    return { success: true, data: res.data };
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const status = err.response?.status;
    return { success: false, error: message, status };
  }
}

// Parse shipping_address from DB (stored as JSON string) to object for API response
function parseShippingAddress(val) {
  if (val == null || val === '') return null;
  try {
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch {
    return null;
  }
}

// Add parsed shippingAddress to an order row from the DB
function withParsedShippingAddress(row) {
  if (!row) return row;
  return { ...row, shippingAddress: parseShippingAddress(row.shipping_address) };
}

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

// Middleware to extract user from token
const extractUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
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
    const userRole = req.user.role;

    let whereClause = userRole === 'admin' ? 'WHERE 1=1' : 'WHERE user_id = $1';
    const params = userRole === 'admin' ? [] : [userId];
    
    if (req.query.status) {
      whereClause += ` AND status = $${params.length + 1}`;
      params.push(req.query.status);
    }

    // Get orders with all tracking fields
    const ordersQuery = `
      SELECT 
        id, user_id, total_amount, status, payment_method, 
        shipping_address, created_at, updated_at,
        processing_at, shipped_at, out_for_delivery_at, delivered_at,
        tracking_number, courier_name, estimated_delivery,
        cancellation_reason, cancellation_images, cancellation_requested_at,
        cancellation_approved_by, cancellation_approved_at,
        cancellation_rejected, cancellation_rejection_reason,
        cancellation_rejected_by, cancellation_rejected_at, cancelled_at,
        refund_status, refund_amount, refund_processing_at, refunded_at
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
        shippingAddress: parseShippingAddress(order.shipping_address),
        items: itemsResult.rows.map(item => ({
          productId: item.product_id,
          product_id: item.product_id,
          name: item.product_name,
          quantity: item.quantity,
          price: parseFloat(item.price)
        })),
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        // Tracking info
        processingAt: order.processing_at,
        shippedAt: order.shipped_at,
        outForDeliveryAt: order.out_for_delivery_at,
        deliveredAt: order.delivered_at,
        trackingNumber: order.tracking_number,
        courierName: order.courier_name,
        estimatedDelivery: order.estimated_delivery,
        // Cancellation info
        cancellationReason: order.cancellation_reason,
        cancellationImages: order.cancellation_images || [],
        cancellationRequestedAt: order.cancellation_requested_at,
        cancelledAt: order.cancelled_at,
        // Refund info
        refundStatus: order.refund_status,
        refundAmount: order.refund_amount ? parseFloat(order.refund_amount) : null
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
  body('paymentMethod').isIn(['credit_card', 'debit_card', 'paypal', 'cash', 'cod', 'card', 'upi', 'netbanking', 'wallet']).withMessage('Invalid payment method'),
  body('shippingAddress').notEmpty().withMessage('Shipping address is required')
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { items, paymentMethod, shippingAddress } = req.body;
    const userId = req.user.id;

    // Deduct inventory for each item (fail order if any product has insufficient stock)
    const decremented = [];
    for (const item of items) {
      const result = await adjustProductInventory(item.productId, -item.quantity);
      if (!result.success) {
        // Rollback: restore inventory for already-decremented items
        for (const d of decremented) {
          await adjustProductInventory(d.productId, d.quantity);
        }
        await client.query('ROLLBACK');
        const isInsufficient = (result.error || '').toLowerCase().includes('insufficient');
        const message = result.status === 404
          ? (result.error || 'Product not found')
          : (isInsufficient ? 'This item is sold out. Will be back soon.' : (result.error || 'Failed to reserve inventory'));
        return res.status(result.status === 404 ? 404 : 400).json({
          success: false,
          message,
          productId: item.productId
        });
      }
      decremented.push({ productId: item.productId, quantity: item.quantity });
    }

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    // Insert order (inventory_deducted = true since we deducted above)
    const orderQuery = `
      INSERT INTO orders (user_id, total_amount, payment_method, shipping_address, status, inventory_deducted)
      VALUES ($1, $2, $3, $4, 'pending', true)
      RETURNING *
    `;
    const orderResult = await client.query(orderQuery, [userId, totalAmount, paymentMethod, JSON.stringify(shippingAddress)]);
    const order = orderResult.rows[0];

    // Insert order items
    const itemsData = [];
    for (const item of items) {
      const itemQuery = `
        INSERT INTO order_items (order_id, product_id, product_name, quantity, price, subtotal)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const subtotal = item.quantity * item.price;
      const itemResult = await client.query(itemQuery, [
        order.id,
        item.productId,
        item.name || 'Product',
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
          shippingAddress: parseShippingAddress(order.shipping_address),
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

// Sync inventory for previous orders (orders placed before inventory deduction was implemented)
// Admin only. Deducts order quantities from products for all orders that have inventory_deducted = false
// and status not cancelled/refunded, then marks those orders as inventory_deducted = true.
router.post('/sync-inventory', validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can run inventory sync'
      });
    }
    const ordersResult = await client.query(
      `SELECT id FROM orders WHERE (inventory_deducted = false OR inventory_deducted IS NULL) AND status NOT IN ('cancelled', 'refunded') ORDER BY id ASC`
    );
    let synced = 0;
    const skipped = [];
    const errors = [];
    for (const row of ordersResult.rows) {
      const itemsRes = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [row.id]);
      const decremented = [];
      let fail = false;
      for (const item of itemsRes.rows) {
        const result = await adjustProductInventory(item.product_id, -item.quantity);
        if (!result.success) {
          for (const d of decremented) {
            await adjustProductInventory(d.product_id, d.quantity);
          }
          errors.push({ orderId: row.id, productId: item.product_id, error: result.error });
          fail = true;
          break;
        }
        decremented.push({ product_id: item.product_id, quantity: item.quantity });
      }
      if (!fail) {
        await client.query('UPDATE orders SET inventory_deducted = true WHERE id = $1', [row.id]);
        synced++;
      } else {
        skipped.push(row.id);
      }
    }
    res.status(200).json({
      success: true,
      message: 'Inventory sync completed',
      data: { synced, skippedCount: skipped.length, skippedOrderIds: skipped, errors }
    });
  } catch (error) {
    console.error('Error syncing inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync inventory',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Undo inventory sync: restore product inventory for orders that were synced (inventory_deducted = true).
// Use this if sync was run by mistake or ran multiple times and zeroed inventory. Admin only.
router.post('/undo-sync-inventory', validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can run undo sync'
      });
    }
    const ordersResult = await client.query(
      `SELECT id FROM orders WHERE inventory_deducted = true AND status NOT IN ('cancelled', 'refunded') ORDER BY id ASC`
    );
    let restored = 0;
    const errors = [];
    for (const row of ordersResult.rows) {
      const itemsRes = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [row.id]);
      for (const item of itemsRes.rows) {
        const adj = await adjustProductInventory(item.product_id, item.quantity);
        if (!adj.success) {
          errors.push({ orderId: row.id, productId: item.product_id, error: adj.error });
        }
      }
      await client.query('UPDATE orders SET inventory_deducted = false WHERE id = $1', [row.id]);
      restored++;
    }
    res.status(200).json({
      success: true,
      message: 'Undo sync completed. Inventory restored for previously synced orders. You can run sync-inventory again if needed.',
      data: { restoredOrderCount: restored, errors }
    });
  } catch (error) {
    console.error('Error undoing sync:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to undo sync',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// ============= NEW ROUTES FOR ORDER TRACKING =============

// Update order status (Admin only)
router.put('/:id/status', [
  param('id').isInt().withMessage('Invalid order ID'),
  body('status').isIn(['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refund_processing', 'refunded']).withMessage('Invalid status')
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update order status'
      });
    }

    const orderId = req.params.id;
    const { status, trackingNumber, courierName, estimatedDelivery } = req.body;

    // Build update query based on status
    let updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    let params = [status];
    let paramIndex = 2;

    // Add timestamp for status change
    switch (status) {
      case 'processing':
        updateFields.push(`processing_at = CURRENT_TIMESTAMP`);
        break;
      case 'shipped':
        updateFields.push(`shipped_at = CURRENT_TIMESTAMP`);
        if (trackingNumber) {
          updateFields.push(`tracking_number = $${paramIndex}`);
          params.push(trackingNumber);
          paramIndex++;
        }
        if (courierName) {
          updateFields.push(`courier_name = $${paramIndex}`);
          params.push(courierName);
          paramIndex++;
        }
        if (estimatedDelivery) {
          updateFields.push(`estimated_delivery = $${paramIndex}`);
          params.push(estimatedDelivery);
          paramIndex++;
        }
        break;
      case 'out_for_delivery':
        updateFields.push(`out_for_delivery_at = CURRENT_TIMESTAMP`);
        break;
      case 'delivered':
        updateFields.push(`delivered_at = CURRENT_TIMESTAMP`);
        break;
      case 'cancelled':
        updateFields.push(`cancelled_at = CURRENT_TIMESTAMP`);
        break;
      case 'refund_processing':
        updateFields.push(`refund_processing_at = CURRENT_TIMESTAMP`);
        break;
      case 'refunded':
        updateFields.push(`refunded_at = CURRENT_TIMESTAMP`);
        break;
    }

    params.push(orderId);

    // If transitioning to cancelled, get current status so we only restore inventory if not yet delivered
    let previousStatus = null;
    if (status === 'cancelled') {
      const prev = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
      if (prev.rows.length > 0) previousStatus = prev.rows[0].status;
    }
    
    const updateQuery = `
      UPDATE orders
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await client.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // When order is set to cancelled and was not already delivered/cancelled, restore inventory only if we had deducted it
    const orderRow = result.rows[0];
    const hadDeducted = orderRow.inventory_deducted === true;
    const shouldRestore = status === 'cancelled' && previousStatus && !['cancelled', 'delivered', 'refunded'].includes(previousStatus) && hadDeducted;
    if (shouldRestore) {
      const itemsRes = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
      for (const row of itemsRes.rows) {
        const adj = await adjustProductInventory(row.product_id, row.quantity);
        if (!adj.success) {
          console.error(`Failed to restore inventory for product ${row.product_id}:`, adj.error);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: {
        order: withParsedShippingAddress(result.rows[0])
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

// Request cancellation
router.post('/:id/cancel-request', [
  param('id').isInt().withMessage('Invalid order ID'),
  body('reason').notEmpty().withMessage('Cancellation reason is required')
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    const { reason, images } = req.body;

    // Check if order exists and belongs to user
    const checkQuery = `
      SELECT id, user_id, status 
      FROM orders 
      WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
    `;
    const checkResult = await client.query(checkQuery, [orderId, userId, req.user.role]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = checkResult.rows[0];

    // Check if order can be cancelled
    if (!['pending', 'processing'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}. Orders can only be cancelled when pending or processing.`
      });
    }

    // Update order with cancellation request
    const updateQuery = `
      UPDATE orders
      SET 
        status = 'cancel_requested',
        cancellation_reason = $1,
        cancellation_images = $2,
        cancellation_requested_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [reason, images || [], orderId]);

    res.status(200).json({
      success: true,
      message: 'Cancellation request submitted successfully. Our team will review it within 24-48 hours.',
      data: {
        order: withParsedShippingAddress(result.rows[0])
      }
    });
  } catch (error) {
    console.error('Error submitting cancellation request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit cancellation request',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Approve cancellation (Admin only)
router.put('/:id/approve-cancel', [
  param('id').isInt().withMessage('Invalid order ID')
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can approve cancellations'
      });
    }

    const orderId = req.params.id;

    // Check order status
    const checkQuery = `SELECT id, status FROM orders WHERE id = $1`;
    const checkResult = await client.query(checkQuery, [orderId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (checkResult.rows[0].status !== 'cancel_requested') {
      return res.status(400).json({
        success: false,
        message: 'Order does not have a pending cancellation request'
      });
    }

    // Approve cancellation
    const updateQuery = `
      UPDATE orders
      SET 
        status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        refund_status = 'pending',
        cancellation_approved_by = $1,
        cancellation_approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [req.user.id, orderId]);
    const orderRow = result.rows[0];

    // Restore inventory only if we had deducted it (inventory_deducted = true)
    if (orderRow.inventory_deducted === true) {
      const itemsRes = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
      for (const row of itemsRes.rows) {
        const adj = await adjustProductInventory(row.product_id, row.quantity);
        if (!adj.success) {
          console.error(`Failed to restore inventory for product ${row.product_id}:`, adj.error);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Cancellation approved successfully. Refund will be processed within 5-7 business days.',
      data: {
        order: withParsedShippingAddress(result.rows[0])
      }
    });
  } catch (error) {
    console.error('Error approving cancellation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve cancellation',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Reject cancellation (Admin only)
router.put('/:id/reject-cancel', [
  param('id').isInt().withMessage('Invalid order ID'),
  body('rejectionReason').optional().isString()
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can reject cancellations'
      });
    }

    const orderId = req.params.id;
    const { rejectionReason } = req.body;

    // Check order status
    const checkQuery = `SELECT id, status FROM orders WHERE id = $1`;
    const checkResult = await client.query(checkQuery, [orderId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (checkResult.rows[0].status !== 'cancel_requested') {
      return res.status(400).json({
        success: false,
        message: 'Order does not have a pending cancellation request'
      });
    }

    // Reject cancellation
    const updateQuery = `
      UPDATE orders
      SET 
        status = 'processing',
        cancellation_rejected = true,
        cancellation_rejection_reason = $1,
        cancellation_rejected_by = $2,
        cancellation_rejected_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [
      rejectionReason || 'Cancellation request denied',
      req.user.id,
      orderId
    ]);

    res.status(200).json({
      success: true,
      message: 'Cancellation request rejected. Order will continue processing.',
      data: {
        order: withParsedShippingAddress(result.rows[0])
      }
    });
  } catch (error) {
    console.error('Error rejecting cancellation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject cancellation',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Submit a review for a product that was in a delivered order (user must have received the order)
router.post('/:orderId/review', [
  param('orderId').isInt({ min: 1 }).withMessage('Invalid order ID'),
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isString().isLength({ max: 2000 }),
  body('userName').optional().trim().isString()
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const orderId = req.params.orderId;
    const userId = req.user.id;
    const { productId, rating, comment, userName } = req.body;

    const orderRow = await client.query(
      'SELECT id, status, user_id FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, userId]
    );
    if (orderRow.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (orderRow.rows[0].status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'You can only review products from delivered orders'
      });
    }

    const itemRow = await client.query(
      'SELECT product_id FROM order_items WHERE order_id = $1 AND product_id = $2',
      [orderId, productId]
    );
    if (itemRow.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'This product was not in this order'
      });
    }

    const reviewRes = await axios.post(
      `${PRODUCT_SERVICE_URL}/api/products/${productId}/reviews`,
      { userId, userName: userName || 'User', rating, comment: comment || '' },
      { timeout: 10000 }
    );

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: reviewRes.data?.data
    });
  } catch (err) {
    if (err.response?.status === 400) {
      return res.status(400).json({
        success: false,
        message: err.response?.data?.message || 'Already reviewed or invalid request'
      });
    }
    console.error('Error submitting review:', err);
    res.status(500).json({
      success: false,
      message: err.response?.data?.message || 'Failed to submit review',
      error: err.message
    });
  } finally {
    client.release();
  }
});

// Get order tracking
router.get('/:id/tracking', [
  param('id').isInt().withMessage('Invalid order ID')
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const orderQuery = `
      SELECT 
        id, status, tracking_number, courier_name, estimated_delivery,
        created_at, processing_at, shipped_at, out_for_delivery_at, 
        delivered_at, cancelled_at
      FROM orders
      WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
    `;
    
    const result = await client.query(orderQuery, [orderId, userId, userRole]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = result.rows[0];
    
    const timeline = [
      { status: 'pending', timestamp: order.created_at, label: 'Order Placed' },
      order.processing_at && { status: 'processing', timestamp: order.processing_at, label: 'Processing' },
      order.shipped_at && { status: 'shipped', timestamp: order.shipped_at, label: 'Shipped' },
      order.out_for_delivery_at && { status: 'out_for_delivery', timestamp: order.out_for_delivery_at, label: 'Out for Delivery' },
      order.delivered_at && { status: 'delivered', timestamp: order.delivered_at, label: 'Delivered' },
      order.cancelled_at && { status: 'cancelled', timestamp: order.cancelled_at, label: 'Cancelled' }
    ].filter(Boolean);

    res.status(200).json({
      success: true,
      data: {
        tracking: {
          orderId: order.id,
          status: order.status,
          trackingNumber: order.tracking_number,
          courierName: order.courier_name,
          estimatedDelivery: order.estimated_delivery,
          timeline
        }
      }
    });
  } catch (error) {
    console.error('Error fetching tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tracking information',
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
    const userRole = req.user.role;

    // Get order
    const orderQuery = `
      SELECT *
      FROM orders
      WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
    `;
    const orderResult = await client.query(orderQuery, [orderId, userId, userRole]);

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
          ...order,
          shippingAddress: parseShippingAddress(order.shipping_address),
          items: itemsResult.rows
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

// Delete order (Admin only)
router.delete('/:id', [
  param('id').isInt().withMessage('Invalid order ID')
], validateRequest, extractUser, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete orders'
      });
    }

    const orderId = req.params.id;

    await client.query('BEGIN');

    // Delete order items first
    await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
    
    // Delete order
    const result = await client.query('DELETE FROM orders WHERE id = $1 RETURNING id', [orderId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;