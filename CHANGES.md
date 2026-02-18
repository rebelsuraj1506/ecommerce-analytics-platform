# EXACT FILE CHANGES AND MODIFICATIONS

## Overview
This document lists all the exact files that need to be added or modified in your e-commerce platform.

---

## NEW FILES TO ADD

### Frontend - New Files

1. **`frontend/src/contexts/AuthContext.js`**
   - Authentication context with JWT persistence
   - Handles login, logout, token refresh
   - ~220 lines

2. **`frontend/src/services/imageService.js`**
   - Unsplash API integration
   - Image lazy loading service
   - ~300 lines

3. **`frontend/src/pages/UserProfile.js`**
   - User profile management page
   - Address management interface
   - ~450 lines

4. **`frontend/src/pages/UserProfile.css`**
   - Styles for profile page
   - Responsive design
   - ~300 lines

### Backend - User Service New Files

5. **`services/user-service/src/controllers/profileController.js`**
   - Profile CRUD operations
   - Address management logic
   - ~280 lines

6. **`services/user-service/src/routes/profile.js`**
   - Profile and address routes
   - ~65 lines

7. **`services/user-service/migrations/001_create_user_addresses_table.sql`**
   - Database migration for addresses
   - ~60 lines

### Backend - Order Service New Files

8. **`services/order-service/src/controllers/orderDeletionController.js`**
   - Soft delete logic
   - Restoration workflow
   - ~350 lines

9. **`services/order-service/src/routes/orderDeletion.js`**
   - Order deletion routes
   - ~50 lines

10. **`services/order-service/src/middleware/adminAuth.js`**
    - Admin authentication middleware
    - ~60 lines

11. **`services/order-service/src/jobs/cleanup.js`**
    - Cron job for order cleanup
    - ~20 lines

---

## FILES TO MODIFY

### Frontend Modifications

#### 1. `frontend/src/index.js`
**Location:** Line 1-11
**Change:** Wrap App with AuthProvider

**BEFORE:**
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**AFTER:**
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
```

#### 2. `frontend/src/App.js`
**Multiple changes required:**

**Change 1:** Import statements (Line 1-9)
```javascript
// ADD these imports
import UserProfile from './pages/UserProfile';
import { useAuth } from './contexts/AuthContext';
```

**Change 2:** Replace function signature (Line 11)
```javascript
// BEFORE:
function App() {

// AFTER:
function AppContent() {
  const { user, token, login, logout, loading } = useAuth();
```

**Change 3:** Update handleAuth function (Lines 20-54)
```javascript
// Replace the entire handleAuth function with simplified version
// that uses the useAuth hook's login method
```

**Change 4:** Add loading screen (After function signature)
```javascript
if (loading) {
  return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Loading...</p>
    </div>
  );
}
```

**Change 5:** Update userLinks array (Line 171-176)
```javascript
// ADD profile link
const userLinks = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/profile', label: 'My Profile', icon: '👤' },  // NEW
  { to: '/my-orders', label: 'My Orders', icon: '📦' },
  { to: '/products', label: 'Shop Products', icon: '🛍️' },
  { to: '/categories', label: 'Categories', icon: '🏷️' },
];
```

**Change 6:** Add profile route (Line 224-234)
```javascript
<Routes>
  {/* ... existing routes ... */}
  <Route path="/profile" element={<UserProfile />} />  {/* NEW */}
  {/* ... rest of routes ... */}
</Routes>
```

**Change 7:** Wrap component (Bottom of file)
```javascript
// AFTER the closing brace of AppContent
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
```

### Backend Modifications

#### 3. `services/user-service/src/index.js`
**Change 1:** Import profile routes (Line 11-12)
```javascript
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const profileRoutes = require('./routes/profile');  // ADD THIS
```

**Change 2:** Register profile routes (Line 41-43)
```javascript
app.use('/api/auth', authRoutes);
app.use('/api/users', profileRoutes);  // ADD THIS (before userRoutes)
app.use('/api/users', userRoutes);
```

#### 4. `services/order-service/src/index.js`
**Change 1:** Import deletion routes (Line 10-11)
```javascript
const orderRoutes = require('./routes/orders');
const orderDeletionRoutes = require('./routes/orderDeletion');  // ADD THIS
```

**Change 2:** Register deletion routes (Line 40-41)
```javascript
app.use('/api/orders', orderRoutes);
app.use('/api/orders', orderDeletionRoutes);  // ADD THIS
```

**Change 3:** Initialize cleanup job (Line 60, inside startServer function)
```javascript
await connectRedis();
logger.info('Redis connected successfully');

// Initialize cleanup job
require('./jobs/cleanup');  // ADD THIS

