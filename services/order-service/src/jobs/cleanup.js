const cron = require('node-cron');
const Order = require('../models/Order');
const logger = require('../utils/logger');

// Run daily at 2 AM to cleanup permanently deleted orders
cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('Running order cleanup job...');
    
    const result = await Order.deleteMany({
      isDeleted: true,
      deletionExpiresAt: { $lt: new Date() }
    });

    logger.info(`Cleanup job completed: Permanently deleted ${result.deletedCount} expired orders`);
  } catch (error) {
    logger.error('Cleanup job error:', error);
  }
});

logger.info('Order cleanup cron job scheduled (daily at 2 AM)');
