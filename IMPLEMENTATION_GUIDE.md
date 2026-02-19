# E-Commerce Platform Enhancement Implementation Guide

## Overview
This document provides complete implementation instructions for the following enhancements:
1. Persistent Authentication & Navigation with JWT
2. Dynamic Product Images with Unsplash API
3. Editable User Profile with Address Management
4. Order Management with Soft-Delete & Recovery System

---

## 1. Persistent Authentication & Navigation

### Frontend Changes

#### Update App.js to use AuthContext

Replace the current App.js authentication logic with:

```javascript
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import MainLayout from './layouts/MainLayout';

function AppContent() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return isAuthenticated ? <MainLayout /> : <LoginPage />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

#### Update package.json dependencies

Add to `frontend/package.json`:

```json
{
  "dependencies": {
    "react-router-dom": "^6.20.0",
    "jwt-decode": "^4.0.0"
  }
}
```

### Backend Changes

#### Update auth routes in user-service

In `/services/user-service/src/routes/auth.js`:

```javascript
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Public routes
router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().notEmpty()
], authController.register);

router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], authController.login);

router.post('/refresh', authController.refreshToken);

// Protected routes
router.post('/logout', auth, authController.logout);
router.get('/me', auth, authController.getCurrentUser);

module.exports = router;
```

### Testing

1. **Login Persistence**: Log in, refresh the page → User should remain logged in
2. **Token Expiry**: Wait for token to expire → Should redirect to login
3. **Route Protection**: Try accessing protected routes when logged out → Should redirect to login
4. **Cross-Tab Sync**: Open in multiple tabs → Logout in one should logout all

---

## 2. Dynamic Product Images with Unsplash API

### Setup

1. **Get Unsplash API Key**:
   - Go to https://unsplash.com/developers
   - Create an app
   - Copy the Access Key

2. **Configure in Frontend**:

In `imageService.js`, replace:
```javascript
const UNSPLASH_ACCESS_KEY = 'YOUR_API_KEY_HERE';
```

### Integration Examples

#### Basic Usage:

```javascript
import ImageService from '../services/imageService';

// Get product image
const imageUrl = await ImageService.getProductImage(
  'Wireless Headphones',
  'Electronics',
  400,
  300
);
```

#### React Component:

```javascript
import { LazyProductImage } from '../services/imageService';

function ProductCard({ product }) {
  return (
    <div className="product-card">
      <LazyProductImage
        productName={product.name}
        category={product.category}
        width={300}
        height={200}
        alt={product.name}
      />
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </div>
  );
}
```

### Add to CSS

Add to `App.css` or create `LazyImage.css`:

```css
.lazy-image-container {
  position: relative;
  overflow: hidden;
  background-color: #f0f0f0;
  border-radius: 8px;
}

.lazy-image-skeleton {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.lazy-image-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}
```

### Fallback Mode

Without Unsplash API key, the service automatically uses placeholder images.

---

## 3. Editable User Profile & Address Management

### Database Setup

Run the migration:

```bash
cd services/user-service
mysql -u root -p ecommerce < migrations/001_create_user_addresses_table.sql
```

### Backend Setup

1. **Update user-service index.js**:

```javascript
const profileRoutes = require('./routes/profile');

// ... existing code ...

app.use('/api/users', profileRoutes);
```

2. **Update API Gateway routes** (if using):

In `services/api-gateway/src/index.js`:

```javascript
// User Profile Routes
app.use('/api/users/profile', proxy('http://user-service:3001'));
app.use('/api/users/addresses', proxy('http://user-service:3001'));
```

### Frontend Integration

1. **Add Profile Route**:

In your main routes file:

```javascript
import UserProfile from './pages/UserProfile';

// In routes:
<Route path="/profile" element={<UserProfile />} />
```

2. **Add to Navigation**:

```javascript
const userLinks = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/profile', label: 'My Profile', icon: '👤' },
  { to: '/my-orders', label: 'My Orders', icon: '📦' },
  // ... other links
];
```

### CSS for Profile Page

Create `UserProfile.css`:

```css
.user-profile-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.profile-header {
  margin-bottom: 30px;
}

