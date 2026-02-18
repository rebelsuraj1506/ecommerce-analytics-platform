const Order = require('../models/Order');
const logger = require('../utils/logger');

// Soft delete an order
exports.softDeleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.userId;

    const order = await Order.findOne({ id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Add soft delete fields to order
    order.statusBeforeDeletion = order.status;
    order.isDeleted = true;
    order.deletedAt = new Date();
    order.deletedBy = userId;
    order.deletionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    await order.save();

    logger.info(`Order ${orderId} soft-deleted by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Order deleted. You can request restoration within 30 days.',
      data: {
        orderId,
        deletionExpiresAt: order.deletionExpiresAt
      }
    });
  } catch (error) {
    logger.error('Soft delete order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get user's active orders (excluding soft-deleted)
exports.getActiveOrders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {
      userId,
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false }
      ]
    };

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get active orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get user's deleted orders
exports.getDeletedOrders = async (req, res) => {
  try {
    const userId = req.user.userId;

    const orders = await Order.find({
      userId,
      isDeleted: true,
      deletionExpiresAt: { $gt: new Date() } // Only show orders not yet permanently deleted
    }).sort({ deletedAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        orders
      }
    });
  } catch (error) {
    logger.error('Get deleted orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Request order history restoration
exports.requestOrderRestoration = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.userId;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reason (minimum 10 characters)'
      });
    }

    const order = await Order.findOne({
      id: orderId,
      userId,
      isDeleted: true
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Deleted order not found'
      });
    }

    // Check if order is still within recovery period
    if (new Date() > order.deletionExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'This order has been permanently deleted and cannot be restored'
      });
    }

    // Check if restoration already requested
    if (order.restorationRequested) {
      return res.status(400).json({
        success: false,
        message: 'Restoration already requested for this order'
      });
    }

    // Add restoration request fields
    order.restorationRequested = true;
    order.restorationRequestedAt = new Date();
    order.restorationReason = reason;
    order.restorationStatus = 'pending'; // pending, approved, rejected

    await order.save();

    // In a production system, you would notify admins here
    logger.info(`Restoration requested for order ${orderId} by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Restoration request submitted. An admin will review it shortly.',
      data: {
        orderId,
        requestedAt: order.restorationRequestedAt
      }
    });
  } catch (error) {
    logger.error('Request order restoration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get restoration requests (admin only)
exports.getRestorationRequests = async (req, res) => {
  try {
    const status = req.query.status || 'pending';

    const requests = await Order.find({
      isDeleted: true,
      restorationRequested: true,
      restorationStatus: status
    }).sort({ restorationRequestedAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        requests
      }
    });
  } catch (error) {
    logger.error('Get restoration requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Approve order restoration (admin only)
exports.approveRestoration = async (req, res) => {
  try {
    const orderId = req.params.id;
    const adminId = req.user.userId;

    const order = await Order.findOne({
      id: orderId,
      isDeleted: true,
      restorationRequested: true
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Restoration request not found'
      });
    }

    // Restore the order
    order.isDeleted = false;
    order.deletedAt = null;
    order.deletedBy = null;
    order.deletionExpiresAt = null;
    order.restorationStatus = 'approved';
    order.restorationApprovedBy = adminId;
    order.restorationApprovedAt = new Date();

    await order.save();

    logger.info(`Order ${orderId} restored by admin ${adminId}`);

    res.status(200).json({
      success: true,
      message: 'Order restored successfully',
      data: {
        order
      }
    });
  } catch (error) {
    logger.error('Approve restoration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Reject order restoration (admin only)
exports.rejectRestoration = async (req, res) => {
  try {
    const orderId = req.params.id;
    const adminId = req.user.userId;
    const { rejectionReason } = req.body;

    const order = await Order.findOne({
      id: orderId,
      isDeleted: true,
      restorationRequested: true
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Restoration request not found'
      });
    }

    order.restorationStatus = 'rejected';
    order.restorationRejectedBy = adminId;
    order.restorationRejectedAt = new Date();
    order.restorationRejectionReason = rejectionReason;

    await order.save();

    logger.info(`Order ${orderId} restoration rejected by admin ${adminId}`);

    res.status(200).json({
      success: true,
      message: 'Restoration request rejected'
    });
  } catch (error) {
    logger.error('Reject restoration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Cleanup permanently deleted orders (cron job)
exports.cleanupExpiredDeletions = async (req, res) => {
  try {
    const result = await Order.deleteMany({
      isDeleted: true,
      deletionExpiresAt: { $lt: new Date() }
    });

    logger.info(`Permanently deleted ${result.deletedCount} expired orders`);

    res.status(200).json({
      success: true,
      message: `Permanently deleted ${result.deletedCount} orders`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    logger.error('Cleanup expired deletions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = exports;
