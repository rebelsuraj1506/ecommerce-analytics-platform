// Complete Order Model Schema
// Add these fields to your order-service/models/Order.js

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  userId: {
    type: Number,
    required: true,
    index: true
  },
  items: [{
    productId: {
      type: String,
      required: true
    },
    product_id: String, // Alternative field name for compatibility
    name: String,
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    image: String
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: [
      'pending',
      'processing', 
      'shipped', 
      'out_for_delivery',
      'delivered', 
      'cancel_requested',
      'cancelled', 
      'refund_processing',
      'refunded'
    ],
    default: 'pending'
  },
  
  // Shipping Information
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    phone: String,
    country: { type: String, default: 'India' }
  },
  
  // Tracking Information
  trackingNumber: String,
  courierName: String,
  estimatedDelivery: Date,
  
  // Status Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  processingAt: Date,
  shippedAt: Date,
  outForDeliveryAt: Date,
  deliveredAt: Date,
  
  // Cancellation Fields
  cancellationReason: String,
  cancellationImages: [String],
  cancellationRequestedAt: Date,
  cancellationApprovedBy: Number,
  cancellationApprovedAt: Date,
  cancellationRejected: { type: Boolean, default: false },
  cancellationRejectionReason: String,
  cancellationRejectedBy: Number,
  cancellationRejectedAt: Date,
  cancelledAt: Date,
  
  // Refund Fields
  refundStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: null
  },
  refundAmount: Number,
  refundProcessingAt: Date,
  refundedAt: Date,
  refundTransactionId: String,
  
  // Payment Information
  paymentMethod: {
    type: String,
    enum: ['cod', 'card', 'upi', 'netbanking', 'wallet'],
    default: 'cod'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentTransactionId: String,
  
  // Additional Information
  orderNotes: String,
  adminNotes: String,
  customerNotes: String,
  
  // Soft Delete Fields
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  deletedBy: Number,
  deletionExpiresAt: Date, // 30 days after deletion
  
  // Restoration Request Fields
  restorationRequested: {
    type: Boolean,
    default: false
  },
  restorationRequestedAt: Date,
  restorationReason: String,
  restorationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: null
  },
  restorationApprovedBy: Number,
  restorationApprovedAt: Date,
  restorationRejectedBy: Number,
  restorationRejectedAt: Date,
  restorationRejectionReason: String,
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ id: 1 });

// Auto-increment order ID
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.id) {
    const lastOrder = await this.constructor.findOne().sort({ id: -1 });
    this.id = lastOrder ? lastOrder.id + 1 : 1000;
  }
  this.updatedAt = new Date();
  next();
});

// Virtual for order age in days
orderSchema.virtual('orderAgeInDays').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return ['pending', 'processing'].includes(this.status);
};

// Method to get order timeline
orderSchema.methods.getTimeline = function() {
  const timeline = [];
  
  if (this.createdAt) {
    timeline.push({ status: 'pending', timestamp: this.createdAt, label: 'Order Placed' });
  }
  if (this.processingAt) {
    timeline.push({ status: 'processing', timestamp: this.processingAt, label: 'Processing' });
  }
  if (this.shippedAt) {
    timeline.push({ status: 'shipped', timestamp: this.shippedAt, label: 'Shipped' });
  }
  if (this.outForDeliveryAt) {
    timeline.push({ status: 'out_for_delivery', timestamp: this.outForDeliveryAt, label: 'Out for Delivery' });
  }
  if (this.deliveredAt) {
    timeline.push({ status: 'delivered', timestamp: this.deliveredAt, label: 'Delivered' });
  }
  if (this.cancelledAt) {
    timeline.push({ status: 'cancelled', timestamp: this.cancelledAt, label: 'Cancelled' });
  }
  
  return timeline;
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;