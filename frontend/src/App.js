import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Categories from './pages/Categories';
import AdminPanel from './pages/AdminPanel';
import MyOrders from './pages/MyOrders';
import UserProfile from './pages/UserProfile';
import { useAuth } from './contexts/AuthContext';

/* ── Authenticated shell — needs useNavigate so lives inside BrowserRouter ── */
function AuthShell({ user, token, logout }) {
  const navigate = useNavigate();
  const [headerSearch, setHeaderSearch] = useState('');
  const searchRef = useRef(null);
  const isAdmin = user.role === 'admin';
  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  /* Ctrl+K / Cmd+K focuses the search bar */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (headerSearch.trim()) {
      navigate(`/products?search=${encodeURIComponent(headerSearch.trim())}`);
    }
  };

  const adminLinks = [
    { to: '/',           label: 'Dashboard',  icon: '📊', end: true },
    { to: '/products',   label: 'Products',   icon: '📦' },
    { to: '/orders',     label: 'All Orders', icon: '🛒' },
    { to: '/admin',      label: 'User Mgmt',  icon: '🔐' },
    { to: '/categories', label: 'Categories', icon: '🏷️' },
  ];

  const userLinks = [
    { to: '/',           label: 'Home',       icon: '🏠', end: true },
    { to: '/products',   label: 'Shop',       icon: '🛍️' },
    { to: '/categories', label: 'Categories', icon: '🏷️' },
    { to: '/my-orders',  label: 'My Orders',  icon: '📦' },
    { to: '/profile',    label: 'My Account', icon: '👤' },
  ];

  const navLinks = isAdmin ? adminLinks : userLinks;

  return (
    <div className="app-shell">
      {/* ── Top Header ── */}
      <header className="top-header">
        <div className="header-brand">
          <div className="header-brand-logo">🛒</div>
          <div>
            <div className="header-brand-name">ShopMart</div>
            <div className="header-brand-tag">{isAdmin ? 'Admin Portal' : 'Explore Plus'}</div>
          </div>
        </div>

        {/* Functional search — routes to /products?search=… */}
        {!isAdmin && (
          <form className="header-search" onSubmit={handleSearchSubmit}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search products, brands…  ⌘K"
              value={headerSearch}
              onChange={e => setHeaderSearch(e.target.value)}
            />
            <button type="submit" className="header-search-btn">🔍</button>
          </form>
        )}

        <div className="header-nav">
          <div className="header-user-pill">
            <div className="header-user-avatar">{initials}</div>
            <span className="header-user-name">{user.name?.split(' ')[0]}</span>
            {isAdmin && (
              <span style={{fontSize:'.6rem',background:'rgba(255,229,0,.2)',color:'#ffe500',padding:'1px 5px',borderRadius:'3px',fontWeight:700}}>ADMIN</span>
            )}
          </div>
          <button className="header-signout" onClick={logout}>
            <span>↩</span> Sign Out
          </button>
        </div>
      </header>

      {/* ── Sub Nav ── */}
      <nav className="sub-nav">
        {navLinks.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `sub-nav-link${isActive ? ' active' : ''}`}
          >
            <span className="snl-icon">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* ── Main ── */}
      <main className="main-content">
        <Routes>
          <Route path="/"           element={<Dashboard token={token} userRole={user.role} />} />
          <Route path="/products"   element={<Products  token={token} userRole={user.role} />} />
          <Route path="/orders"     element={<Orders    token={token} userRole={user.role} />} />
          <Route path="/categories" element={<Categories token={token} userRole={user.role} />} />
          <Route path="/profile"    element={<UserProfile />} />
          {isAdmin
            ? <Route path="/admin"     element={<AdminPanel token={token} />} />
            : <Route path="/my-orders" element={<MyOrders token={token} userId={user.id} userName={user.name} />} />
          }
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

/* ── Login / Register page ── */
function LoginPage() {
  const { login, register } = useAuth();
  const [loginType, setLoginType]   = useState('user');
  const [isLogin, setIsLogin]       = useState(true);
  const [formData, setFormData]     = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError]   = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password, loginType);
      } else {
        await register(formData.name, formData.email, formData.password, loginType === 'admin' ? 'admin' : 'customer');
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-banner">
          <div className="login-banner-logo">
            <div className="login-banner-logo-icon">🛒</div>
            <div>
              <div className="login-banner-title">ShopMart</div>
              <div className="login-banner-sub">India's trusted e-commerce platform</div>
            </div>
          </div>
          <div className="login-banner-tag">✦ Millions of products. Unbeatable prices.</div>
        </div>

        <div className="login-body">
          <div className="login-type-grid">
            <div
              className={`login-type-card ${loginType === 'user' ? 'selected' : ''}`}
              onClick={() => setLoginType('user')}
            >
              <div className="login-type-icon">👤</div>
              <div className="login-type-name">User Login</div>
              <div className="login-type-desc">Browse &amp; place orders</div>
            </div>
            <div
              className={`login-type-card ${loginType === 'admin' ? 'admin-selected' : ''}`}
              onClick={() => { setLoginType('admin'); setIsLogin(true); }}
            >
              <div className="login-type-icon">🔐</div>
              <div className="login-type-name">Admin Login</div>
              <div className="login-type-desc">Manage the platform</div>
            </div>
          </div>

          <div className="login-tabs">
            <button className={`login-tab${isLogin ? ' active' : ''}`} onClick={() => setIsLogin(true)}>Sign In</button>
            {loginType !== 'admin' && (
              <button className={`login-tab${!isLogin ? ' active' : ''}`} onClick={() => setIsLogin(false)}>Create Account</button>
            )}
          </div>

          {loginType === 'admin' && (
            <div className="alert alert-danger mb-16">
              🔒 Admin accounts are created only by existing admins.
            </div>
          )}
          {authError && <div className="alert alert-danger mb-16">{authError}</div>}

          <form className="login-form" onSubmit={handleAuth}>
            {!isLogin && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" className="form-control" placeholder="Enter your full name"
                  value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required={!isLogin} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-control" placeholder="you@example.com"
                value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--gray-500)', padding: 0, lineHeight: 1 }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {!isLogin && (
              <div className="alert alert-warning">
                Password must contain uppercase, lowercase, number, and special character.
              </div>
            )}
            <button type="submit" disabled={authLoading}
              className={`login-submit ${loginType === 'admin' ? 'admin-submit' : 'user-submit'}`}>
              {authLoading ? 'Please wait…' : isLogin
                ? `Sign in as ${loginType === 'admin' ? 'Admin' : 'User'}`
                : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Root App ── */
function AppContent() {
  const { user, token, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <BrowserRouter>
      <AuthShell user={user} token={token} logout={logout} />
    </BrowserRouter>
  );
}

function App() {
  return <AppContent />;
}

export default App;
