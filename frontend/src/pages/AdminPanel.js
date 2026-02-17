import React, { useState, useEffect } from 'react';

function AdminPanel({ token }) {
  const [view, setView] = useState('users'); // 'orders', 'users', 'user-details', 'add-user'
  const [allOrders, setAllOrders] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [bulkDeletingOrders, setBulkDeletingOrders] = useState(false);
  const [detailRequests, setDetailRequests] = useState([]);
  const [detailRequestsLoading, setDetailRequestsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [addUserForm, setAddUserForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'customer'
  });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserMessage, setAddUserMessage] = useState(null);

  const formatPrice = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const getShippingDisplay = (addr) => {
    if (!addr) return { line: null, phone: null };
    const a = typeof addr === 'string' ? (() => { try { return JSON.parse(addr); } catch { return null; } })() : addr;
    if (!a || typeof a !== 'object') return { line: null, phone: null };
    const parts = [a.street, a.city, a.state].filter(Boolean);
    const zip = a.zipCode ? ` - ${a.zipCode}` : '';
    return { line: parts.length ? parts.join(', ') + zip : null, phone: a.phone || null };
  };

  const fetchData = async () => {
    try {
      // Fetch users first (most important for admin)
      let users = [];
      try {
        const usersRes = await fetch('http://localhost:8001/api/users', { 
          headers: { 'Authorization': `Bearer ${token}` } 
        });
        const usersData = await usersRes.json();
        console.log('Users API response:', usersData);
        users = usersData.data?.users || [];
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }

      // Fetch orders
      let orders = [];
      try {
        const ordersRes = await fetch('http://localhost:8003/api/orders', { 
          headers: { 'Authorization': `Bearer ${token}` } 
        });
        const ordersData = await ordersRes.json();
        orders = ordersData.data?.orders || [];
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      }

      // Fetch pending order detail requests (admin)
      setDetailRequestsLoading(true);
      try {
        const reqRes = await fetch('http://localhost:8003/api/orders/detail-requests/list?status=pending', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const reqData = await reqRes.json();
        setDetailRequests(reqData.data?.requests || []);
      } catch (err) {
        console.error('Failed to fetch detail requests:', err);
        setDetailRequests([]);
      } finally {
        setDetailRequestsLoading(false);
      }

      // Fetch products
      let productList = [];
      try {
        const productsRes = await fetch('http://localhost:8002/api/products?limit=100');
        const productsData = await productsRes.json();
        productList = productsData.data?.products || [];
      } catch (err) {
        console.error('Failed to fetch products:', err);
      }
      
      const productMap = {};
      productList.forEach(p => { productMap[p._id] = p; });
      setProducts(productMap);
      setAllOrders(orders);
      setAllUsers(users);
      setLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Clear selection when switching filter/view
  useEffect(() => {
    setSelectedOrderIds([]);
  }, [filterStatus, view]);

  // ========== ADD USER ==========
  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddUserLoading(true);
    setAddUserMessage(null);

    try {
      const res = await fetch('http://localhost:8001/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(addUserForm)
      });

      const data = await res.json();

      if (data.success) {
        setAddUserMessage({ type: 'success', text: `✅ ${data.message} — ${addUserForm.name} (${addUserForm.email})` });
        setAddUserForm({ name: '', email: '', password: '', phone: '', role: 'customer' });
        // Refresh user list
        await fetchData();
      } else {
        const errorMsg = data.errors ? data.errors.map(e => e.msg).join(', ') : data.message;
        setAddUserMessage({ type: 'error', text: `❌ ${errorMsg}` });
      }
    } catch (err) {
      setAddUserMessage({ type: 'error', text: `❌ Error: ${err.message}` });
    } finally {
      setAddUserLoading(false);
    }
  };

  // ========== DELETE ALL USERS ==========
  const handleDeleteAllUsers = async (includeAdmins) => {
    const typeLabel = includeAdmins ? 'ALL USERS AND ADMINS' : 'ALL USERS (non-admin)';
    const confirmation = window.prompt(
      `⚠️ WARNING: DELETE ${typeLabel}\n\n` +
      `This will permanently delete:\n` +
      `• All ${includeAdmins ? 'user and admin' : 'non-admin user'} accounts\n` +
      `• All their order history\n` +
      `• All their personal data\n\n` +
      `Your admin account will be preserved.\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "DELETE ALL" to confirm:`
    );

    if (confirmation !== 'DELETE ALL') {
      alert('❌ Deletion cancelled. Text did not match.');
      return;
    }

    try {
      const res = await fetch('http://localhost:8001/api/users/all', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ includeAdmins })
      });

      const data = await res.json();

      if (data.success) {
        alert(`✅ ${data.message}`);
        await fetchData();
      } else {
        alert('Error: ' + (data.message || 'Failed to delete users'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ========== CANCELLATION ACTION ==========
  const handleCancellationAction = async (orderId, action) => {
    const endpoint = action === 'approve' 
      ? `http://localhost:8003/api/orders/${orderId}/approve-cancel`
      : `http://localhost:8003/api/orders/${orderId}/reject-cancel`;
    
    let body = {};
    if (action === 'reject') {
      const reason = prompt('Enter rejection reason:');
      if (!reason) return;
      body.rejectionReason = reason;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        alert(action === 'approve' ? '✅ Cancellation approved!' : '❌ Cancellation rejected!');
        await fetchData();
      } else {
        const data = await res.json();
        alert('Error: ' + (data.message || 'Action failed'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const updateDetailRequest = async (requestId, action) => {
    const note = action === 'reject' ? prompt('Enter rejection note (optional):') : prompt('Enter approval note (optional):');
    try {
      const res = await fetch(`http://localhost:8003/api/orders/detail-requests/${requestId}/${action}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ adminNote: note || '' })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Request ${action}d`);
        await fetchData();
      } else {
        alert(data.message || 'Failed to update request');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ========== DELETE ORDERS (SINGLE / BULK) ==========
  const deleteOrders = async (orderIds) => {
    const ids = Array.from(new Set(orderIds)).filter(Boolean);
    if (ids.length === 0) return;

    const confirmMsg = ids.length === 1
      ? `Delete order #${ids[0]}? This cannot be undone.`
      : `Delete ${ids.length} orders? This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setBulkDeletingOrders(true);
    const succeeded = [];
    const failed = [];

    try {
      const results = await Promise.allSettled(ids.map(async (id) => {
        const res = await fetch(`http://localhost:8003/api/orders/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Failed to delete order #${id}`);
        }
        return id;
      }));

      results.forEach((r, idx) => {
        const id = ids[idx];
        if (r.status === 'fulfilled') succeeded.push(id);
        else failed.push({ id, error: r.reason?.message || String(r.reason) });
      });

      if (succeeded.length > 0) {
        setAllOrders(prev => prev.filter(o => !succeeded.includes(o.id)));
        setSelectedOrderIds(prev => prev.filter(id => !succeeded.includes(id)));
      }

      if (failed.length > 0) {
        alert(
          `Deleted: ${succeeded.length}\nFailed: ${failed.length}\n\n` +
          failed.slice(0, 5).map(f => `#${f.id}: ${f.error}`).join('\n')
        );
      } else {
        alert(ids.length === 1 ? '✅ Order deleted!' : `✅ ${succeeded.length} orders deleted!`);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBulkDeletingOrders(false);
    }
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
  };

  // ========== DELETE SINGLE USER ==========
  const deleteUser = async (userId, userName) => {
    const confirmation = window.prompt(
      `⚠️ DELETE USER: ${userName}\n\n` +
      `This will permanently delete:\n` +
      `• User account and profile\n` +
      `• All order history\n` +
      `• All personal data\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "DELETE ${userName}" to confirm:`
    );

    if (confirmation !== `DELETE ${userName}`) {
      alert('❌ Deletion cancelled. Text did not match.');
      return;
    }

    try {
      const res = await fetch(`http://localhost:8001/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        alert(`✅ User "${userName}" and all associated data has been permanently deleted.`);
        if (view === 'user-details') {
          setView('users');
          setSelectedUser(null);
        }
        await fetchData();
      } else {
        const data = await res.json();
        alert('Error: ' + (data.message || 'Failed to delete user'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ========== USER STATS ==========
  const getUserStats = (userId) => {
    const userOrders = allOrders.filter(o => o.userId === userId);
    const totalSpent = userOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalOrders = userOrders.length;
    const completedOrders = userOrders.filter(o => o.status === 'delivered').length;
    const cancelledOrders = userOrders.filter(o => ['cancelled', 'cancel_requested'].includes(o.status)).length;
    
    const itemsPurchased = [];
    userOrders.forEach(order => {
      order.items?.forEach(item => {
        const product = products[item.product_id || item.productId];
        if (product) {
          const existing = itemsPurchased.find(p => p.id === product._id);
          if (existing) {
            existing.quantity += item.quantity;
            existing.totalSpent += item.quantity * item.price;
          } else {
            itemsPurchased.push({
              id: product._id,
              name: product.name,
              quantity: item.quantity,
              totalSpent: item.quantity * item.price,
              image: product.images?.[0]
            });
          }
        }
      });
    });

    itemsPurchased.sort((a, b) => b.totalSpent - a.totalSpent);

    return {
      totalSpent,
      totalOrders,
      completedOrders,
      cancelledOrders,
      itemsPurchased,
      avgOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
      recentOrders: userOrders.slice(0, 5)
    };
  };

  const filteredOrders = filterStatus === 'all' ? allOrders : allOrders.filter(o => o.status === filterStatus);
  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds.includes(o.id));

  const filteredUsers = allUsers.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return user.name?.toLowerCase().includes(query) || 
           user.email?.toLowerCase().includes(query) ||
           user.id?.toString().includes(query);
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const statsA = getUserStats(a.id);
    const statsB = getUserStats(b.id);
    
    switch (sortBy) {
      case 'totalSpent': return statsB.totalSpent - statsA.totalSpent;
      case 'orders': return statsB.totalOrders - statsA.totalOrders;
      case 'recent': return new Date(b.createdAt) - new Date(a.createdAt);
      default: return 0;
    }
  });

  const stats = {
    totalUsers: allUsers.filter(u => u.role !== 'admin').length,
    totalAdmins: allUsers.filter(u => u.role === 'admin').length,
    totalOrders: allOrders.length,
    totalRevenue: allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
    pendingCancellations: allOrders.filter(o => o.status === 'cancel_requested').length,
    activeUsers: allUsers.filter(u => {
      const userOrders = allOrders.filter(o => o.userId === u.id);
      return userOrders.length > 0;
    }).length
  };

  if (loading) {
    return <div style={{textAlign: 'center', padding: '40px'}}>Loading admin panel...</div>;
  }

  // ==================== USER DETAILS VIEW ====================
  if (view === 'user-details' && selectedUser) {
    const userStats = getUserStats(selectedUser.id);

    return (
      <div style={{background: '#f1f3f6', minHeight: '100vh', padding: '20px'}}>
        <div style={{maxWidth: '1400px', margin: '0 auto'}}>
          <button 
            onClick={() => { setView('users'); setSelectedUser(null); }}
            style={{padding: '10px 20px', background: '#757575', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px', fontSize: '14px', fontWeight: '500'}}
          >
            ← Back to Users
          </button>

          {/* User Header */}
          <div style={{background: 'white', padding: '30px', borderRadius: '4px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px'}}>
              <div style={{display: 'flex', gap: '20px', alignItems: 'center'}}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%', 
                  background: selectedUser.role === 'admin' 
                    ? 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', color: 'white'
                }}>
                  {selectedUser.role === 'admin' ? '🔐' : (selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : '👤')}
                </div>
                <div>
                  <h2 style={{margin: '0 0 5px 0', fontSize: '28px', fontWeight: '500'}}>{selectedUser.name || 'Anonymous User'}</h2>
                  <div style={{fontSize: '14px', color: '#757575', marginBottom: '5px'}}>
                    User ID: {selectedUser.id} &nbsp;•&nbsp; 
                    <span style={{
                      padding: '2px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600',
                      background: selectedUser.role === 'admin' ? '#ffebee' : '#e3f2fd',
                      color: selectedUser.role === 'admin' ? '#f44336' : '#2874f0'
                    }}>
                      {selectedUser.role.toUpperCase()}
                    </span>
                  </div>
                  <div style={{fontSize: '14px', color: '#757575'}}>Member since: {new Date(selectedUser.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
              </div>
              
              <button 
                onClick={() => deleteUser(selectedUser.id, selectedUser.name)}
                style={{padding: '12px 24px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px'}}
              >
                🗑️ Delete User
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px'}}>
            <div style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', borderRadius: '8px'}}>
              <div style={{fontSize: '0.85em', opacity: 0.9}}>Total Spent</div>
              <div style={{fontSize: '2em', fontWeight: 'bold', marginTop: '5px'}}>₹{formatPrice(userStats.totalSpent)}</div>
            </div>
            <div style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', padding: '20px', borderRadius: '8px'}}>
              <div style={{fontSize: '0.85em', opacity: 0.9}}>Total Orders</div>
              <div style={{fontSize: '2em', fontWeight: 'bold', marginTop: '5px'}}>{userStats.totalOrders}</div>
            </div>
            <div style={{background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', padding: '20px', borderRadius: '8px'}}>
              <div style={{fontSize: '0.85em', opacity: 0.9}}>Completed</div>
              <div style={{fontSize: '2em', fontWeight: 'bold', marginTop: '5px'}}>{userStats.completedOrders}</div>
            </div>
            <div style={{background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white', padding: '20px', borderRadius: '8px'}}>
              <div style={{fontSize: '0.85em', opacity: 0.9}}>Avg Order Value</div>
              <div style={{fontSize: '2em', fontWeight: 'bold', marginTop: '5px'}}>₹{formatPrice(userStats.avgOrderValue)}</div>
            </div>
          </div>

          {/* Contact Information — FULL DETAILS (no masking) */}
          <div style={{background: 'white', padding: '20px', borderRadius: '4px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <h3 style={{marginTop: 0}}>📞 Contact Information</h3>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px'}}>
              <div style={{padding: '15px', background: '#f8f9fa', borderRadius: '4px'}}>
                <div style={{fontSize: '12px', color: '#757575', marginBottom: '5px'}}>EMAIL</div>
                <div style={{fontSize: '16px', fontWeight: '500', fontFamily: 'monospace'}}>{selectedUser.email}</div>
              </div>
              <div style={{padding: '15px', background: '#f8f9fa', borderRadius: '4px'}}>
                <div style={{fontSize: '12px', color: '#757575', marginBottom: '5px'}}>PHONE</div>
                <div style={{fontSize: '16px', fontWeight: '500'}}>{selectedUser.phone || 'Not provided'}</div>
              </div>
              <div style={{padding: '15px', background: '#f8f9fa', borderRadius: '4px'}}>
                <div style={{fontSize: '12px', color: '#757575', marginBottom: '5px'}}>ROLE</div>
                <div style={{fontSize: '16px', fontWeight: '500', textTransform: 'capitalize'}}>{selectedUser.role}</div>
              </div>
            </div>
          </div>

          {/* Items Purchased */}
          {userStats.itemsPurchased.length > 0 && (
            <div style={{background: 'white', padding: '20px', borderRadius: '4px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
              <h3 style={{marginTop: 0}}>🛍️ Items Purchased ({userStats.itemsPurchased.length} unique products)</h3>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px'}}>
                {userStats.itemsPurchased.slice(0, 12).map(item => (
                  <div key={item.id} style={{border: '1px solid #e0e0e0', borderRadius: '4px', padding: '12px', background: '#fafafa'}}>
                    {item.image && (
                      <img src={item.image} alt={item.name} style={{width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px', marginBottom: '10px'}} />
                    )}
                    <div style={{fontSize: '13px', fontWeight: '500', marginBottom: '5px', height: '32px', overflow: 'hidden'}}>{item.name}</div>
                    <div style={{fontSize: '12px', color: '#757575', marginBottom: '3px'}}>Qty: {item.quantity}</div>
                    <div style={{fontSize: '14px', fontWeight: '600', color: '#388e3c'}}>₹{formatPrice(item.totalSpent)}</div>
                  </div>
                ))}
              </div>
              {userStats.itemsPurchased.length > 12 && (
                <div style={{marginTop: '15px', textAlign: 'center', color: '#757575', fontSize: '14px'}}>+ {userStats.itemsPurchased.length - 12} more products</div>
              )}
            </div>
          )}

          {/* Order History */}
          <div style={{background: 'white', padding: '20px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <h3 style={{marginTop: 0}}>📦 Order History ({userStats.totalOrders} orders)</h3>
            {userStats.recentOrders.length === 0 ? (
              <p style={{textAlign: 'center', color: '#757575', padding: '30px'}}>No orders found for this user</p>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {userStats.recentOrders.map(order => {
                  const firstItem = order.items?.[0];
                  const product = firstItem ? products[firstItem.product_id || firstItem.productId] : null;
                  
                  return (
                    <div key={order.id} style={{padding: '15px', border: '1px solid #e0e0e0', borderRadius: '4px', background: order.status === 'cancel_requested' ? '#fff9e6' : '#fafafa'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                        <div>
                          <strong>Order #{order.id}</strong>
                          <span style={{color: '#757575', fontSize: '13px', marginLeft: '10px'}}>
                            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div style={{padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '500', color: 'white', background: order.status === 'delivered' ? '#388e3c' : order.status === 'cancelled' ? '#f44336' : '#2874f0', textTransform: 'capitalize'}}>
                          {order.status.replace('_', ' ')}
                        </div>
                      </div>
                      <div style={{fontSize: '14px', color: '#212121', marginBottom: '5px'}}>{product ? product.name : 'Order'}</div>
                      <div style={{fontSize: '16px', fontWeight: '600', color: '#388e3c'}}>₹{formatPrice(order.totalAmount)}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {userStats.totalOrders > 5 && (
              <div style={{marginTop: '15px', textAlign: 'center', padding: '10px', background: '#f8f9fa', borderRadius: '4px', color: '#757575', fontSize: '14px'}}>
                Showing recent 5 orders • Total: {userStats.totalOrders} orders
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN ADMIN PANEL ====================
  return (
    <div className="page-wrap">
      <div className="page-header">
        <div className="page-title-row">
          <span style={{fontSize: '1.4rem'}}>🔐</span>
          <h1 className="page-title">User Management</h1>
        </div>
      </div>
      <div className="page-body">
        <div style={{background: 'white', padding: '20px 30px', borderRadius: '2px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
          <h2 style={{margin: '0 0 20px 0', color: '#212121', fontSize: '24px', fontWeight: '500'}}>🔐 Admin Control Panel</h2>
          
          {/* Stats Cards */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px', marginBottom: '20px'}}>
            <div style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', borderRadius: '8px'}}>
              <div style={{fontSize: '0.85em', opacity: 0.9}}>Total Users</div>
              <div style={{fontSize: '2em', fontWeight: 'bold', marginTop: '5px'}}>{stats.totalUsers}</div>
            </div>
            <div style={{background: 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)', color: 'white', padding: '20px', borderRadius: '8px'}}>
              <div style={{fontSize: '0.85em', opacity: 0.9}}>Admins</div>
              <div style={{fontSize: '2em', fontWeight: 'bold', marginTop: '5px'}}>{stats.totalAdmins}</div>
            </div>
            <div style={{background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white', padding: '20px', borderRadius: '8px'}}>
              <div style={{fontSize: '0.85em', opacity: 0.9}}>Active Users</div>
              <div style={{fontSize: '2em', fontWeight: 'bold', marginTop: '5px'}}>{stats.activeUsers}</div>
            </div>
            <div style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', padding: '20px', borderRadius: '8px'}}>
              <div style={{fontSize: '0.85em', opacity: 0.9}}>Total Orders</div>
              <div style={{fontSize: '2em', fontWeight: 'bold', marginTop: '5px'}}>{stats.totalOrders}</div>
            </div>
            <div style={{background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', padding: '20px', borderRadius: '8px'}}>
              <div style={{fontSize: '0.85em', opacity: 0.9}}>Total Revenue</div>
              <div style={{fontSize: '2em', fontWeight: 'bold', marginTop: '5px'}}>₹{formatPrice(stats.totalRevenue)}</div>
            </div>
            {stats.pendingCancellations > 0 && (
              <div style={{background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white', padding: '20px', borderRadius: '8px'}}>
                <div style={{fontSize: '0.85em', opacity: 0.9}}>Pending Cancellations</div>
                <div style={{fontSize: '2em', fontWeight: 'bold', marginTop: '5px'}}>{stats.pendingCancellations}</div>
              </div>
            )}
          </div>

          {/* View Tabs */}
          <div style={{display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap'}}>
            <button onClick={() => setView('users')} style={{padding: '10px 20px', background: view === 'users' ? '#2874f0' : 'white', color: view === 'users' ? 'white' : '#212121', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: 'pointer', fontWeight: '500'}}>
              👥 User Management
            </button>
            <button onClick={() => setView('add-user')} style={{padding: '10px 20px', background: view === 'add-user' ? '#388e3c' : 'white', color: view === 'add-user' ? 'white' : '#212121', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: 'pointer', fontWeight: '500'}}>
              ➕ Add User / Admin
            </button>
            <button onClick={() => setView('orders')} style={{padding: '10px 20px', background: view === 'orders' ? '#2874f0' : 'white', color: view === 'orders' ? 'white' : '#212121', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: 'pointer', fontWeight: '500'}}>
              📦 All Orders
            </button>
          </div>
        </div>

        {/* ==================== ADD USER VIEW ==================== */}
        {view === 'add-user' && (
          <div style={{background: 'white', padding: '30px', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', maxWidth: '600px'}}>
            <h3 style={{marginTop: 0, marginBottom: '25px'}}>➕ Add New User or Admin</h3>

            {addUserMessage && (
              <div style={{
                padding: '15px', 
                borderRadius: '4px', 
                marginBottom: '20px',
                background: addUserMessage.type === 'success' ? '#e8f5e9' : '#ffebee',
                color: addUserMessage.type === 'success' ? '#2e7d32' : '#c62828',
                borderLeft: `3px solid ${addUserMessage.type === 'success' ? '#4caf50' : '#f44336'}`
              }}>
                {addUserMessage.text}
              </div>
            )}

            <form onSubmit={handleAddUser}>
              {/* Role Selector */}
              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: '500', color: '#212121'}}>Account Type</label>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px'}}>
                  {[
                    { value: 'customer', label: '👤 User', color: '#2874f0' },
                    { value: 'merchant', label: '🏪 Merchant', color: '#ff9800' },
                    { value: 'admin', label: '🔐 Admin', color: '#f44336' }
                  ].map(opt => (
                    <div 
                      key={opt.value}
                      onClick={() => setAddUserForm({...addUserForm, role: opt.value})}
                      style={{
                        padding: '15px', 
                        border: addUserForm.role === opt.value ? `2px solid ${opt.color}` : '1px solid #e0e0e0', 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        background: addUserForm.role === opt.value ? `${opt.color}10` : 'white',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{fontSize: '24px', marginBottom: '5px'}}>{opt.label.split(' ')[0]}</div>
                      <div style={{fontWeight: '500', fontSize: '13px', color: addUserForm.role === opt.value ? opt.color : '#212121'}}>
                        {opt.label.split(' ').slice(1).join(' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px'}}>Full Name *</label>
                <input 
                  type="text" placeholder="e.g. John Doe" value={addUserForm.name} required
                  onChange={(e) => setAddUserForm({...addUserForm, name: e.target.value})}
                  className="form-control"
                />
              </div>

              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px'}}>Email Address *</label>
                <input 
                  type="email" placeholder="e.g. john@example.com" value={addUserForm.email} required
                  onChange={(e) => setAddUserForm({...addUserForm, email: e.target.value})}
                  className="form-control"
                />
              </div>

              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px'}}>Password *</label>
                <input 
                  type="password" placeholder="Min 8 chars, upper, lower, number, special" value={addUserForm.password} required
                  onChange={(e) => setAddUserForm({...addUserForm, password: e.target.value})}
                  className="form-control"
                />
                <div style={{fontSize: '11px', color: '#757575', marginTop: '5px'}}>
                  Must contain: uppercase, lowercase, number, and special character (@$!%*?&)
                </div>
              </div>

              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px'}}>Phone Number (optional)</label>
                <input 
                  type="tel" placeholder="e.g. +91 9876543210" value={addUserForm.phone}
                  onChange={(e) => setAddUserForm({...addUserForm, phone: e.target.value})}
                  className="form-control"
                />
              </div>

              {addUserForm.role === 'admin' && (
                <div style={{background: '#fff9e6', padding: '12px', borderRadius: '4px', marginBottom: '20px', borderLeft: '3px solid #ffc107'}}>
                  <div style={{fontSize: '13px', color: '#856404'}}>
                    <strong>⚠️ Admin accounts</strong> have full access to manage users, orders, and system settings.
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={addUserLoading}
                style={{
                  width: '100%', padding: '14px', 
                  background: addUserLoading ? '#bdbdbd' : (addUserForm.role === 'admin' ? 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)' : 'linear-gradient(135deg, #388e3c 0%, #43a047 100%)'),
                  color: 'white', border: 'none', borderRadius: '4px', cursor: addUserLoading ? 'not-allowed' : 'pointer', fontWeight: '500', fontSize: '16px'
                }}
              >
                {addUserLoading ? 'Creating...' : `Create ${addUserForm.role === 'admin' ? 'Admin' : addUserForm.role === 'merchant' ? 'Merchant' : 'User'} Account`}
              </button>
            </form>
          </div>
        )}

        {/* ==================== USER MANAGEMENT VIEW ==================== */}
        {view === 'users' && (
          <div style={{background: 'white', padding: '20px', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px'}}>
              <h3 style={{margin: 0}}>User Management ({allUsers.length} Total)</h3>
              
              <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
                <input 
                  type="text"
                  placeholder="🔍 Search by name, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{padding: '8px 15px', border: '1px solid #e0e0e0', borderRadius: '20px', fontSize: '14px', width: '280px'}}
                />
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{padding: '8px 15px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '14px', cursor: 'pointer'}}
                >
                  <option value="recent">Sort: Recently Joined</option>
                  <option value="totalSpent">Sort: Total Spent</option>
                  <option value="orders">Sort: Orders Count</option>
                </select>
              </div>
            </div>

            {/* Delete All Users Section */}
            <div style={{padding: '15px', background: '#ffebee', borderRadius: '4px', marginBottom: '20px', borderLeft: '3px solid #f44336'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
                <div>
                  <div style={{fontWeight: '600', color: '#c62828', marginBottom: '5px'}}>⚠️ Danger Zone</div>
                  <div style={{fontSize: '13px', color: '#b71c1c'}}>Delete users in bulk. Your admin account will be preserved.</div>
                </div>
                <div style={{display: 'flex', gap: '10px'}}>
                  <button 
                    onClick={() => handleDeleteAllUsers(false)}
                    style={{padding: '8px 16px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'}}
                  >
                    🗑️ Delete All Users
                  </button>
                  <button 
                    onClick={() => handleDeleteAllUsers(true)}
                    style={{padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'}}
                  >
                    💀 Delete All (incl. Admins)
                  </button>
                </div>
              </div>
            </div>

            {sortedUsers.length === 0 ? (
              <div style={{textAlign: 'center', padding: '60px 20px'}}>
                <div style={{fontSize: '48px', marginBottom: '15px'}}>👥</div>
                <p style={{color: '#757575', fontSize: '16px', marginBottom: '10px'}}>No users found</p>
                <button 
                  onClick={() => setView('add-user')}
                  style={{padding: '10px 25px', background: '#388e3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500'}}
                >
                  ➕ Add First User
                </button>
              </div>
            ) : (
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '15px'}}>
                {sortedUsers.map(user => {
                  const userStats = getUserStats(user.id);
                  const isAdmin = user.role === 'admin';

                  return (
                    <div key={user.id} style={{
                      border: isAdmin ? '2px solid #f44336' : '1px solid #e0e0e0', 
                      borderRadius: '8px', 
                      padding: '20px', 
                      background: isAdmin ? 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={{display: 'flex', alignItems: 'center', marginBottom: '15px'}}>
                        <div style={{
                          width: '50px', height: '50px', borderRadius: '50%', 
                          background: isAdmin ? 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', color: 'white', marginRight: '15px'
                        }}>
                          {isAdmin ? '🔐' : (user.name ? user.name.charAt(0).toUpperCase() : '👤')}
                        </div>
                        <div style={{flex: 1}}>
                          <div style={{fontWeight: '500', fontSize: '16px', marginBottom: '3px'}}>{user.name || 'Anonymous'}</div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <span style={{fontSize: '12px', color: '#757575'}}>ID: {user.id}</span>
                            <span style={{
                              padding: '1px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600',
                              background: isAdmin ? '#ffebee' : user.role === 'merchant' ? '#fff3e0' : '#e3f2fd',
                              color: isAdmin ? '#f44336' : user.role === 'merchant' ? '#e65100' : '#2874f0'
                            }}>
                              {user.role.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Full Email (no masking for admin) */}
                      <div style={{padding: '10px', background: 'white', borderRadius: '6px', marginBottom: '10px', border: '1px solid #f0f0f0'}}>
                        <div style={{fontSize: '11px', color: '#757575', marginBottom: '3px'}}>EMAIL</div>
                        <div style={{fontSize: '13px', fontFamily: 'monospace', wordBreak: 'break-all'}}>{user.email}</div>
                      </div>

                      {user.phone && (
                        <div style={{padding: '10px', background: 'white', borderRadius: '6px', marginBottom: '10px', border: '1px solid #f0f0f0'}}>
                          <div style={{fontSize: '11px', color: '#757575', marginBottom: '3px'}}>PHONE</div>
                          <div style={{fontSize: '13px'}}>{user.phone}</div>
                        </div>
                      )}

                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px'}}>
                        <div style={{padding: '10px', background: '#e8f5e9', borderRadius: '6px'}}>
                          <div style={{fontSize: '11px', color: '#2e7d32', marginBottom: '3px'}}>ORDERS</div>
                          <div style={{fontSize: '18px', fontWeight: 'bold', color: '#1b5e20'}}>{userStats.totalOrders}</div>
                        </div>
                        <div style={{padding: '10px', background: '#e3f2fd', borderRadius: '6px'}}>
                          <div style={{fontSize: '11px', color: '#1565c0', marginBottom: '3px'}}>SPENT</div>
                          <div style={{fontSize: '18px', fontWeight: 'bold', color: '#0d47a1'}}>₹{formatPrice(userStats.totalSpent)}</div>
                        </div>
                      </div>

                      <div style={{fontSize: '11px', color: '#757575', marginBottom: '12px'}}>
                        Joined: {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>

                      <div style={{display: 'flex', gap: '8px'}}>
                        <button 
                          onClick={() => { setSelectedUser(user); setView('user-details'); }}
                          style={{flex: 1, padding: '8px', background: '#2874f0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'}}
                        >
                          👁️ View Full Details
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteUser(user.id, user.name); }}
                          style={{padding: '8px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'}}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== ORDERS VIEW ==================== */}
        {view === 'orders' && (
          <div style={{background: 'white', padding: '20px', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <div style={{marginBottom: '20px'}}>
              <h3 style={{marginTop: 0}}>Order Management</h3>

              {/* Detail Requests (pending approvals) */}
              <div style={{marginBottom: '15px', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '6px', background: '#fafafa'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
                  <div style={{fontWeight: '600'}}>📄 Order Detail Requests</div>
                  <div style={{fontSize: '12px', color: '#757575'}}>
                    {detailRequestsLoading ? 'Loading...' : `${detailRequests.length} pending`}
                  </div>
                </div>
                {detailRequests.length === 0 ? (
                  <div style={{fontSize: '13px', color: '#757575', marginTop: '8px'}}>No pending requests.</div>
                ) : (
                  <div style={{marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {detailRequests.slice(0, 10).map(r => (
                      <div key={r.id} style={{display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '10px', background: 'white', borderRadius: '6px', border: '1px solid #f0f0f0'}}>
                        <div style={{flex: 1}}>
                          <div style={{fontSize: '12px', color: '#757575'}}>
                            Request #{r.id} • Order #{r.order_id} • User #{r.user_id} • {new Date(r.created_at).toLocaleString()}
                          </div>
                          <div style={{fontSize: '13px', marginTop: '4px'}}>
                            <strong>Reason:</strong> {r.reason}{r.other_reason ? ` — ${r.other_reason}` : ''}
                          </div>
                          <div style={{fontSize: '12px', color: '#757575', marginTop: '4px'}}>
                            Order status: <strong>{(r.order_status || '').replace('_',' ')}</strong>
                          </div>
                        </div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                          <button onClick={() => updateDetailRequest(r.id, 'approve')} style={{padding: '8px 12px', background: '#388e3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'}}>
                            ✅ Approve
                          </button>
                          <button onClick={() => updateDetailRequest(r.id, 'reject')} style={{padding: '8px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'}}>
                            ❌ Reject
                          </button>
                        </div>
                      </div>
                    ))}
                    {detailRequests.length > 10 && (
                      <div style={{fontSize: '12px', color: '#757575'}}>Showing 10 of {detailRequests.length} pending requests.</div>
                    )}
                  </div>
                )}
              </div>

              <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center'}}>
                {['all', 'pending', 'processing', 'shipped', 'delivered', 'cancel_requested', 'cancelled', 'refunded'].map(status => (
                  <button key={status} onClick={() => setFilterStatus(status)} style={{padding: '8px 16px', background: filterStatus === status ? '#2874f0' : 'white', color: filterStatus === status ? 'white' : '#212121', border: '1px solid #e0e0e0', borderRadius: '2px', cursor: 'pointer', fontSize: '13px', textTransform: 'capitalize'}}>
                    {status.replace('_', ' ')} ({status === 'all' ? allOrders.length : allOrders.filter(o => o.status === status).length})
                  </button>
                ))}
              </div>

              {/* Bulk actions */}
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '15px'}}>
                <label style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#212121'}}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={() => setSelectedOrderIds(allFilteredSelected ? [] : filteredOrders.map(o => o.id))}
                  />
                  Select all in this view ({filteredOrders.length})
                </label>
                <div style={{display: 'flex', gap: '10px'}}>
                  <button
                    onClick={() => deleteOrders(selectedOrderIds)}
                    disabled={selectedOrderIds.length === 0 || bulkDeletingOrders}
                    style={{
                      padding: '8px 14px',
                      background: selectedOrderIds.length === 0 ? '#e0e0e0' : '#f44336',
                      color: selectedOrderIds.length === 0 ? '#9e9e9e' : 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: selectedOrderIds.length === 0 || bulkDeletingOrders ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  >
                    {bulkDeletingOrders ? 'Deleting...' : `🗑️ Delete Selected (${selectedOrderIds.length})`}
                  </button>
                  {selectedOrderIds.length > 0 && (
                    <button
                      onClick={() => setSelectedOrderIds([])}
                      style={{padding: '8px 14px', background: 'white', color: '#212121', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: 'pointer', fontSize: '13px'}}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <p style={{textAlign: 'center', color: '#757575', padding: '40px'}}>No orders found</p>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                {filteredOrders.map(order => {
                  const firstItem = order.items?.[0];
                  const product = firstItem ? products[firstItem.product_id || firstItem.productId] : null;
                  const orderUser = allUsers.find(u => u.id === order.userId);

                  return (
                    <div key={order.id} style={{border: '1px solid #e0e0e0', borderRadius: '4px', padding: '15px', background: order.status === 'cancel_requested' ? '#fff9e6' : 'white'}}>
                      <div style={{display: 'flex', gap: '15px', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                        <div style={{paddingTop: '3px'}}>
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                          />
                        </div>
                        <div style={{flex: 1}}>
                          <div style={{fontSize: '12px', color: '#757575', marginBottom: '5px'}}>
                            Order #{order.id} • User: <strong>{orderUser?.name || 'Unknown'}</strong> ({orderUser?.email || ''}) • {new Date(order.createdAt).toLocaleString()}
                          </div>
                          <div style={{fontWeight: '500', fontSize: '15px'}}>{product ? product.name : 'Order'}</div>
                          <div style={{fontSize: '13px', color: '#757575', marginTop: '5px'}}>
                            {firstItem?.quantity || 0} units × ₹{parseFloat(firstItem?.price || 0).toFixed(2)} = <strong style={{color: '#388e3c'}}>₹{order.totalAmount?.toFixed(2)}</strong>
                          </div>
                          
                          {order.shippingAddress && (() => {
                            const d = getShippingDisplay(order.shippingAddress);
                            if (!d.line && !d.phone) return null;
                            return (
                              <div style={{marginTop: '10px', padding: '10px', background: '#e8f5e9', borderRadius: '4px'}}>
                                <div style={{fontSize: '12px', fontWeight: '500', marginBottom: '5px'}}>📍 Shipping Address:</div>
                                <div style={{fontSize: '13px'}}>
                                  {d.line || '—'}
                                  {d.phone && <><br/>Phone: {d.phone}</>}
                                </div>
                              </div>
                            );
                          })()}
                          
                          {order.cancellationReason && (
                            <div style={{marginTop: '10px', padding: '10px', background: '#ffebee', borderRadius: '4px', borderLeft: '3px solid #f44336'}}>
                              <div style={{fontSize: '12px', fontWeight: '500', marginBottom: '5px'}}>⚠️ Cancellation Requested:</div>
                              <div style={{fontSize: '13px'}}>{order.cancellationReason}</div>
                              {order.cancellationImages && order.cancellationImages.length > 0 && (
                                <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
                                  {order.cancellationImages.map((img, idx) => (
                                    <img key={idx} src={img} alt="proof" style={{width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd'}} />
                                  ))}
                                </div>
                              )}
                              {order.status === 'cancel_requested' && (
                                <div style={{marginTop: '10px', display: 'flex', gap: '10px'}}>
                                  <button onClick={() => handleCancellationAction(order.id, 'approve')} style={{padding: '8px 16px', background: '#388e3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'}}>
                                    ✅ Approve & Refund
                                  </button>
                                  <button onClick={() => handleCancellationAction(order.id, 'reject')} style={{padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'}}>
                                    ❌ Reject Request
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{textAlign: 'right'}}>
                          <div style={{padding: '4px 12px', borderRadius: '2px', fontSize: '11px', fontWeight: '500', color: 'white', background: order.status === 'delivered' ? '#388e3c' : order.status === 'cancel_requested' ? '#ff9800' : '#2874f0', textTransform: 'capitalize', display: 'inline-block', marginBottom: '10px'}}>
                            {order.status.replace('_', ' ')}
                          </div>
                          <div>
                            <button
                              onClick={() => deleteOrders([order.id])}
                              style={{padding: '6px 10px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'}}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
