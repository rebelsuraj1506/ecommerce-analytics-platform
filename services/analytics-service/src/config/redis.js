const redis = require('redis');
const logger = require('../utils/logger');

let redisClient;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379
      },
      password: process.env.REDIS_PASSWORD || undefined
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    logger.error('Redis connection error:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error('Redis client not initialized or not connected');
  }
  return redisClient;
};

const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
};

// Cache helper functions
const cacheSet = async (key, value, expiryInSeconds = 3600) => {
  try {
    const client = getRedisClient();
    await client.setEx(key, expiryInSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Cache set error:', error);
  }
};

const cacheGet = async (key) => {
  try {
    const client = getRedisClient();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Cache get error:', error);
    return null;
  }
};

const cacheDel = async (key) => {
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch (error) {
    logger.error('Cache delete error:', error);
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  closeRedis,
  cacheSet,
  cacheGet,
  cacheDel
};
