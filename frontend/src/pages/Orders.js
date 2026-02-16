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
      <div style={{textAlign: 'center', padding: '40px', background: '#f1f3f6', minHeight: '100vh'}}>
        <div style={{fontSize: '48px', marginBottom: '20px'}}>⏳</div>
        <div style={{color: '#757575'}}>Loading orders...</div>
      </div>
    );
  }

  return (
    <div style={{background: '#f1f3f6', minHeight: '100vh', padding: '20px'}}>
      <div style={{maxWidth: '1400px', margin: '0 auto'}}>
        {/* Header */}
        <div style={{background: 'white', padding: '20px 30px', borderRadius: '2px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
          <h2 style={{margin: '0 0 5px 0', color: '#212121', fontSize: '24px', fontWeight: '500'}}>
            {userRole === 'admin' ? '🛍️ Order Management' : '📦 All Orders'}
          </h2>
          <p style={{margin: 0, color: '#757575', fontSize: '14px'}}>
            Manage and track all customer orders
          </p>
        </div>

        {/* Stats Cards */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px'}}>
          <div style={{background: 'white', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #2196f3'}}>
            <div style={{fontSize: '11px', color: '#757575', marginBottom: '5px'}}>TOTAL ORDERS</div>
            <div style={{fontSize: '24px', fontWeight: 'bold', color: '#2196f3'}}>{stats.total}</div>
          </div>
          <div style={{background: 'white', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #ffc107'}}>
            <div style={{fontSize: '11px', color: '#757575', marginBottom: '5px'}}>PENDING</div>
            <div style={{fontSize: '24px', fontWeight: 'bold', color: '#ffc107'}}>{stats.pending}</div>
          </div>
          <div style={{background: 'white', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #17a2b8'}}>
            <div style={{fontSize: '11px', color: '#757575', marginBottom: '5px'}}>PROCESSING</div>
            <div style={{fontSize: '24px', fontWeight: 'bold', color: '#17a2b8'}}>{stats.processing}</div>
          </div>
          <div style={{background: 'white', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #2874f0'}}>
            <div style={{fontSize: '11px', color: '#757575', marginBottom: '5px'}}>SHIPPED</div>
            <div style={{fontSize: '24px', fontWeight: 'bold', color: '#2874f0'}}>{stats.shipped}</div>
          </div>
          <div style={{background: 'white', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #388e3c'}}>
            <div style={{fontSize: '11px', color: '#757575', marginBottom: '5px'}}>DELIVERED</div>
            <div style={{fontSize: '24px', fontWeight: 'bold', color: '#388e3c'}}>{stats.delivered}</div>
          </div>
          {stats.cancelRequested > 0 && (
            <div style={{background: 'white', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #ff9800'}}>
              <div style={{fontSize: '11px', color: '#757575', marginBottom: '5px'}}>CANCELLATIONS</div>
              <div style={{fontSize: '24px', fontWeight: 'bold', color: '#ff9800'}}>{stats.cancelRequested}</div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={{background: 'white', padding: '15px 20px', borderRadius: '2px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
          <div style={{fontSize: '13px', fontWeight: '500', marginBottom: '10px', color: '#212121'}}>Filter by Status:</div>
          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
            {['all', 'pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancel_requested', 'cancelled', 'refunded'].map(status => {
              const count = status === 'all' ? orders.length : orders.filter(o => o.status === status).length;
              return (
                <button 
                  key={status} 
                  onClick={() => setFilterStatus(status)} 
                  style={{
                    padding: '8px 16px', 
                    background: filterStatus === status ? '#2874f0' : 'white', 
                    color: filterStatus === status ? 'white' : '#212121', 
                    border: '1px solid #e0e0e0', 
                    borderRadius: '20px', 
                    cursor: 'pointer', 
                    fontSize: '13px', 
                    fontWeight: '500',
                    textTransform: 'capitalize',
                    transition: 'all 0.2s'
                  }}
                >
                  {status.replace('_', ' ')} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders List */}
        <div style={{background: 'white', padding: '20px', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
          {filteredOrders.length === 0 ? (
            <div style={{textAlign: 'center', padding: '60px', color: '#757575'}}>
              <div style={{fontSize: '48px', marginBottom: '15px'}}>📦</div>
              <h3 style={{fontWeight: '400'}}>No orders found</h3>
            </div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
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
                      {order.shippingAddress && (
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
                            {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.zipCode}
                            <br/>Phone: {order.shippingAddress.phone}
                          </div>
                        </div>
                      )}

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
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}>
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #e0e0e0',
                background: 'linear-gradient(135deg, #2874f0 0%, #00bcd4 100%)',
                color: 'white'
              }}>
                <h3 style={{margin: 0, fontSize: '18px'}}>🚚 Add Shipping Details</h3>
                <p style={{margin: '5px 0 0 0', fontSize: '13px', opacity: 0.9}}>Order #{selectedOrder.id}</p>
              </div>

              <div style={{padding: '20px'}}>
                <div style={{marginBottom: '15px'}}>
                  <label style={{display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px', color: '#212121'}}>
                    Tracking Number <span style={{color: '#f44336'}}>*</span>
                  </label>
                  <input 
                    type="text"
                    value={trackingDetails.trackingNumber}
                    onChange={(e) => setTrackingDetails({...trackingDetails, trackingNumber: e.target.value})}
                    placeholder="e.g., 1234567890"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{marginBottom: '15px'}}>
                  <label style={{display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px', color: '#212121'}}>
                    Courier Name <span style={{color: '#f44336'}}>*</span>
                  </label>
                  <select
                    value={trackingDetails.courierName}
                    onChange={(e) => setTrackingDetails({...trackingDetails, courierName: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
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

                <div style={{marginBottom: '15px'}}>
                  <label style={{display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '5px', color: '#212121'}}>
                    Estimated Delivery Date (Optional)
                  </label>
                  <input 
                    type="date"
                    value={trackingDetails.estimatedDelivery}
                    onChange={(e) => setTrackingDetails({...trackingDetails, estimatedDelivery: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{
                padding: '15px 20px',
                borderTop: '1px solid #e0e0e0',
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                background: '#f8f9fa'
              }}>
                <button 
                  onClick={() => {
                    setSelectedOrder(null);
                    setTrackingDetails({ trackingNumber: '', courierName: '', estimatedDelivery: '' });
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#757575',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleShippingSubmit}
                  style={{
                    padding: '10px 20px',
                    background: '#2874f0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Confirm & Mark as Shipped
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Orders;