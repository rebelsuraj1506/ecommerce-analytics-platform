const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create indexes
    const Product = require('../models/Product');
    await Product.syncIndexes();
    logger.info('MongoDB indexes synchronized');
    
    return conn;
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
};

const closeDB = async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
};

module.exports = { connectDB, closeDB };
