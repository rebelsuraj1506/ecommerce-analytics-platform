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
  const [loginType, setLoginType] = useState('user'); // 'user' or 'admin'
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? 'login' : 'register';
    
    try {
      const res = await fetch(`http://localhost:8001/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLogin ? 
          { email: formData.email, password: formData.password } :
          { ...formData, role: loginType === 'admin' ? 'admin' : 'customer' }
        )
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Validate role matches login type
        if (isLogin && loginType === 'admin' && data.data.user.role !== 'admin') {
          alert('❌ Access denied. This account is not an admin. Please use User Login instead.');
          return;
        }
        if (isLogin && loginType === 'user' && data.data.user.role === 'admin') {
          alert('❌ This is an admin account. Please use Admin Login instead.');
          return;
        }
        setToken(data.data.token);
        setUser(data.data.user);
        alert(isLogin ? 'Login successful!' : 'Registration successful!');
      } else {
        alert(data.message || 'Authentication failed');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setFormData({ name: '', email: '', password: '' });
  };

  if (!user) {
    return (
      <div style={{minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'}}>
        <div style={{background: 'white', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', maxWidth: '480px', width: '100%', overflow: 'hidden'}}>
          <div style={{background: 'linear-gradient(135deg, #2874f0 0%, #fb641b 100%)', padding: '30px', textAlign: 'center', color: 'white'}}>
            <h1 style={{margin: '0 0 10px 0', fontSize: '32px'}}>🛒 E-Commerce Portal</h1>
            <p style={{margin: 0, opacity: 0.9}}>Professional Order Management System</p>
          </div>

          <div style={{padding: '30px'}}>
            {/* Login Type Selector */}
            <div style={{marginBottom: '25px'}}>
              <label style={{display: 'block', marginBottom: '10px', fontWeight: '500', color: '#212121'}}>Select Login Type</label>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                <div onClick={() => setLoginType('user')} style={{padding: '20px', border: loginType === 'user' ? '2px solid #2874f0' : '1px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer', background: loginType === 'user' ? '#e3f2fd' : 'white', textAlign: 'center', transition: 'all 0.2s'}}>
                  <div style={{fontSize: '32px', marginBottom: '8px'}}>👤</div>
                  <div style={{fontWeight: '500', color: loginType === 'user' ? '#2874f0' : '#212121'}}>User Login</div>
                  <div style={{fontSize: '11px', color: '#757575', marginTop: '5px'}}>Place & track orders</div>
                </div>
                <div onClick={() => { setLoginType('admin'); setIsLogin(true); }} style={{padding: '20px', border: loginType === 'admin' ? '2px solid #f44336' : '1px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer', background: loginType === 'admin' ? '#ffebee' : 'white', textAlign: 'center', transition: 'all 0.2s'}}>
                  <div style={{fontSize: '32px', marginBottom: '8px'}}>🔐</div>
                  <div style={{fontWeight: '500', color: loginType === 'admin' ? '#f44336' : '#212121'}}>Admin Login</div>
                  <div style={{fontSize: '11px', color: '#757575', marginTop: '5px'}}>Manage system</div>
                </div>
              </div>
            </div>

            {/* Login/Register Toggle - Only show register for users, not admins */}
            <div style={{display: 'flex', marginBottom: '25px', background: '#f1f3f6', borderRadius: '4px', padding: '4px'}}>
              <button onClick={() => setIsLogin(true)} style={{flex: 1, padding: '12px', background: isLogin ? 'white' : 'transparent', color: isLogin ? '#2874f0' : '#757575', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', fontSize: '14px', boxShadow: isLogin ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'}}>
                Login
              </button>
              {loginType !== 'admin' && (
                <button onClick={() => setIsLogin(false)} style={{flex: 1, padding: '12px', background: !isLogin ? 'white' : 'transparent', color: !isLogin ? '#2874f0' : '#757575', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', fontSize: '14px', boxShadow: !isLogin ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'}}>
                  Register
                </button>
              )}
            </div>

            {loginType === 'admin' && (
              <div style={{background: '#ffebee', padding: '12px', borderRadius: '4px', marginBottom: '15px', fontSize: '12px', color: '#c62828', borderLeft: '3px solid #f44336'}}>
                Admin accounts can only be created by existing admins from the Admin Panel.
              </div>
            )}

            <form onSubmit={handleAuth}>
              {!isLogin && (
                <input type="text" placeholder="Full Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{width: '100%', padding: '14px', marginBottom: '15px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '14px'}} required={!isLogin} />
              )}
              <input type="email" placeholder="Email Address" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={{width: '100%', padding: '14px', marginBottom: '15px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '14px'}} required />
              <input type="password" placeholder="Password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} style={{width: '100%', padding: '14px', marginBottom: '20px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '14px'}} required />
              
              {!isLogin && (
                <div style={{background: '#fff9e6', padding: '12px', borderRadius: '4px', marginBottom: '20px', fontSize: '12px', color: '#856404', borderLeft: '3px solid #ffc107'}}>
                  Password must contain uppercase, lowercase, number, and special character
                </div>
              )}
              
              <button type="submit" style={{width: '100%', padding: '14px', background: loginType === 'admin' ? 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)' : 'linear-gradient(135deg, #2874f0 0%, #fb641b 100%)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', fontSize: '16px', boxShadow: '0 4px 12px rgba(40,116,240,0.3)'}}>
                {isLogin ? `Login as ${loginType === 'admin' ? 'Admin' : 'User'}` : `Create ${loginType === 'admin' ? 'Admin' : 'User'} Account`}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <BrowserRouter>
      <div style={{display: 'flex', minHeight: '100vh', background: '#f1f3f6'}}>
        <div style={{width: '260px', background: isAdmin ? '#1a1a2e' : '#2c3e50', color: 'white', padding: '0', position: 'fixed', height: '100vh', overflowY: 'auto'}}>
          <div style={{padding: '25px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: isAdmin ? 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)' : 'linear-gradient(135deg, #2874f0 0%, #fb641b 100%)'}}>
            <h2 style={{margin: '0 0 8px 0', fontSize: '24px'}}>🛒 E-Commerce</h2>
            <p style={{margin: 0, fontSize: '13px', opacity: 0.9}}>{isAdmin ? 'Admin Portal' : 'User Portal'}</p>
          </div>

          <div style={{padding: '20px'}}>
            <div style={{background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', marginBottom: '20px'}}>
              <div style={{fontSize: '12px', opacity: 0.7, marginBottom: '5px'}}>Logged in as</div>
              <div style={{fontWeight: '500', fontSize: '14px'}}>{user.name}</div>
              <div style={{fontSize: '11px', opacity: 0.7, marginTop: '3px', padding: '4px 8px', background: isAdmin ? '#f44336' : '#2874f0', borderRadius: '10px', display: 'inline-block', marginTop: '8px'}}>
                {isAdmin ? '🔐 Admin' : '👤 User'}
              </div>
            </div>

            <nav style={{marginBottom: '20px'}}>
              {isAdmin ? (
                <>
                  <NavLink to="/" end style={({isActive}) => ({display: 'block', padding: '12px 15px', color: 'white', textDecoration: 'none', borderRadius: '6px', marginBottom: '8px', background: isActive ? 'rgba(244,67,54,0.3)' : 'transparent', fontWeight: isActive ? '600' : '400'})}>📊 Dashboard</NavLink>
                  <NavLink to="/products" style={({isActive}) => ({display: 'block', padding: '12px 15px', color: 'white', textDecoration: 'none', borderRadius: '6px', marginBottom: '8px', background: isActive ? 'rgba(244,67,54,0.3)' : 'transparent', fontWeight: isActive ? '600' : '400'})}>📦 Products</NavLink>
                  <NavLink to="/orders" style={({isActive}) => ({display: 'block', padding: '12px 15px', color: 'white', textDecoration: 'none', borderRadius: '6px', marginBottom: '8px', background: isActive ? 'rgba(244,67,54,0.3)' : 'transparent', fontWeight: isActive ? '600' : '400'})}>🛒 All Orders</NavLink>
                  <NavLink to="/admin" style={({isActive}) => ({display: 'block', padding: '12px 15px', color: 'white', textDecoration: 'none', borderRadius: '6px', marginBottom: '8px', background: isActive ? 'rgba(244,67,54,0.3)' : 'transparent', fontWeight: isActive ? '600' : '400'})}>🔐 User Management</NavLink>
                  <NavLink to="/categories" style={({isActive}) => ({display: 'block', padding: '12px 15px', color: 'white', textDecoration: 'none', borderRadius: '6px', marginBottom: '8px', background: isActive ? 'rgba(244,67,54,0.3)' : 'transparent', fontWeight: isActive ? '600' : '400'})}>🏷️ Categories</NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/" end style={({isActive}) => ({display: 'block', padding: '12px 15px', color: 'white', textDecoration: 'none', borderRadius: '6px', marginBottom: '8px', background: isActive ? 'rgba(40,116,240,0.3)' : 'transparent', fontWeight: isActive ? '600' : '400'})}>📊 Dashboard</NavLink>
                  <NavLink to="/my-orders" style={({isActive}) => ({display: 'block', padding: '12px 15px', color: 'white', textDecoration: 'none', borderRadius: '6px', marginBottom: '8px', background: isActive ? 'rgba(40,116,240,0.3)' : 'transparent', fontWeight: isActive ? '600' : '400'})}>📦 My Orders</NavLink>
                  <NavLink to="/products" style={({isActive}) => ({display: 'block', padding: '12px 15px', color: 'white', textDecoration: 'none', borderRadius: '6px', marginBottom: '8px', background: isActive ? 'rgba(40,116,240,0.3)' : 'transparent', fontWeight: isActive ? '600' : '400'})}>🛍️ Shop Products</NavLink>
                  <NavLink to="/categories" style={({isActive}) => ({display: 'block', padding: '12px 15px', color: 'white', textDecoration: 'none', borderRadius: '6px', marginBottom: '8px', background: isActive ? 'rgba(40,116,240,0.3)' : 'transparent', fontWeight: isActive ? '600' : '400'})}>🏷️ Categories</NavLink>
                </>
              )}
            </nav>

            <button onClick={logout} style={{width: '100%', padding: '12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'}}>
              🚪 Logout
            </button>
          </div>
        </div>

        <div style={{marginLeft: '260px', flex: 1}}>
          <Routes>
            <Route path="/" element={<Dashboard token={token} userRole={user.role} />} />
            <Route path="/products" element={<Products token={token} userRole={user.role} />} />
            <Route path="/orders" element={<Orders token={token} userRole={user.role} />} />
            <Route path="/categories" element={<Categories token={token} userRole={user.role} />} />
            {isAdmin ? (
              <Route path="/admin" element={<AdminPanel token={token} />} />
            ) : (
              <Route path="/my-orders" element={<MyOrders token={token} userId={user.id} userName={user.name} />} />
            )}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;