import React, { useState, useEffect } from 'react';

function Orders({ token, userRole }) {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState({});
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingDetails, setTrackingDetails] = useState({
    trackingNumber: '',
    courierName: '',
    estimatedDelivery: ''
  });

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

  // Order statuses with their transitions
  const orderStatuses = {
    pending: { 
      label: 'Order Placed', 
      color: '#ffc107', 
      icon: '📋',
      nextStates: ['processing', 'cancelled']
    },
    processing: { 
      label: 'Processing', 
      color: '#17a2b8', 
      icon: '⚙️',
      nextStates: ['shipped', 'cancelled']
    },
    shipped: { 
      label: 'Shipped', 
      color: '#2874f0', 
      icon: '🚚',
      nextStates: ['out_for_delivery']
    },
    out_for_delivery: { 
      label: 'Out for Delivery', 
      color: '#ff9800', 
      icon: '🚛',
      nextStates: ['delivered']
    },
    delivered: { 
      label: 'Delivered', 
      color: '#388e3c', 
      icon: '✅',
      nextStates: []
    },
    cancel_requested: { 
      label: 'Cancellation Requested', 
      color: '#ff9800', 
      icon: '⏳',
      nextStates: ['cancelled', 'processing']
    },
    cancelled: { 
      label: 'Cancelled', 
      color: '#f44336', 
      icon: '❌',
      nextStates: ['refund_processing']
    },
    refund_processing: { 
      label: 'Refund Processing', 
      color: '#9c27b0', 
      icon: '💰',
      nextStates: ['refunded']
    },
    refunded: { 
      label: 'Refunded', 
      color: '#4caf50', 
      icon: '✅',
      nextStates: []
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [ordersRes, productsRes, usersRes] = await Promise.all([
        fetch('http://localhost:8003/api/orders', { 
          headers: { 'Authorization': `Bearer ${token}` } 
        }),
        fetch('http://localhost:8002/api/products?limit=100'),
        fetch('http://localhost:8001/api/users', { 
          headers: { 'Authorization': `Bearer ${token}` } 
        })
      ]);

      const ordersData = await ordersRes.json();
      const productsData = await productsRes.json();
      const usersData = await usersRes.json();
      
      const ordersList = ordersData.data?.orders || [];
      const productsList = productsData.data?.products || [];
      const usersList = usersData.data?.users || [];
      
      // Create product map
      const productMap = {};
      productsList.forEach(p => { productMap[p._id] = p; });
      setProducts(productMap);

      // Create user map
      const userMap = {};
      usersList.forEach(u => { userMap[u.id] = u; });
      setUsers(userMap);

      // Sort orders by most recent
      ordersList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setOrders(ordersList);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus, additionalData = {}) => {
    try {
      const res = await fetch(`http://localhost:8003/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          ...additionalData
        })
      });

      if (res.ok) {
        alert(`✅ Order status updated to: ${orderStatuses[newStatus]?.label}`);
        fetchData(); // Refresh orders
        setSelectedOrder(null);
        setTrackingDetails({ trackingNumber: '', courierName: '', estimatedDelivery: '' });
      } else {
        const data = await res.json();
        alert('Error: ' + (data.message || 'Failed to update status'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleStatusUpdate = (order, newStatus) => {
    // If shipping, ask for tracking details
    if (newStatus === 'shipped') {
      setSelectedOrder({ ...order, pendingStatus: newStatus });
      return;
    }

    // Confirm status change
    const confirmMessage = `Update order #${order.id} status to "${orderStatuses[newStatus]?.label}"?`;
    if (window.confirm(confirmMessage)) {
      updateOrderStatus(order.id, newStatus);
    }
  };

  const handleShippingSubmit = () => {
    if (!trackingDetails.trackingNumber || !trackingDetails.courierName) {
      alert('Please provide tracking number and courier name');
      return;
    }

    updateOrderStatus(selectedOrder.id, 'shipped', {
      trackingNumber: trackingDetails.trackingNumber,
      courierName: trackingDetails.courierName,
      estimatedDelivery: trackingDetails.estimatedDelivery,
      shippedAt: new Date().toISOString()
    });
  };

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
        alert(action === 'approve' ? '✅ Cancellation approved and refund initiated!' : '❌ Cancellation request rejected!');
        fetchData();
      } else {
        const data = await res.json();
        alert('Error: ' + (data.message || 'Action failed'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const filteredOrders = filterStatus === 'all' 
    ? orders 
    : orders.filter(o => o.status === filterStatus);

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    cancelRequested: orders.filter(o => o.status === 'cancel_requested').length
  };

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="spinner-wrap">
          <div className="spinner" />
          <span className="text-muted">Loading orders…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <span style={{fontSize: '1.4rem'}}>{userRole === 'admin' ? '🛍️' : '📦'}</span>
          <h1 className="page-title">{userRole === 'admin' ? 'Order Management' : 'All Orders'}</h1>
          <span className="page-count">{filteredOrders.length}</span>
        </div>
      </div>

      <div className="page-body">
        {/* Stats Cards */}
        <div className="stat-grid mb-20">
          <div className="stat-card c-primary">
            <div className="stat-icon">🛒</div>
            <div className="stat-label">Total Orders</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card c-warning">
            <div className="stat-icon">📋</div>
            <div className="stat-label">Pending</div>
            <div className="stat-value">{stats.pending}</div>
          </div>
          <div className="stat-card c-primary">
            <div className="stat-icon">⚙️</div>
            <div className="stat-label">Processing</div>
            <div className="stat-value">{stats.processing}</div>
          </div>
          <div className="stat-card c-success">
            <div className="stat-icon">✅</div>
            <div className="stat-label">Delivered</div>
            <div className="stat-value">{stats.delivered}</div>
          </div>
          {stats.cancelRequested > 0 && (
            <div className="stat-card c-danger">
              <div className="stat-icon">⚠️</div>
              <div className="stat-label">Cancel Requests</div>
              <div className="stat-value">{stats.cancelRequested}</div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="card mb-16">
          <div className="card-body" style={{padding: '14px 20px'}}>
            <div className="form-label mb-8">Filter by Status</div>
            <div className="filter-tabs">
              {['all', 'pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancel_requested', 'cancelled', 'refunded'].map(status => {
                const count = status === 'all' ? orders.length : orders.filter(o => o.status === status).length;
                return (
                  <button
                    key={status}
                    className={`filter-tab${filterStatus === status ? ' active' : ''}`}
                    onClick={() => setFilterStatus(status)}
                  >
                    {status.replace(/_/g, ' ')} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div>
          {filteredOrders.length === 0 ? (
            <div className="card"><div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">No orders found</div>
              <div className="empty-desc">Try changing the status filter above</div>
            </div></div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              {filteredOrders.map(order => {
                const firstItem = order.items?.[0];
                const product = firstItem ? products[firstItem.product_id || firstItem.productId] : null;
                const user = users[order.userId];
                const statusInfo = orderStatuses[order.status];
                const canUpdateStatus = userRole === 'admin';

                return (
                  <div key={order.id} style={{
                    border: order.status === 'cancel_requested' ? '2px solid #ff9800' : '1px solid #e0e0e0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: order.status === 'cancel_requested' ? '#fff9e6' : 'white'
                  }}>
                    {/* Order Header */}
                    <div style={{
                      padding: '15px 20px',
                      background: '#fafafa',
                      borderBottom: '1px solid #e0e0e0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div>
                        <div style={{fontSize: '14px', fontWeight: '500', color: '#212121', marginBottom: '5px'}}>
                          Order #{order.id}
                        </div>
                        <div style={{fontSize: '12px', color: '#757575'}}>
                          Customer: <strong>{user?.name || 'Unknown'}</strong> • 
                          Placed: {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 16px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: 'white',
                        background: statusInfo?.color || '#757575',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <span>{statusInfo?.icon}</span>
                        <span>{statusInfo?.label}</span>
                      </div>
                    </div>

                    {/* Order Content */}
                    <div style={{padding: '20px'}}>
                      <div style={{display: 'flex', gap: '20px', marginBottom: '15px'}}>
                        {/* Product Image */}
                        {product && product.images && product.images[0] && (
                          <img 
                            src={product.images[0]}
                            alt={product.name}
                            style={{
                              width: '100px',
                              height: '100px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #e0e0e0'
                            }}
                          />
                        )}
                        
                        {/* Product Details */}
                        <div style={{flex: 1}}>
                          <h3 style={{margin: '0 0 8px 0', fontSize: '16px', fontWeight: '500', color: '#212121'}}>
                            {product ? product.name : 'Product'}
                          </h3>
                          <div style={{fontSize: '14px', color: '#757575', marginBottom: '8px'}}>
                            Quantity: {firstItem?.quantity || 1} × ₹{formatPrice(firstItem?.price || 0)}
                          </div>
                          <div style={{fontSize: '20px', fontWeight: '600', color: '#388e3c'}}>
                            Total: ₹{formatPrice(order.totalAmount)}
                          </div>
                        </div>
                      </div>

                      {/* Shipping Address */}
                      {order.shippingAddress && (() => {
                        const d = getShippingDisplay(order.shippingAddress);
                        if (!d.line && !d.phone) return null;
                        return (
                          <div style={{
                            background: '#e8f5e9',
                            padding: '12px',
                            borderRadius: '4px',
                            marginBottom: '15px'
                          }}>
                            <div style={{fontSize: '12px', fontWeight: '500', marginBottom: '5px', color: '#2e7d32'}}>
                              📍 Delivery Address:
                            </div>
                            <div style={{fontSize: '13px', color: '#1b5e20'}}>
                              {d.line || '—'}
                              {d.phone && <><br/>Phone: {d.phone}</>}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Tracking Info */}
                      {order.trackingNumber && (
                        <div style={{
                          background: '#e3f2fd',
                          padding: '12px',
                          borderRadius: '4px',
                          marginBottom: '15px'
                        }}>
                          <div style={{fontSize: '12px', fontWeight: '500', marginBottom: '5px', color: '#1565c0'}}>
                            🚚 Tracking Information:
                          </div>
                          <div style={{fontSize: '13px', color: '#0d47a1'}}>
                            Courier: <strong>{order.courierName}</strong><br/>
                            Tracking #: <strong>{order.trackingNumber}</strong>
                            {order.estimatedDelivery && (
                              <><br/>Est. Delivery: {new Date(order.estimatedDelivery).toLocaleDateString()}</>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Cancellation Request */}
                      {order.cancellationReason && (
                        <div style={{
                          background: '#ffebee',
                          padding: '12px',
                          borderRadius: '4px',
                          borderLeft: '4px solid #f44336',
                          marginBottom: '15px'
                        }}>
                          <div style={{fontSize: '12px', fontWeight: '500', marginBottom: '5px', color: '#c62828'}}>
                            ⚠️ Cancellation Request
                          </div>
                          <div style={{fontSize: '13px', color: '#c62828', marginBottom: '8px'}}>
                            <strong>Reason:</strong> {order.cancellationReason}
                          </div>
                          {order.cancellationImages && order.cancellationImages.length > 0 && (
                            <div style={{display: 'flex', gap: '8px', marginTop: '10px'}}>
                              {order.cancellationImages.map((img, idx) => (
                                <img 
                                  key={idx} 
                                  src={img} 
                                  alt={`Proof ${idx + 1}`} 
                                  style={{
                                    width: '60px',
                                    height: '60px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    border: '2px solid #e57373',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => window.open(img, '_blank')}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Admin Actions */}
                      {canUpdateStatus && (
                        <div>
                          <div style={{fontSize: '13px', fontWeight: '500', marginBottom: '10px', color: '#212121'}}>
                            Update Order Status:
                          </div>
                          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                            {/* Cancel Request Actions */}
                            {order.status === 'cancel_requested' && (
                              <>
                                <button 
                                  onClick={() => handleCancellationAction(order.id, 'approve')}
                                  style={{
                                    padding: '8px 16px',
                                    background: '#388e3c',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500'
                                  }}
                                >
                                  ✅ Approve Cancellation
                                </button>
                                <button 
                                  onClick={() => handleCancellationAction(order.id, 'reject')}
                                  style={{
                                    padding: '8px 16px',
                                    background: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500'
                                  }}
                                >
                                  ❌ Reject Request
                                </button>
                              </>
                            )}

                            {/* Regular Status Updates */}
                            {statusInfo?.nextStates?.map(nextStatus => (
                              <button 
                                key={nextStatus}
                                onClick={() => handleStatusUpdate(order, nextStatus)}
                                style={{
                                  padding: '8px 16px',
                                  background: orderStatuses[nextStatus]?.color || '#2874f0',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <span>{orderStatuses[nextStatus]?.icon}</span>
                                <span>Mark as {orderStatuses[nextStatus]?.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Shipping Modal */}
        {selectedOrder && selectedOrder.pendingStatus === 'shipped' && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header" style={{background: 'linear-gradient(135deg, var(--brand-primary) 0%, #00bcd4 100)', borderRadius: 'var(--radius-md) var(--radius-md) 0 0'}}>
                <div>
                  <h3 className="modal-title" style={{color: '#fff'}}>🚚 Add Shipping Details</h3>
                  <div style={{fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', marginTop: 2}}>Order #{selectedOrder.id}</div>
                </div>
                <button className="modal-close" style={{background: 'rgba(255,255,255,0.15)', color: '#fff'}} onClick={() => { setSelectedOrder(null); setTrackingDetails({ trackingNumber: '', courierName: '', estimatedDelivery: '' }); }}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group mb-12">
                  <label className="form-label">Tracking Number <span style={{color: 'var(--brand-danger)'}}>*</span></label>
                  <input type="text" className="form-control" value={trackingDetails.trackingNumber} onChange={(e) => setTrackingDetails({...trackingDetails, trackingNumber: e.target.value})} placeholder="e.g., 1234567890" />
                </div>
                <div className="form-group mb-12">
                  <label className="form-label">Courier Name <span style={{color: 'var(--brand-danger)'}}>*</span></label>
                  <select className="form-control" value={trackingDetails.courierName} onChange={(e) => setTrackingDetails({...trackingDetails, courierName: e.target.value})}>
                    <option value="">Select Courier</option>
                    <option value="Blue Dart">Blue Dart</option>
                    <option value="Delhivery">Delhivery</option>
                    <option value="FedEx">FedEx</option>
                    <option value="DHL">DHL</option>
                    <option value="Ecom Express">Ecom Express</option>
                    <option value="India Post">India Post</option>
                    <option value="DTDC">DTDC</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estimated Delivery Date <span className="text-muted">(optional)</span></label>
                  <input type="date" className="form-control" value={trackingDetails.estimatedDelivery} onChange={(e) => setTrackingDetails({...trackingDetails, estimatedDelivery: e.target.value})} min={new Date().toISOString().split('T')[0]} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => { setSelectedOrder(null); setTrackingDetails({ trackingNumber: '', courierName: '', estimatedDelivery: '' }); }}>Cancel</button>
                <button className="btn btn-blue" onClick={handleShippingSubmit}>Confirm & Mark as Shipped</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Orders;