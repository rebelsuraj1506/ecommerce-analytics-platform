require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const { connectRedis, getRedisClient } = require('./config/redis');

const app = express();
const PORT = process.env.PORT || 8004;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'analytics-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Get dashboard analytics
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const redis = getRedisClient();
    
    // Get metrics from Redis
    const [
      totalOrders,
      totalRevenue,
      ordersToday,
      revenueToday
    ] = await Promise.all([
      redis.get('analytics:orders:total') || '0',
      redis.get('analytics:revenue:total') || '0',
      redis.get('analytics:orders:today') || '0',
      redis.get('analytics:revenue:today') || '0'
    ]);

    // Get top products (stored as sorted set)
    const topProducts = await redis.zRange('analytics:products:top', 0, 9, {
      REV: true,
      WITHSCORES: true
    });

    const formattedTopProducts = [];
    for (let i = 0; i < topProducts.length; i += 2) {
      formattedTopProducts.push({
        productId: topProducts[i],
        sales: parseInt(topProducts[i + 1])
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalOrders: parseInt(totalOrders),
        totalRevenue: parseFloat(totalRevenue),
        ordersToday: parseInt(ordersToday),
        revenueToday: parseFloat(revenueToday),
        topProducts: formattedTopProducts,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

// Get revenue analytics by period
app.get('/api/analytics/revenue', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const redis = getRedisClient();
    
    let days = 7;
    if (period === '30d') days = 30;
    else if (period === '90d') days = 90;

    const revenueData = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const revenue = await redis.get(`analytics:revenue:${dateStr}`) || '0';
      const orders = await redis.get(`analytics:orders:${dateStr}`) || '0';
      
      revenueData.push({
        date: dateStr,
        revenue: parseFloat(revenue),
        orders: parseInt(orders)
      });
    }

    res.status(200).json({
      success: true,
      data: {
        period,
        revenue: revenueData
      }
    });
  } catch (error) {
    logger.error('Revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics'
    });
  }
});

// Track order event (called by Order Service)
app.post('/api/analytics/track/order', async (req, res) => {
  try {
    const { orderId, amount, items } = req.body;
    const redis = getRedisClient();
    const today = new Date().toISOString().split('T')[0];

    // Increment counters
    await redis.incr('analytics:orders:total');
    await redis.incr('analytics:orders:today');
    await redis.incr(`analytics:orders:${today}`);

    // Update revenue
    await redis.incrByFloat('analytics:revenue:total', amount);
    await redis.incrByFloat('analytics:revenue:today', amount);
    await redis.incrByFloat(`analytics:revenue:${today}`, amount);

    // Update top products
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await redis.zIncrBy('analytics:products:top', item.quantity, item.productId);
      }
    }

    logger.info(`Tracked order analytics: ${orderId}`);

    res.status(200).json({
      success: true,
      message: 'Order analytics tracked'
    });
  } catch (error) {
    logger.error('Track order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track order analytics'
    });
  }
});

// Reset today's counters (run daily via cron)
app.post('/api/analytics/reset/daily', async (req, res) => {
  try {
    const redis = getRedisClient();
    
    await redis.set('analytics:orders:today', '0');
    await redis.set('analytics:revenue:today', '0');

    logger.info('Daily analytics counters reset');

    res.status(200).json({
      success: true,
      message: 'Daily counters reset'
    });
  } catch (error) {
    logger.error('Reset daily error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset counters'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Analytics service error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
const startServer = async () => {
  try {
    await connectRedis();
    logger.info('Redis connected successfully');

    // Initialize counters if they don't exist
    const redis = getRedisClient();
    const exists = await redis.exists('analytics:orders:total');
    if (!exists) {
      await redis.set('analytics:orders:total', '0');
      await redis.set('analytics:revenue:total', '0');
      await redis.set('analytics:orders:today', '0');
      await redis.set('analytics:revenue:today', '0');
      logger.info('Initialized analytics counters');
    }

    app.listen(PORT, () => {
      logger.info(`Analytics Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

startServer();

module.exports = app;