app.listen(PORT, () => {
```

#### 5. `services/order-service/src/models/Order.js`
**Change:** Add soft-delete fields to schema (Before the closing brace of orderSchema)

**Location:** Line 117-124 (before `updatedAt` field)

**ADD THESE FIELDS:**
```javascript
// Soft Delete Fields
isDeleted: {
  type: Boolean,
  default: false,
  index: true
},
deletedAt: Date,
deletedBy: Number,
deletionExpiresAt: Date,

// Restoration Request Fields
restorationRequested: { type: Boolean, default: false },
restorationRequestedAt: Date,
restorationReason: String,
restorationStatus: {
  type: String,
  enum: ['pending', 'approved', 'rejected'],
  default: null
},
restorationApprovedBy: Number,
restorationApprovedAt: Date,
restorationRejectedBy: Number,
restorationRejectedAt: Date,
restorationRejectionReason: String,
```

---

## DATABASE CHANGES

### Run Migration
```bash
cd services/user-service
mysql -u root -p ecommerce < migrations/001_create_user_addresses_table.sql
```

This creates:
- `user_addresses` table
- Adds `phone` column to `users` table
- Creates indexes for performance
- Sets up triggers for default address management

---

## PACKAGE.JSON UPDATES

### Frontend (`frontend/package.json`)
**ADD these dependencies:**
```json
{
  "dependencies": {
    "react-router-dom": "^6.20.0",
    "jwt-decode": "^4.0.0"
  }
}
```

Then run:
```bash
cd frontend
npm install
```

### Order Service (`services/order-service/package.json`)
**ADD this dependency:**
```json
{
  "dependencies": {
    "node-cron": "^3.0.3"
  }
}
```

Then run:
```bash
cd services/order-service
npm install
```

---

## ENVIRONMENT VARIABLES

### Add to `frontend/.env`
```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_UNSPLASH_KEY=your_unsplash_access_key
```

### Add to `services/user-service/.env`
```bash
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRY=7d
```

### Add to `services/order-service/.env`
```bash
MONGODB_URI=mongodb://localhost:27017/ecommerce
JWT_SECRET=same_as_user_service
```

---

## VERIFICATION CHECKLIST

After making all changes:

### Frontend
- [ ] `contexts/AuthContext.js` exists
- [ ] `services/imageService.js` exists
- [ ] `pages/UserProfile.js` exists
- [ ] `pages/UserProfile.css` exists
- [ ] `index.js` imports AuthProvider
- [ ] `App.js` has all 7 changes
- [ ] `package.json` has new dependencies
- [ ] Run `npm install`

### User Service
- [ ] `controllers/profileController.js` exists
- [ ] `routes/profile.js` exists
- [ ] `migrations/001_create_user_addresses_table.sql` exists
- [ ] `index.js` imports and uses profile routes
- [ ] Database migration has been run

### Order Service
- [ ] `controllers/orderDeletionController.js` exists
- [ ] `routes/orderDeletion.js` exists
- [ ] `middleware/adminAuth.js` exists
- [ ] `jobs/cleanup.js` exists
- [ ] `index.js` imports and uses deletion routes
- [ ] `index.js` requires cleanup job
- [ ] `models/Order.js` has soft-delete fields
- [ ] `package.json` has node-cron
- [ ] Run `npm install`

---

## START SERVICES

```bash
# Start all services
docker-compose up -d

# Or individually:
cd frontend && npm start
cd services/user-service && npm start
cd services/order-service && npm start
```

---

## TESTING ENDPOINTS

### Test Authentication Persistence
1. Login at http://localhost:3000
2. Refresh the page
3. You should still be logged in

### Test Profile Management
1. Navigate to "My Profile"
2. Update your name/phone
3. Add a delivery address
4. Set it as default

### Test Order Deletion
1. Go to "My Orders"
2. Delete an order
3. Check "Deleted Orders" section
4. Request restoration

### Test Image Service
1. View products page
2. Images should load from Unsplash
3. If no API key, placeholders should show

---

## TROUBLESHOOTING

### If authentication doesn't persist:
- Check browser localStorage: `localStorage.getItem('authToken')`
- Verify JWT_SECRET is set in both services
- Check browser console for errors

### If profile page doesn't load:
- Verify UserProfile.js is in pages folder
- Check import in App.js
- Ensure route is added to Routes

### If addresses don't save:
- Check database migration was run
- Verify user-service has profile routes
- Check MySQL connection

### If order deletion fails:
- Ensure MongoDB is running
- Check Order model has new fields
- Verify deletion routes are registered

---

## FILE TREE AFTER CHANGES

```
ecommerce-analytics-platform/
├── frontend/
│   └── src/
│       ├── contexts/
│       │   └── AuthContext.js              ← NEW
│       ├── services/
│       │   └── imageService.js             ← NEW
│       ├── pages/
│       │   ├── UserProfile.js              ← NEW
│       │   └── UserProfile.css             ← NEW
│       ├── App.js                          ← MODIFIED
│       └── index.js                        ← MODIFIED
│
└── services/
    ├── user-service/
    │   ├── src/
    │   │   ├── controllers/
    │   │   │   └── profileController.js    ← NEW
    │   │   ├── routes/
    │   │   │   └── profile.js              ← NEW
    │   │   └── index.js                    ← MODIFIED
    │   └── migrations/
    │       └── 001_create_user_addresses_table.sql  ← NEW
    │
    └── order-service/
        └── src/
            ├── controllers/
            │   └── orderDeletionController.js  ← NEW
            ├── routes/
            │   └── orderDeletion.js        ← NEW
            ├── middleware/
            │   └── adminAuth.js            ← NEW
            ├── jobs/
            │   └── cleanup.js              ← NEW
            ├── models/
            │   └── Order.js                ← MODIFIED
            └── index.js                    ← MODIFIED
```

---

Last Updated: February 18, 2026
