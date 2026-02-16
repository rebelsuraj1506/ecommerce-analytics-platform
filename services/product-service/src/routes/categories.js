const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        categories: [
          'electronics',
          'clothing',
          'books',
          'home',
          'sports',
          'toys',
          'other'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
