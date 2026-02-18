const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const orderDeletionController = require('../controllers/orderDeletionController');

// User routes
router.get('/active', auth, orderDeletionController.getActiveOrders);
router.get('/deleted', auth, orderDeletionController.getDeletedOrders);
router.delete('/:id/soft', auth, orderDeletionController.softDeleteOrder);

router.post('/:id/restore-request',
  auth,
  [
    body('reason').trim().isLength({ min: 10 })
      .withMessage('Reason must be at least 10 characters')
  ],
  orderDeletionController.requestOrderRestoration
);

// Admin routes
router.get('/restoration-requests', adminAuth, orderDeletionController.getRestorationRequests);
router.post('/:id/restoration/approve', adminAuth, orderDeletionController.approveRestoration);
router.post('/:id/restoration/reject',
  adminAuth,
  [
    body('rejectionReason').trim().notEmpty()
      .withMessage('Rejection reason is required')
  ],
  orderDeletionController.rejectRestoration
);

// Cleanup route (should be called by cron job or admin)
router.post('/cleanup/expired', adminAuth, orderDeletionController.cleanupExpiredDeletions);

module.exports = router;
