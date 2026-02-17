import React, { useState, useEffect } from 'react';

function MyOrders({ token, userId, userName }) {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(null);
  const [reviewModal, setReviewModal] = useState(null); // { orderId, productId, productName }
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [detailRequestModal, setDetailRequestModal] = useState(null); // { orderId }
  const [detailReason, setDetailReason] = useState('');
  const [detailOtherReason, setDetailOtherReason] = useState('');
  const [detailSubmitting, setDetailSubmitting] = useState(false);
  const [detailRequestInfo, setDetailRequestInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTracking, setExpandedTracking] = useState(null);
  const [cancelData, setCancelData] = useState({
    reason: '',
    customReason: '',
    images: []
  });

  // Helper function to safely format numbers
  const formatPrice = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  // Normalize shipping address (API may return object or JSON string) and format for display
  const getShippingDisplay = (addr) => {
    if (!addr) return { line: null, phone: null };
    const a = typeof addr === 'string' ? (() => { try { return JSON.parse(addr); } catch { return null; } })() : addr;
    if (!a || typeof a !== 'object') return { line: null, phone: null };
    const parts = [a.street, a.city, a.state].filter(Boolean);
    const zip = a.zipCode ? ` - ${a.zipCode}` : '';
    return { line: parts.length ? parts.join(', ') + zip : null, phone: a.phone || null };
  };

  const cancellationReasons = [
    'Product no longer needed',
    'Found a better price elsewhere',
    'Ordered by mistake',
    'Expected delivery time is too long',
    'Changed my mind',
    'Quality concerns based on reviews',
    'Wrong product ordered',
    'Shipping address is incorrect',
    'Payment method issue',
    'Other (Please specify)'
  ];

  const detailRequestReasons = [
    'Need invoice / billing proof',
    'Warranty / service claim',
    'Bank / payment dispute',
    'Return / replacement reference',
    'Tax / accounting',
    'Other'
  ];

  // Order status configurations
  const orderStatuses = {
    pending: {
      label: 'Order Placed',
      color: '#ffc107',
      icon: '📋',
      description: 'Your order has been placed successfully',
      canCancel: true
    },
    processing: {
      label: 'Processing',
      color: '#17a2b8',
      icon: '⚙️',
      description: 'Your order is being prepared for shipment',
      canCancel: true
    },
    shipped: {
      label: 'Shipped',
      color: '#2874f0',
      icon: '🚚',
      description: 'Your order has been shipped and is on the way',
      canCancel: false
    },
    out_for_delivery: {
      label: 'Out for Delivery',
      color: '#ff9800',
      icon: '🚛',
      description: 'Your order is out for delivery',
      canCancel: false
    },
    delivered: {
      label: 'Delivered',
      color: '#388e3c',
      icon: '✅',
      description: 'Your order has been delivered successfully',
      canCancel: false
    },
    cancel_requested: {
      label: 'Cancellation Requested',
      color: '#ff9800',
      icon: '⏳',
      description: 'Your cancellation request is under review',
      canCancel: false
    },
    cancelled: {
      label: 'Cancelled',
      color: '#f44336',
      icon: '❌',
      description: 'This order has been cancelled',
      canCancel: false
    },
    refund_processing: {
      label: 'Refund Processing',
      color: '#9c27b0',
      icon: '💰',
      description: 'Your refund is being processed',
      canCancel: false
    },
    refunded: {
      label: 'Refunded',
      color: '#4caf50',
      icon: '✅',
      description: 'Refund completed successfully',
      canCancel: false
    }
  };

  useEffect(() => {
    console.log('=== MyOrders Component Debug ===');
    console.log('Token exists:', !!token);
    console.log('User ID:', userId);
    
    if (!userId) {
      setError('User ID is missing. Please try logging out and logging in again.');
      setLoading(false);
    }
  }, [token, userId]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('http://localhost:8002/api/products?limit=100');
      const data = await res.json();
      const productList = data.data?.products || [];
      const productMap = {};
      productList.forEach(p => { productMap[p._id] = p; });
      setProducts(productMap);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchOrders = async () => {
    if (!userId) {
      setError('User ID is missing');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:8003/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      const allOrders = data.data?.orders || [];
      
      // Filter orders for current user
      const userOrders = allOrders.filter(order => {
        const orderUserId = order.userId || order.user_id || order._userId;
        return orderUserId === userId || 
               orderUserId === String(userId) || 
               String(orderUserId) === String(userId);
      });
      
      // Sort by most recent first
      userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setOrders(userOrders);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(`Failed to load orders: ${err.message}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, [token, userId]);

  const handleCancelRequest = async (orderId) => {
    if (!cancelData.reason) {
      return alert('Please select a cancellation reason');
    }
    
    if (cancelData.reason === 'Other (Please specify)' && !cancelData.customReason.trim()) {
      return alert('Please provide a reason for cancellation');
    }

    const finalReason = cancelData.reason === 'Other (Please specify)' 
      ? cancelData.customReason 
      : cancelData.reason;

    try {
      const res = await fetch(`http://localhost:8003/api/orders/${orderId}/cancel-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: finalReason,
          images: cancelData.images.filter(img => img && img.trim())
        })
      });
      
      if (res.ok) {
        alert('✅ Cancellation request submitted successfully!\n\n' +
              'Our team will review your request within 24-48 hours.\n' +
              'If approved, your refund will be initiated and credited to your original payment method within 5-7 business days.');
        setShowCancelModal(null);
        setCancelData({ reason: '', customReason: '', images: [] });
        fetchOrders();
      } else {
        const errorData = await res.json();
        alert('Error: ' + (errorData.message || 'Failed to submit cancellation request'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const addImageUrl = () => {
    setCancelData({...cancelData, images: [...cancelData.images, '']});
  };

  const updateImageUrl = (index, value) => {
    const newImages = [...cancelData.images];
    newImages[index] = value;
    setCancelData({...cancelData, images: newImages});
  };

  const handleSubmitReview = async () => {
    if (!reviewModal) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`http://localhost:8003/api/orders/${reviewModal.orderId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          productId: reviewModal.productId,
          rating: reviewRating,
          comment: reviewComment.trim(),
          userName: userName || 'User'
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('✅ Thank you! Your review has been submitted.');
        setReviewModal(null);
        setReviewRating(5);
        setReviewComment('');
        fetchProducts(); // refresh product data (rating updated)
      } else {
        alert(data.message || 'Failed to submit review');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openDetailRequest = async (orderId) => {
    setDetailRequestModal({ orderId });
    setDetailReason('');
    setDetailOtherReason('');
    setDetailRequestInfo(null);
    try {
      const res = await fetch(`http://localhost:8003/api/orders/${orderId}/detail-request`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setDetailRequestInfo(data.data?.request || null);
    } catch (_) {}
  };

  const submitDetailRequest = async () => {
    if (!detailRequestModal) return;
    if (!detailReason) return alert('Please select a reason');
    if (detailReason === 'Other' && !detailOtherReason.trim()) return alert('Please enter your reason');
    setDetailSubmitting(true);
    try {
      const res = await fetch(`http://localhost:8003/api/orders/${detailRequestModal.orderId}/detail-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reason: detailReason, otherReason: detailOtherReason })
      });
      const data = await res.json();
      if (res.ok) {
        alert('✅ Request submitted. Admin will review it soon.');
        setDetailRequestInfo(data.data?.request || null);
      } else {
        alert(data.message || 'Failed to submit request');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setDetailSubmitting(false);
    }
  };

  const removeImageUrl = (index) => {
    const newImages = cancelData.images.filter((_, i) => i !== index);
    setCancelData({...cancelData, images: newImages});
  };

  const getStatusColor = (status) => {
    return orderStatuses[status]?.color || '#757575';
  };

  const getStatusInfo = (status) => {
    return orderStatuses[status] || {
      label: status,
      color: '#757575',
      icon: '📦',
      description: status,
      canCancel: false
    };
  };

  // Calculate order progress for tracking bar
  const getOrderProgress = (status) => {
    const progressMap = {
      pending: 20,
      processing: 40,
      shipped: 60,
      out_for_delivery: 80,
      delivered: 100,
      cancel_requested: 50,
      cancelled: 100,
      refund_processing: 50,
      refunded: 100
    };
    return progressMap[status] || 0;
  };

  // Get tracking timeline
  const getTrackingTimeline = (order) => {
    const timeline = [];
    const status = order.status;
    
    // Order Placed
    timeline.push({
      status: 'pending',
      label: 'Order Placed',
      icon: '📋',
      completed: true,
      date: order.createdAt,
      active: status === 'pending'
    });

    // Processing
    timeline.push({
      status: 'processing',
      label: 'Processing',
      icon: '⚙️',
      completed: ['processing', 'shipped', 'out_for_delivery', 'delivered'].includes(status),
      date: order.processingAt,
      active: status === 'processing'
    });

    // Shipped
    timeline.push({
      status: 'shipped',
      label: 'Shipped',
      icon: '🚚',
      completed: ['shipped', 'out_for_delivery', 'delivered'].includes(status),
      date: order.shippedAt,
      active: status === 'shipped'
    });

    // Out for Delivery
    timeline.push({
      status: 'out_for_delivery',
      label: 'Out for Delivery',
      icon: '🚛',
      completed: ['out_for_delivery', 'delivered'].includes(status),
      date: order.outForDeliveryAt,
      active: status === 'out_for_delivery'
    });

    // Delivered
    timeline.push({
      status: 'delivered',
      label: 'Delivered',
      icon: '✅',
      completed: status === 'delivered',
      date: order.deliveredAt,
      active: status === 'delivered'
    });

    // Handle cancellation states
    if (['cancel_requested', 'cancelled', 'refund_processing', 'refunded'].includes(status)) {
      return [{
        status: 'cancel_requested',
        label: status === 'cancel_requested' ? 'Cancellation Requested' : 'Cancelled',
        icon: '❌',
        completed: true,
        date: order.cancellationRequestedAt || order.cancelledAt,
        active: true
      }];
    }

    return timeline;
  };

  if (loading) {
    return (
      <div style={{background: '#f1f3f6', minHeight: '100vh', padding: '20px'}}>
        <div style={{maxWidth: '1200px', margin: '0 auto'}}>
          <div style={{background: 'white', padding: '60px', textAlign: 'center', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <div style={{fontSize: '48px', marginBottom: '20px'}}>⏳</div>
            <h3 style={{color: '#212121', fontWeight: '500'}}>Loading your orders...</h3>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{background: '#f1f3f6', minHeight: '100vh', padding: '20px'}}>
        <div style={{maxWidth: '1200px', margin: '0 auto'}}>
          <div style={{background: 'white', padding: '60px', textAlign: 'center', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <div style={{fontSize: '48px', marginBottom: '20px'}}>⚠️</div>
            <h3 style={{color: '#f44336', fontWeight: '500'}}>Error Loading Orders</h3>
            <p style={{color: '#757575', marginTop: '10px'}}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{background: '#f1f3f6', minHeight: '100vh', padding: '20px'}}>
      <div style={{maxWidth: '1200px', margin: '0 auto'}}>
        {/* Header */}
        <div style={{background: 'white', padding: '20px 30px', borderRadius: '2px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
          <h2 style={{margin: 0, color: '#212121', fontSize: '24px', fontWeight: '500'}}>📦 My Orders</h2>
          <p style={{margin: '5px 0 0 0', color: '#757575', fontSize: '14px'}}>
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} found
          </p>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div style={{background: 'white', padding: '60px', textAlign: 'center', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <div style={{fontSize: '64px', marginBottom: '20px'}}>🛒</div>
            <h3 style={{color: '#212121', fontWeight: '500', marginBottom: '10px'}}>No Orders Yet</h3>
            <p style={{color: '#757575', marginBottom: '20px'}}>You haven't placed any orders. Start shopping now!</p>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
            {orders.map(order => {
              const firstItem = order.items?.[0];
              const product = firstItem ? products[firstItem.product_id || firstItem.productId] : null;
              const statusInfo = getStatusInfo(order.status);
              const timeline = getTrackingTimeline(order);
              const canCancel = statusInfo.canCancel && !['cancelled', 'delivered', 'refunded'].includes(order.status);

              return (
                <div key={order.id} style={{
                  background: 'white', 
                  borderRadius: '4px', 
                  boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                  border: order.status === 'cancel_requested' ? '2px solid #ff9800' : 'none'
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
                      <div style={{fontSize: '12px', color: '#757575', marginBottom: '3px'}}>
                        Order ID: <strong>#{order.id}</strong>
                      </div>
                      <div style={{fontSize: '12px', color: '#757575'}}>
                        Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                    <div style={{
                      padding: '6px 16px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: 'white',
                      background: statusInfo.color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <span>{statusInfo.icon}</span>
                      <span>{statusInfo.label}</span>
                    </div>
                  </div>

                  {/* Order Content */}
                  <div style={{padding: '20px'}}>
                    {/* Product Info */}
                    <div style={{display: 'flex', gap: '20px', marginBottom: '20px'}}>
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
                      <div style={{flex: 1}}>
                        <h3 style={{margin: '0 0 8px 0', fontSize: '16px', fontWeight: '500', color: '#212121'}}>
                          {product ? product.name : 'Product'}
                        </h3>
                        <div style={{fontSize: '14px', color: '#757575', marginBottom: '8px'}}>
                          Quantity: {firstItem?.quantity || 1}
                        </div>
                        <div style={{fontSize: '18px', fontWeight: '600', color: '#388e3c'}}>
                          ₹{formatPrice(order.totalAmount)}
                        </div>
                      </div>
                    </div>

                    {/* Mini Progress Bar - Always Visible */}
                    <div style={{
                      background: '#f8f9fa',
                      padding: '15px 20px',
                      borderRadius: '8px',
                      marginBottom: '15px'
                    }}>
                      {/* Progress Steps (horizontal) */}
                      {!['cancel_requested', 'cancelled', 'refund_processing', 'refunded'].includes(order.status) ? (
                        <div>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                            {['Order Placed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'].map((label, i) => {
                              const stepStatuses = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
                              const currentIdx = stepStatuses.indexOf(order.status);
                              const isCompleted = i <= currentIdx;
                              const isCurrent = i === currentIdx;
                              return (
                                <div key={label} style={{textAlign: 'center', flex: 1}}>
                                  <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 6px',
                                    background: isCompleted ? statusInfo.color : '#e0e0e0',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', color: 'white', fontWeight: '600',
                                    border: isCurrent ? `3px solid ${statusInfo.color}` : 'none',
                                    boxShadow: isCurrent ? `0 0 0 3px ${statusInfo.color}33` : 'none'
                                  }}>
                                    {isCompleted ? '✓' : i + 1}
                                  </div>
                                  <div style={{fontSize: '10px', color: isCompleted ? '#212121' : '#9e9e9e', fontWeight: isCurrent ? '600' : '400'}}>
                                    {label}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Progress Line */}
                          <div style={{height: '3px', background: '#e0e0e0', borderRadius: '2px', margin: '0 30px', position: 'relative', top: '-38px'}}>
                            <div style={{
                              height: '100%', borderRadius: '2px',
                              background: statusInfo.color,
                              width: `${['pending','processing','shipped','out_for_delivery','delivered'].indexOf(order.status) * 25}%`,
                              transition: 'width 0.5s'
                            }}></div>
                          </div>
                        </div>
                      ) : (
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{fontSize: '24px'}}>{statusInfo.icon}</span>
                          <div>
                            <div style={{fontWeight: '600', color: statusInfo.color}}>{statusInfo.label}</div>
                            <div style={{fontSize: '12px', color: '#757575'}}>{statusInfo.description}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons Row */}
                    <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: expandedTracking === order.id ? '15px' : '0'}}>
                      {/* Track Order Button */}
                      <button 
                        onClick={() => setExpandedTracking(expandedTracking === order.id ? null : order.id)}
                        style={{
                          padding: '10px 20px',
                          background: expandedTracking === order.id ? '#1565c0' : '#2874f0',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span>📍</span>
                        <span>{expandedTracking === order.id ? 'Hide Tracking' : 'Track Order'}</span>
                        <span style={{fontSize: '10px'}}>{expandedTracking === order.id ? '▲' : '▼'}</span>
                      </button>

                      {canCancel && (
                        <button 
                          onClick={() => setShowCancelModal(order)}
                          style={{
                            padding: '10px 20px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <span>❌</span>
                          <span>Cancel Order</span>
                        </button>
                      )}

                      {!order.canViewDetails && order.canRequestDetails && (
                        <button
                          onClick={() => openDetailRequest(order.id)}
                          style={{
                            padding: '10px 20px',
                            background: '#673ab7',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <span>📄</span>
                          <span>Request Order Details</span>
                        </button>
                      )}
                      
                      {order.status === 'delivered' && order.items?.length > 0 && (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px', width: '100%'}}>
                          <div style={{fontSize: '12px', fontWeight: '600', color: '#212121', marginBottom: '4px'}}>Rate your purchase:</div>
                          {order.items.map((item, idx) => {
                            const pid = item.product_id || item.productId;
                            const pName = item.name || (products[pid] && products[pid].name) || `Item ${idx + 1}`;
                            return (
                              <div key={pid || idx} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fff8e1', borderRadius: '4px'}}>
                                <span style={{fontSize: '13px', color: '#212121'}}>{pName}</span>
                                <button 
                                  onClick={() => setReviewModal({ orderId: order.id, productId: pid, productName: pName })}
                                  style={{
                                    padding: '6px 14px',
                                    background: '#ff9800',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '500'
                                  }}
                                >
                                  ⭐ Review
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Expanded Tracking Details */}
                    {expandedTracking === order.id && (
                      <div style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        animation: 'fadeIn 0.3s ease'
                      }}>
                        {/* Tracking Timeline */}
                        <div style={{
                          background: '#f8f9fa',
                          padding: '20px'
                        }}>
                          <h4 style={{margin: '0 0 20px 0', fontSize: '14px', fontWeight: '600', color: '#212121'}}>
                            📍 Order Tracking Details
                          </h4>
                          <div style={{position: 'relative'}}>
                            {timeline.map((step, index) => (
                              <div key={step.status} style={{
                                display: 'flex',
                                gap: '15px',
                                marginBottom: index < timeline.length - 1 ? '20px' : '0'
                              }}>
                                <div style={{position: 'relative'}}>
                                  <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%',
                                    background: step.completed ? statusInfo.color : '#e0e0e0',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '18px',
                                    border: step.active ? `3px solid ${statusInfo.color}` : 'none',
                                    boxShadow: step.active ? `0 0 0 4px ${statusInfo.color}22` : 'none'
                                  }}>
                                    {step.icon}
                                  </div>
                                  {index < timeline.length - 1 && (
                                    <div style={{
                                      position: 'absolute', left: '50%', top: '40px',
                                      transform: 'translateX(-50%)',
                                      width: '2px', height: '20px',
                                      background: step.completed ? statusInfo.color : '#e0e0e0'
                                    }}></div>
                                  )}
                                </div>
                                <div style={{flex: 1, paddingTop: '5px'}}>
                                  <div style={{
                                    fontSize: '14px',
                                    fontWeight: step.active ? '600' : '400',
                                    color: step.completed ? '#212121' : '#9e9e9e',
                                    marginBottom: '3px'
                                  }}>
                                    {step.label}
                                  </div>
                                  {step.date && (
                                    <div style={{fontSize: '12px', color: '#757575'}}>
                                      {new Date(step.date).toLocaleDateString('en-IN', {
                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Courier Info */}
                        {order.trackingNumber && (
                          <div style={{padding: '15px 20px', background: '#e3f2fd', borderTop: '1px solid #e0e0e0'}}>
                            <div style={{fontSize: '13px', color: '#1565c0'}}>
                              <strong>🚚 Courier:</strong> {order.courierName} &nbsp;|&nbsp;
                              <strong>Tracking #:</strong> {order.trackingNumber}
                              {order.estimatedDelivery && (
                                <span> &nbsp;|&nbsp; <strong>Est. Delivery:</strong> {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Delivery Address */}
                        {order.shippingAddress && (() => {
                          const d = getShippingDisplay(order.shippingAddress);
                          if (!d.line && !d.phone) return null;
                          return (
                            <div style={{padding: '15px 20px', background: '#e8f5e9', borderTop: '1px solid #e0e0e0'}}>
                              <div style={{fontSize: '13px', color: '#2e7d32'}}>
                                <strong>📍 Delivery Address:</strong> {d.line || '—'}
                                {d.phone && <> | Phone: {d.phone}</>}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Payment Info */}
                        <div style={{padding: '15px 20px', background: '#fff9e6', borderTop: '1px solid #e0e0e0'}}>
                          <div style={{fontSize: '13px', color: '#856404'}}>
                            <strong>💳 Payment:</strong> {order.paymentMethod?.toUpperCase() || 'N/A'} &nbsp;|&nbsp;
                            <strong>Amount:</strong> ₹{formatPrice(order.totalAmount)} &nbsp;|&nbsp;
                            <strong>Ordered:</strong> {new Date(order.createdAt).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cancellation Info */}
                    {order.cancellationReason && (
                      <div style={{
                        background: '#ffebee',
                        padding: '15px',
                        borderRadius: '4px',
                        borderLeft: '4px solid #f44336',
                        marginBottom: '20px'
                      }}>
                        <h4 style={{margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500', color: '#c62828'}}>
                          ⚠️ Cancellation {order.status === 'cancel_requested' ? 'Requested' : 'Confirmed'}
                        </h4>
                        <div style={{fontSize: '13px', color: '#c62828', marginBottom: '10px'}}>
                          <strong>Reason:</strong> {order.cancellationReason}
                        </div>
                        {order.cancellationImages && order.cancellationImages.length > 0 && (
                          <div>
                            <div style={{fontSize: '12px', color: '#c62828', marginBottom: '8px', fontWeight: '500'}}>
                              Supporting Images:
                            </div>
                            <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                              {order.cancellationImages.map((img, idx) => (
                                <img 
                                  key={idx} 
                                  src={img} 
                                  alt={`Proof ${idx + 1}`} 
                                  style={{
                                    width: '80px',
                                    height: '80px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    border: '2px solid #e57373',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => window.open(img, '_blank')}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {order.status === 'cancel_requested' && (
                          <div style={{
                            marginTop: '10px',
                            padding: '10px',
                            background: '#fff3e0',
                            borderRadius: '4px'
                          }}>
                            <div style={{fontSize: '12px', color: '#e65100'}}>
                              ⏳ Your cancellation request is being reviewed by our team. You'll be notified via email once a decision is made.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* End of order content */}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Review Product Modal */}
        {reviewModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}>
            <div style={{background: 'white', borderRadius: '8px', maxWidth: '440px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', padding: '24px'}}>
              <h3 style={{margin: '0 0 8px 0', fontSize: '18px', color: '#212121'}}>⭐ Rate your purchase</h3>
              <p style={{margin: '0 0 20px 0', fontSize: '14px', color: '#757575'}}>{reviewModal.productName}</p>
              <div style={{marginBottom: '16px'}}>
                <div style={{fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#212121'}}>Rating</div>
                <div style={{display: 'flex', gap: '8px'}}>
                  {[1,2,3,4,5].map(star => (
                    <button key={star} type="button" onClick={() => setReviewRating(star)}
                      style={{
                        padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '4px',
                        background: reviewRating >= star ? '#ff9800' : '#f5f5f5', color: reviewRating >= star ? 'white' : '#757575',
                        cursor: 'pointer', fontSize: '18px'
                      }}
                    >★</button>
                  ))}
                </div>
              </div>
              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#212121'}}>Review (optional)</label>
                <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Share your experience..."
                  rows={3} style={{width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box'}} />
              </div>
              <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                <button type="button" onClick={() => { setReviewModal(null); setReviewRating(5); setReviewComment(''); }}
                  style={{padding: '10px 20px', background: '#e0e0e0', color: '#212121', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500'}}>Cancel</button>
                <button type="button" onClick={handleSubmitReview} disabled={reviewSubmitting}
                  style={{padding: '10px 20px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: reviewSubmitting ? 'not-allowed' : 'pointer', fontWeight: '500'}}>
                  {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Order Detail Request Modal */}
        {detailRequestModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}>
            <div style={{background: 'white', borderRadius: '8px', maxWidth: '520px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', padding: '24px'}}>
              <h3 style={{margin: '0 0 8px 0', fontSize: '18px', color: '#212121'}}>📄 Request Order Details</h3>
              <p style={{margin: '0 0 16px 0', fontSize: '13px', color: '#757575'}}>
                Order #{detailRequestModal.orderId} • Requests are allowed within 30 days after cancellation/deletion and require admin approval.
              </p>

              {detailRequestInfo && (
                <div style={{background: '#f1f3f6', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px'}}>
                  <div><strong>Latest request:</strong> {detailRequestInfo.status}</div>
                  <div style={{marginTop: '4px'}}><strong>Reason:</strong> {detailRequestInfo.reason}{detailRequestInfo.other_reason ? ` — ${detailRequestInfo.other_reason}` : ''}</div>
                  {detailRequestInfo.admin_note && <div style={{marginTop: '4px'}}><strong>Admin note:</strong> {detailRequestInfo.admin_note}</div>}
                </div>
              )}

              <div style={{marginBottom: '14px'}}>
                <label style={{display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#212121'}}>Reason</label>
                <select value={detailReason} onChange={(e) => setDetailReason(e.target.value)} style={{width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px'}}>
                  <option value="">Select a reason</option>
                  {detailRequestReasons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {detailReason === 'Other' && (
                <div style={{marginBottom: '16px'}}>
                  <label style={{display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#212121'}}>Your reason</label>
                  <textarea value={detailOtherReason} onChange={(e) => setDetailOtherReason(e.target.value)} rows={3}
                    style={{width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box'}} />
                </div>
              )}

              <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                <button type="button" onClick={() => setDetailRequestModal(null)}
                  style={{padding: '10px 18px', background: '#e0e0e0', color: '#212121', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500'}}>Close</button>
                <button type="button" onClick={submitDetailRequest} disabled={detailSubmitting}
                  style={{padding: '10px 18px', background: '#673ab7', color: 'white', border: 'none', borderRadius: '4px', cursor: detailSubmitting ? 'not-allowed' : 'pointer', fontWeight: '600'}}>
                  {detailSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Order Modal */}
        {showCancelModal && (
          <div style={{
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.5)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000, 
            padding: '20px'
          }}>
            <div style={{
              background: 'white', 
              borderRadius: '8px', 
              maxWidth: '600px', 
              width: '100%', 
              maxHeight: '90vh', 
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '20px', 
                borderBottom: '1px solid #e0e0e0',
                background: 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)',
                color: 'white'
              }}>
                <h3 style={{margin: 0, fontSize: '20px'}}>🚫 Cancel Order</h3>
                <p style={{margin: '5px 0 0 0', fontSize: '14px', opacity: 0.9}}>Order #{showCancelModal.id}</p>
              </div>
              
              {/* Modal Body */}
              <div style={{padding: '20px'}}>
                {/* Reason Selection */}
                <label style={{display: 'block', fontWeight: '500', marginBottom: '10px', color: '#212121'}}>
                  Select Reason for Cancellation <span style={{color: '#f44336'}}>*</span>
                </label>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px'}}>
                  {cancellationReasons.map(reason => (
                    <label 
                      key={reason} 
                      style={{
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '12px', 
                        border: cancelData.reason === reason ? '2px solid #2874f0' : '1px solid #e0e0e0', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        background: cancelData.reason === reason ? '#e3f2fd' : 'white',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="reason" 
                        value={reason} 
                        checked={cancelData.reason === reason} 
                        onChange={(e) => setCancelData({...cancelData, reason: e.target.value})} 
                        style={{marginRight: '10px', cursor: 'pointer'}} 
                      />
                      <span style={{fontSize: '14px', color: '#212121'}}>{reason}</span>
                    </label>
                  ))}
                </div>

                {/* Custom Reason Input */}
                {cancelData.reason === 'Other (Please specify)' && (
                  <div style={{marginBottom: '20px'}}>
                    <label style={{display: 'block', fontWeight: '500', marginBottom: '10px', color: '#212121'}}>
                      Please specify your reason <span style={{color: '#f44336'}}>*</span>
                    </label>
                    <textarea 
                      value={cancelData.customReason} 
                      onChange={(e) => setCancelData({...cancelData, customReason: e.target.value})} 
                      placeholder="Please provide detailed reason for cancellation..."
                      style={{
                        width: '100%', 
                        padding: '12px', 
                        border: '1px solid #e0e0e0', 
                        borderRadius: '4px', 
                        minHeight: '100px', 
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }} 
                    />
                  </div>
                )}

                {/* Image Upload Section */}
                <div style={{marginBottom: '20px'}}>
                  <label style={{display: 'block', fontWeight: '500', marginBottom: '10px', color: '#212121'}}>
                    Upload Supporting Images (Optional)
                  </label>
                  <div style={{fontSize: '12px', color: '#757575', marginBottom: '10px'}}>
                    You can upload screenshots, photos of defects, or other supporting documents
                  </div>
                  
                  {cancelData.images.map((img, index) => (
                    <div key={index} style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                      <input 
                        type="url" 
                        placeholder="Enter image URL" 
                        value={img} 
                        onChange={(e) => updateImageUrl(index, e.target.value)} 
                        style={{
                          flex: 1, 
                          padding: '10px', 
                          border: '1px solid #e0e0e0', 
                          borderRadius: '4px', 
                          fontSize: '13px'
                        }} 
                      />
                      <button 
                        onClick={() => removeImageUrl(index)} 
                        style={{
                          padding: '10px 15px', 
                          background: '#f44336', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={addImageUrl} 
                    style={{
                      padding: '8px 16px', 
                      background: '#2874f0', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      cursor: 'pointer', 
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    + Add Image URL
                  </button>
                </div>

                {/* Info Box */}
                <div style={{
                  background: '#fff9e6', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  borderLeft: '3px solid #ffc107'
                }}>
                  <div style={{fontSize: '13px', color: '#856404'}}>
                    <strong>📋 Refund Policy:</strong><br/>
                    • Your cancellation request will be reviewed within 24-48 hours<br/>
                    • If approved, refund will be initiated immediately<br/>
                    • Amount will be credited to your original payment method within 5-7 business days<br/>
                    • You'll receive email notifications at each step
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '20px', 
                borderTop: '1px solid #e0e0e0', 
                display: 'flex', 
                gap: '10px', 
                justifyContent: 'flex-end',
                background: '#f8f9fa'
              }}>
                <button 
                  onClick={() => { 
                    setShowCancelModal(null); 
                    setCancelData({ reason: '', customReason: '', images: [] }); 
                  }} 
                  style={{
                    padding: '10px 20px', 
                    background: '#757575', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '2px', 
                    cursor: 'pointer', 
                    fontWeight: '500'
                  }}
                >
                  Close
                </button>
                <button 
                  onClick={() => handleCancelRequest(showCancelModal.id)} 
                  style={{
                    padding: '10px 20px', 
                    background: '#f44336', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '2px', 
                    cursor: 'pointer', 
                    fontWeight: '500'
                  }}
                >
                  Submit Cancellation Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyOrders;