const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Product = require('../models/Product');
const router = express.Router();

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Get all products with pagination and filtering
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('category').optional().isString(),
  query('search').optional().isString(),
  query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('sort').optional().isIn(['price', '-price', 'createdAt', '-createdAt', 'name', '-name'])
], validateRequest, async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    // Build query
    const query = { isActive: true };
    
    if (req.query.category) {
      query.category = req.query.category;
    }
    
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }
    
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = req.query.minPrice;
      if (req.query.maxPrice) query.price.$lte = req.query.maxPrice;
    }

    // Execute query - ensure inventory is always a number for the API response
    const rawProducts = await Product.find(query)
      .sort(req.query.sort || '-createdAt')
      .skip(skip)
      .limit(limit)
      .lean();

    const products = rawProducts.map(p => ({
      ...p,
      inventory: typeof p.inventory === 'number' && !Number.isNaN(p.inventory) ? p.inventory : (Number(p.inventory) || 0)
    }));

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

// Create product
router.post('/', [
  body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Product name is required (max 200 characters)'),
  body('description').trim().isLength({ min: 1, max: 2000 }).withMessage('Description is required (max 2000 characters)'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('inventory').isInt({ min: 0 }).withMessage('Inventory must be a non-negative integer'),
  body('category').isIn(['electronics', 'clothing', 'books', 'home', 'sports', 'toys', 'other']).withMessage('Invalid category')
], validateRequest, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
});

// Get product by ID
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid product ID')
], validateRequest, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const p = product.toObject ? product.toObject() : product;
    const inventory = typeof p.inventory === 'number' && !Number.isNaN(p.inventory) ? p.inventory : (Number(p.inventory) || 0);
    res.status(200).json({
      success: true,
      data: { product: { ...p, inventory } }
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message
    });
  }
});

// Update product
router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('name').optional().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim().isLength({ min: 1, max: 2000 }),
  body('price').optional().isFloat({ min: 0 }),
  body('inventory').optional().isInt({ min: 0 }),
  body('category').optional().isIn(['electronics', 'clothing', 'books', 'home', 'sports', 'toys', 'other'])
], validateRequest, async (req, res) => {
  try {
    // Only update fields that are explicitly provided (avoid overwriting inventory with undefined/0 from stale client)
    const update = {};
    if (req.body.name !== undefined) update.name = req.body.name;
    if (req.body.description !== undefined) update.description = req.body.description;
    if (req.body.price !== undefined) update.price = req.body.price;
    if (req.body.inventory !== undefined) update.inventory = req.body.inventory;
    if (req.body.category !== undefined) update.category = req.body.category;
    if (req.body.images !== undefined) update.images = req.body.images;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      Object.keys(update).length ? update : req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const p = product.toObject ? product.toObject() : product;
    const inventory = typeof p.inventory === 'number' && !Number.isNaN(p.inventory) ? p.inventory : (Number(p.inventory) || 0);
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product: { ...p, inventory } }
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  }
});

// Adjust inventory (used by order-service: negative = deduct on order, positive = restore on cancel)
router.patch('/:id/inventory', [
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('change').isInt().withMessage('Change must be an integer (negative to deduct, positive to restore)')
], validateRequest, async (req, res) => {
  try {
    const productId = req.params.id;
    const change = req.body.change;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    const newInventory = product.inventory + change;
    if (newInventory < 0) {
      return res.status(400).json({
        success: false,
        message: `Insufficient inventory for product. Available: ${product.inventory}, requested: ${Math.abs(change)}`
      });
    }
    const updated = await Product.findByIdAndUpdate(
      productId,
      { $inc: { inventory: change } },
      { new: true, runValidators: true }
    );
    res.status(200).json({
      success: true,
      data: { product: updated, previousInventory: product.inventory, change }
    });
  } catch (error) {
    console.error('Error adjusting inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to adjust inventory',
      error: error.message
    });
  }
});

// Add a review (called by order-service after verifying user received the product, or by frontend with auth)
router.post('/:id/reviews', [
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('userId').isInt({ min: 1 }).withMessage('Valid userId is required'),
  body('userName').optional().trim().isString(),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isString().isLength({ max: 2000 })
], validateRequest, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    const { userId, userName, rating, comment } = req.body;
    // Optional: prevent duplicate review from same user (one review per user per product)
    const existing = (product.reviews || []).find(r => String(r.userId) === String(userId));
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }
    product.reviews = product.reviews || [];
    product.reviews.push({ userId, userName: userName || 'User', rating, comment: comment || '' });
    await product.save(); // pre('save') recalculates rating.average and rating.count
    const updated = await Product.findById(req.params.id).lean();
    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: { product: updated }
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review',
      error: error.message
    });
  }
});

// Delete product
router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid product ID')
], validateRequest, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
});

module.exports = router;