.profile-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  border-bottom: 2px solid #e0e0e0;
}

.tab-button {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s;
}

.tab-button.active {
  border-bottom-color: #007bff;
  color: #007bff;
  font-weight: 600;
}

.profile-card {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.form-divider {
  margin: 30px 0;
  border: none;
  border-top: 1px solid #e0e0e0;
}

.addresses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.address-card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  position: relative;
  transition: all 0.3s;
}

.address-card:hover {
  border-color: #007bff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.address-card.default {
  border-color: #28a745;
}

.default-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #28a745;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}
```

---

## 4. Order Management with Soft-Delete & Recovery

### Database/Model Updates

The Order model has been updated with soft-delete fields. Ensure MongoDB is running and restart the order-service.

### Backend Setup

1. **Update order-service index.js**:

```javascript
const orderDeletionRoutes = require('./routes/orderDeletion');

// ... existing code ...

app.use('/api/orders', orderDeletionRoutes);
```

2. **Create Cron Job for Cleanup**:

In `services/order-service/src/jobs/cleanup.js`:

```javascript
const cron = require('node-cron');
const Order = require('../models/Order');
const logger = require('../utils/logger');

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    const result = await Order.deleteMany({
      isDeleted: true,
      deletionExpiresAt: { $lt: new Date() }
    });
    
    logger.info(`Cleanup job: Permanently deleted ${result.deletedCount} orders`);
  } catch (error) {
    logger.error('Cleanup job error:', error);
  }
});
```

Add to package.json:
```json
{
  "dependencies": {
    "node-cron": "^3.0.3"
  }
}
```

### Frontend Integration

Update MyOrders.js to include deletion and restoration:

```javascript
const handleDeleteOrder = async (orderId) => {
  if (!window.confirm('Delete this order? You can restore it within 30 days.')) {
    return;
  }

  try {
    const res = await fetch(`http://localhost:8003/api/orders/${orderId}/soft`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    
    if (data.success) {
      setSuccess('Order deleted. You can request restoration within 30 days.');
      fetchOrders(); // Refresh list
    } else {
      setError(data.message);
    }
  } catch (err) {
    setError('Failed to delete order');
  }
};

const handleRequestRestoration = async (orderId) => {
  const reason = window.prompt('Please provide a reason for restoration:');
  
  if (!reason || reason.trim().length < 10) {
    alert('Reason must be at least 10 characters');
    return;
  }

  try {
    const res = await fetch(`http://localhost:8003/api/orders/${orderId}/restore-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ reason })
    });

    const data = await res.json();
    
    if (data.success) {
      setSuccess('Restoration request submitted');
    } else {
      setError(data.message);
    }
  } catch (err) {
    setError('Failed to submit restoration request');
  }
};
```

### Admin Panel for Restoration Requests

Create `AdminRestorationPanel.js`:

```javascript
import React, { useState, useEffect } from 'react';

const AdminRestorationPanel = ({ token }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch('http://localhost:8003/api/orders/restoration-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setRequests(data.data.requests);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  const handleApprove = async (orderId) => {
    if (!window.confirm('Approve this restoration request?')) return;

    try {
      const res = await fetch(`http://localhost:8003/api/orders/${orderId}/restoration/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.success) {
        alert('Order restored successfully');
        fetchRequests();
      }
    } catch (err) {
      alert('Failed to approve restoration');
    }
  };

  const handleReject = async (orderId) => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason) return;

    try {
      const res = await fetch(`http://localhost:8003/api/orders/${orderId}/restoration/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rejectionReason: reason })
      });
      
      const data = await res.json();
      if (data.success) {
        alert('Request rejected');
        fetchRequests();
      }
    } catch (err) {
      alert('Failed to reject restoration');
    }
  };

  return (
    <div className="restoration-panel">
      <h2>Order Restoration Requests</h2>
      
      {requests.length === 0 ? (
        <p>No pending restoration requests</p>
      ) : (
        <div className="requests-list">
          {requests.map(request => (
            <div key={request.id} className="request-card">
              <h3>Order #{request.id}</h3>
              <p><strong>Deleted:</strong> {new Date(request.deletedAt).toLocaleString()}</p>
              <p><strong>Requested:</strong> {new Date(request.restorationRequestedAt).toLocaleString()}</p>
              <p><strong>Reason:</strong> {request.restorationReason}</p>
              <p><strong>Total:</strong> ${request.totalAmount}</p>
              
              <div className="request-actions">
                <button
                  className="btn btn-success"
                  onClick={() => handleApprove(request.id)}
                >
                  ✅ Approve
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleReject(request.id)}
                >
                  ❌ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRestorationPanel;
```

---

## Testing Checklist

### Authentication
- [ ] Login persists after page refresh
- [ ] Token refresh works before expiry
- [ ] Logout clears all auth data
- [ ] Protected routes redirect to login

### Images
- [ ] Product images load from Unsplash
- [ ] Fallback to placeholder when API fails
- [ ] Lazy loading works properly
- [ ] Images are cached for performance

### Profile
- [ ] User can update name and phone
- [ ] Password change works with validation
- [ ] Can add new addresses
- [ ] Can edit existing addresses
- [ ] Can delete addresses
- [ ] Can set default address
- [ ] Only one default address per user

### Order Deletion
- [ ] User can delete orders
- [ ] Deleted orders don't show in active list
- [ ] User can request restoration
- [ ] Admin sees restoration requests
- [ ] Admin can approve/reject requests
- [ ] Orders auto-delete after 30 days
- [ ] Restoration deadline is enforced

---

## Environment Variables

Add to `.env` files:

### Frontend (.env)
```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_UNSPLASH_KEY=your_unsplash_access_key
```

### User Service (.env)
```bash
JWT_SECRET=your_secure_jwt_secret_here
JWT_EXPIRY=7d
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ecommerce
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Order Service (.env)
```bash
MONGODB_URI=mongodb://localhost:27017/orders_db
JWT_SECRET=your_secure_jwt_secret_here
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Deployment Notes

1. **Database Migrations**: Run all SQL migrations before deploying
2. **Environment Variables**: Set all required env vars in production
3. **Cron Jobs**: Ensure cleanup job runs in production (consider using a job scheduler)
4. **Monitoring**: Monitor deletion/restoration metrics
5. **Backups**: Regular database backups before permanent deletions

---

## API Endpoints Summary

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user
- POST `/api/auth/logout` - Logout user
- POST `/api/auth/refresh` - Refresh JWT token
- GET `/api/auth/me` - Get current user

### Profile & Addresses
- GET `/api/users/profile` - Get user profile
- PUT `/api/users/profile` - Update profile
- GET `/api/users/addresses` - Get all addresses
- POST `/api/users/addresses` - Add address
- PUT `/api/users/addresses/:id` - Update address
- DELETE `/api/users/addresses/:id` - Delete address
- PUT `/api/users/addresses/:id/default` - Set default address

### Orders (Soft Delete)
- GET `/api/orders/active` - Get active orders
- GET `/api/orders/deleted` - Get deleted orders
- DELETE `/api/orders/:id/soft` - Soft delete order
- POST `/api/orders/:id/restore-request` - Request restoration
- GET `/api/orders/restoration-requests` - Get requests (admin)
- POST `/api/orders/:id/restoration/approve` - Approve (admin)
- POST `/api/orders/:id/restoration/reject` - Reject (admin)

---

## Support & Troubleshooting

### Common Issues

1. **Token not persisting**: Check localStorage in browser dev tools
2. **Images not loading**: Verify Unsplash API key
3. **Address not saving**: Check database connection and table creation
4. **Deletion not working**: Ensure MongoDB is running

### Logs

Check service logs:
```bash
# User service
docker-compose logs user-service

# Order service
docker-compose logs order-service
```

---

## Next Steps

1. Set up automated tests for all new features
2. Add email notifications for restoration requests
3. Implement image upload for profile pictures
4. Add analytics for deletion/restoration patterns
5. Create admin dashboard for monitoring

---

Last Updated: February 18, 2026