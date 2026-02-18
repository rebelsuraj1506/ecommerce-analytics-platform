const axios = require('axios');
const logger = require('../utils/logger');

// Authenticate by calling user-service
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token with user-service
    try {
      const response = await axios.get(
        `${process.env.USER_SERVICE_URL}/api/auth/verify`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        // Attach user info to request
        req.user = response.data.data.user;
        next();
      } else {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        return res.status(401).json({
          success: false,
          message: error.response.data.message || 'Invalid or expired token'
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

module.exports = authenticate;
