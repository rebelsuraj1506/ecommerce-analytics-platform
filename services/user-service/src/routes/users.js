const express = require('express');
const { body, param } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const updateUserValidation = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required')
];

const createUserValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('role').isIn(['customer', 'merchant', 'admin']).withMessage('Invalid role')
];

// Get all users (Admin only)
router.get('/', authenticate, authorize(['admin']), userController.getAllUsers);

// Create user/admin manually (Admin only)
router.post('/', authenticate, authorize(['admin']), createUserValidation, userController.createUser);

// Delete ALL users (Admin only)
router.delete('/all', authenticate, authorize(['admin']), userController.deleteAllUsers);

// Get user by ID
router.get('/:id', authenticate, param('id').isInt(), userController.getUserById);

// Get user details with full information (Admin only)
router.get('/:id/details', 
  authenticate, 
  authorize(['admin']), 
  param('id').isInt(), 
  userController.getUserDetails
);

// Update user
router.route('/:id')
  .put(authenticate, param('id').isInt(), updateUserValidation, userController.updateUser)
  .patch(authenticate, param('id').isInt(), updateUserValidation, userController.updateUser);

// Delete user (Admin only)
router.delete('/:id', authenticate, authorize(['admin']), param('id').isInt(), userController.deleteUser);

// Update user role (Admin only)
router.patch('/:id/role', 
  authenticate, 
  authorize(['admin']), 
  param('id').isInt(),
  body('role').isIn(['customer', 'merchant', 'admin']).withMessage('Invalid role'),
  userController.updateUserRole
);

module.exports = router;
