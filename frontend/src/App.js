import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Categories from './pages/Categories';
import AdminPanel from './pages/AdminPanel';
import MyOrders from './pages/MyOrders';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loginType, setLoginType] = useState('user');
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const endpoint = isLogin ? 'login' : 'register';
    try {
      const res = await fetch(`http://localhost:8001/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLogin
          ? { email: formData.email, password: formData.password }
          : { ...formData, role: loginType === 'admin' ? 'admin' : 'customer' }
        )
      });
      const data = await res.json();
      if (data.success) {
        if (isLogin && loginType === 'admin' && data.data.user.role !== 'admin') {
          setAuthError('Access denied. This account is not an admin.');
          return;
        }
        if (isLogin && loginType === 'user' && data.data.user.role === 'admin') {
          setAuthError('This is an admin account. Please use Admin Login.');
          return;
        }
        setToken(data.data.token);
        setUser(data.data.user);
      } else {
        setAuthError(data.message || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Network error: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setFormData({ name: '', email: '', password: '' });
    setAuthError('');
  };

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-banner">
            <div className="login-banner-title">🛒 E-Commerce Portal</div>
            <div className="login-banner-sub">Professional Order Management System</div>
          </div>

          <div className="login-body">
            {/* Login Type */}
            <div className="login-type-grid">
              <div
                className={`login-type-card ${loginType === 'user' ? 'selected' : ''}`}
                onClick={() => setLoginType('user')}
              >
                <div className="login-type-icon">👤</div>
                <div className="login-type-name">User Login</div>
                <div className="login-type-desc">Browse & place orders</div>
              </div>
              <div
                className={`login-type-card ${loginType === 'admin' ? 'admin-selected' : ''}`}
                onClick={() => { setLoginType('admin'); setIsLogin(true); }}
              >
                <div className="login-type-icon">🔐</div>
                <div className="login-type-name">Admin Login</div>
                <div className="login-type-desc">Manage the system</div>
              </div>
            </div>

            {/* Login / Register tabs */}
            <div className="login-tabs">
              <button className={`login-tab${isLogin ? ' active' : ''}`} onClick={() => setIsLogin(true)}>Sign In</button>
              {loginType !== 'admin' && (
                <button className={`login-tab${!isLogin ? ' active' : ''}`} onClick={() => setIsLogin(false)}>Create Account</button>
              )}
            </div>

            {loginType === 'admin' && (
              <div className="alert alert-danger mb-16">
                🔒 Admin accounts are created only by existing admins from the Admin Panel.
              </div>
            )}

            {authError && (
              <div className="alert alert-danger mb-16">{authError}</div>
            )}

            <form className="login-form" onSubmit={handleAuth}>
              {!isLogin && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text" className="form-control" placeholder="Enter your full name"
                    value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required={!isLogin}
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email" className="form-control" placeholder="you@example.com"
                  value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password" className="form-control" placeholder="Enter your password"
                  value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                />
              </div>
              {!isLogin && (
                <div className="alert alert-warning">
                  Password must contain uppercase, lowercase, number, and special character.
                </div>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className={`login-submit ${loginType === 'admin' ? 'admin-submit' : 'user-submit'}`}
              >
                {authLoading
                  ? 'Please wait…'
                  : isLogin
                    ? `Sign in as ${loginType === 'admin' ? 'Admin' : 'User'}`
                    : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  const adminLinks = [
    { to: '/', label: 'Dashboard', icon: '📊', end: true },
    { to: '/products', label: 'Products', icon: '📦' },
    { to: '/orders', label: 'All Orders', icon: '🛒' },
    { to: '/admin', label: 'User Management', icon: '🔐' },
    { to: '/categories', label: 'Categories', icon: '🏷️' },
  ];

  const userLinks = [
    { to: '/', label: 'Dashboard', icon: '📊', end: true },
    { to: '/my-orders', label: 'My Orders', icon: '📦' },
    { to: '/products', label: 'Shop Products', icon: '🛍️' },
    { to: '/categories', label: 'Categories', icon: '🏷️' },
  ];

  const navLinks = isAdmin ? adminLinks : userLinks;

  return (
    <BrowserRouter>
      <div className="app-shell">
        {/* Sidebar */}
        <aside className={`sidebar${isAdmin ? ' admin-mode' : ''}`}>
          <div className="sidebar-brand">
            <div className="sidebar-brand-inner">
              <div className="sidebar-brand-icon">🛒</div>
              <div>
                <div className="sidebar-brand-name">E-Commerce</div>
                <div className="sidebar-brand-sub">{isAdmin ? 'Admin Portal' : 'User Portal'}</div>
              </div>
            </div>
          </div>

          <div className="sidebar-user-card">
            <div className="sidebar-user-greeting">Logged in as</div>
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-role-badge">{isAdmin ? 'admin' : 'user'} {isAdmin ? '🔐 Admin' : '👤 User'}</div>
          </div>

          <nav className="sidebar-nav">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => isActive ? 'active' : ''}
              >
                <span className="nav-icon">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className="btn-logout" onClick={logout}>
              🚪 Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard token={token} userRole={user.role} />} />
            <Route path="/products" element={<Products token={token} userRole={user.role} />} />
            <Route path="/orders" element={<Orders token={token} userRole={user.role} />} />
            <Route path="/categories" element={<Categories token={token} userRole={user.role} />} />
            {isAdmin
              ? <Route path="/admin" element={<AdminPanel token={token} />} />
              : <Route path="/my-orders" element={<MyOrders token={token} userId={user.id} userName={user.name} />} />
            }
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
