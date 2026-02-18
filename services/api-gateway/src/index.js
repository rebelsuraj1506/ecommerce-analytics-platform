require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const logger = require('./utils/logger');
const { connectRedis, getRedisClient } = require('./config/redis');

const app = express();
const PORT = process.env.PORT || 8000;

// Service URLs
const SERVICES = {
  USER: process.env.USER_SERVICE_URL || 'http://user-service:8001',
  PRODUCT: process.env.PRODUCT_SERVICE_URL || 'http://product-service:8002',
  ORDER: process.env.ORDER_SERVICE_URL || 'http://order-service:8003',
  ANALYTICS: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8004'
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Rate limiting middleware
const rateLimiter = async (req, res, next) => {
  try {
    const redis = getRedisClient();
    const ip = req.ip || req.connection.remoteAddress;
    const key = `ratelimit:${ip}`;
    
    const requests = await redis.incr(key);
    
    if (requests === 1) {
      await redis.expire(key, 60); // 1 minute window
    }
    
    const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500;
    
    if (requests > maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }
    
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requests));
    
    next();
  } catch (error) {
    logger.error('Rate limiter error:', error);
    next(); // Continue even if rate limiting fails
  }
};

app.use(rateLimiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Proxy helper function
const proxyRequest = async (serviceUrl, path, method, data, headers) => {
  try {
    const response = await axios({
      method,
      url: `${serviceUrl}${path}`,
      data,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw {
        status: error.response.status,
        data: error.response.data
      };
    }
    throw {
      status: 503,
      data: {
        success: false,
        message: 'Service unavailable'
      }
    };
  }
};

// Route handlers
// User Service routes
app.all('/api/auth*', async (req, res) => {
  try {
    const path = `${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;
    const data = await proxyRequest(SERVICES.USER, path, req.method, req.body, req.headers);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.all('/api/users*', async (req, res) => {
  try {
    const path = `${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;
    const data = await proxyRequest(SERVICES.USER, path, req.method, req.body, req.headers);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

// Product Service routes
app.all('/api/products*', async (req, res) => {
  try {
    const path = req.path.replace('/api/products', '/api/products');
    const data = await proxyRequest(SERVICES.PRODUCT, `${path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`, req.method, req.body, req.headers);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

app.all('/api/categories*', async (req, res) => {
  try {
    const path = `${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;
    const data = await proxyRequest(SERVICES.PRODUCT, path, req.method, req.body, req.headers);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

// Order Service routes
app.all('/api/orders*', async (req, res) => {
  try {
    const path = req.path.replace('/api/orders', '/api/orders');
    const data = await proxyRequest(SERVICES.ORDER, `${path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`, req.method, req.body, req.headers);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
  }
});

// Analytics Service routes
app.all('/api/analytics*', async (req, res) => {
  try {
    const path = req.path.replace('/api/analytics', '/api/analytics');
    const data = await proxyRequest(SERVICES.ANALYTICS, `${path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`, req.method, req.body, req.headers);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.data);
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
  logger.error('Gateway error:', err);
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

    app.listen(PORT, () => {
      logger.info(`API Gateway running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info('Service URLs:', SERVICES);
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