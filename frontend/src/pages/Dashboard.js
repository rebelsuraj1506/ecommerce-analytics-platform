import React, { useState, useEffect, useCallback } from 'react';
import './pages.css';

function Dashboard({ token, userRole }) {
  const [stats, setStats] = useState({
    totalOrders: 0, totalRevenue: 0, totalUnits: 0,
    ordersByStatus: {}, revenueByStatus: {}, allOrders: []
  });
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('summary');

  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isAdmin = userRole === 'admin';
  const fmt = (v) => { const n = parseFloat(v); return isNaN(n) ? '0.00' : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const fmtInt = (v) => Number(v).toLocaleString('en-IN');

  const computeStats = (orders) => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const totalUnits = orders.reduce((s, o) => s + (o.items || []).reduce((ss, i) => ss + (i.quantity || 0), 0), 0);
    const statuses = ['pending','processing','shipped','out_for_delivery','delivered','cancel_requested','cancelled','refund_processing','refunded'];
    const ordersByStatus = {}, revenueByStatus = {};
    statuses.forEach(s => {
      const f = orders.filter(o => o.status === s);
      ordersByStatus[s] = f.length;
      revenueByStatus[s] = f.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    });
    return { totalOrders, totalRevenue, totalUnits, ordersByStatus, revenueByStatus, allOrders: orders };
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [ordersRes, productsRes] = await Promise.all([
          fetch('http://localhost:8003/api/orders', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('http://localhost:8002/api/products?limit=100')
        ]);
        const ordersData = await ordersRes.json();
        const productsData = await productsRes.json();
        const orders = ordersData.data?.orders || [];
        const productList = productsData.data?.products || [];
        const productMap = {};
        productList.forEach(p => { productMap[p._id] = p; });
        setProducts(productMap);
        setStats(computeStats(orders));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchStats();
    const iv = setInterval(fetchStats, 15000);
    return () => clearInterval(iv);
  }, [token]);

  const deleteOrder = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:8003/api/orders/${orderId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setStats(prev => computeStats(prev.allOrders.filter(o => o.id !== orderId)));
        showToast('Order deleted successfully', 'success');
      } else {
        showToast('Failed to delete order', 'error');
      }
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    setDeleteConfirm(null);
  };

  const statusConfig = [
    { key: 'pending',         label: 'Placed',          icon: '📋', color: '#ff9800', bg: '#fff8e1' },
    { key: 'processing',      label: 'Processing',       icon: '⚙️',  color: '#1565c0', bg: '#e3f2fd' },
    { key: 'shipped',         label: 'Shipped',          icon: '🚚', color: '#4527a0', bg: '#ede7f6' },
    { key: 'out_for_delivery',label: 'Out for Delivery', icon: '🚛', color: '#bf360c', bg: '#fff3e0' },
    { key: 'delivered',       label: 'Delivered',        icon: '✅', color: '#1b5e20', bg: '#e8f5e9' },
    { key: 'cancelled',       label: 'Cancelled',        icon: '❌', color: '#b71c1c', bg: '#fde8e8' },
  ];

  const getBadgeClass = (status) => {
    const map = { pending: 'badge-pending', processing: 'badge-processing', shipped: 'badge-shipped', out_for_delivery: 'badge-out_for_delivery', delivered: 'badge-delivered', cancelled: 'badge-cancelled', cancel_requested: 'badge-cancel_requested', refund_processing: 'badge-refund_processing', refunded: 'badge-refunded' };
    return `badge ${map[status] || 'badge-pending'}`;
  };

  if (loading) return (
    <div className="page-wrap">
      <div className="spinner-wrap">
        <div className="spinner" />
        <span style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>Loading dashboard…</span>
      </div>
    </div>
  );

  const filteredOrders = viewMode === 'summary' ? stats.allOrders : stats.allOrders.filter(o => o.status === viewMode);

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <span style={{ fontSize: '1.4rem' }}>📊</span>
          <h1 className="page-title">{isAdmin ? 'Analytics Dashboard' : 'My Dashboard'}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="dash-live-badge">
            <div className="dash-live-dot" />
            Live
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>
            Auto-refreshes every 15s
          </span>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="stat-grid mb-20">
          <div className="stat-card c-primary">
            <div className="stat-icon">🛒</div>
            <div className="stat-label">{isAdmin ? 'Total Orders' : 'My Orders'}</div>
            <div className="stat-value">{fmtInt(stats.totalOrders)}</div>
            <div className="stat-sub">All time</div>
          </div>
          <div className="stat-card c-accent">
            <div className="stat-icon">₹</div>
            <div className="stat-label">{isAdmin ? 'Total Revenue' : 'Total Spent'}</div>
            <div className="stat-value" style={{ fontSize: stats.totalRevenue > 99999 ? '1.4rem' : '1.85rem' }}>₹{fmt(stats.totalRevenue)}</div>
            <div className="stat-sub">Cumulative</div>
          </div>
          <div className="stat-card c-success">
            <div className="stat-icon">📦</div>
            <div className="stat-label">Items {isAdmin ? 'Sold' : 'Purchased'}</div>
            <div className="stat-value">{fmtInt(stats.totalUnits)}</div>
            <div className="stat-sub">Units</div>
          </div>
          {isAdmin && (
            <div className="stat-card c-warning">
              <div className="stat-icon">✅</div>
              <div className="stat-label">Delivered</div>
              <div className="stat-value">{fmtInt(stats.ordersByStatus.delivered || 0)}</div>
              <div className="stat-sub">of {fmtInt(stats.totalOrders)} orders</div>
            </div>
          )}
        </div>

        {/* Status Cards */}
        <div className="card mb-20">
          <div className="card-header">
            <span className="card-title">Order Status Breakdown</span>
            <button
              className={`filter-tab${viewMode === 'summary' ? ' active' : ''}`}
              onClick={() => setViewMode('summary')}
            >
              View All
            </button>
          </div>
          <div className="card-body">
            <div className="status-cards-grid">
              {statusConfig.map(sc => (
                <div
                  key={sc.key}
                  className={`status-mini-card${viewMode === sc.key ? ' selected' : ''}`}
                  onClick={() => setViewMode(sc.key)}
                  style={{ color: sc.color, borderColor: viewMode === sc.key ? sc.color : 'transparent', background: viewMode === sc.key ? sc.bg : 'var(--surface)' }}
                >
                  <div className="s-icon">{sc.icon}</div>
                  <div className="s-label">{sc.label}</div>
                  <div className="s-count">{stats.ordersByStatus[sc.key] || 0}</div>
                  {isAdmin && (
                    <div className="s-revenue">₹{fmt(stats.revenueByStatus[sc.key] || 0)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {viewMode === 'summary' ? 'Recent Orders' : `${viewMode.replace(/_/g, ' ')} Orders`}
              <span className="page-count" style={{ marginLeft: 8 }}>{filteredOrders.length}</span>
            </span>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">{isAdmin ? 'No orders in this category' : 'No orders yet'}</div>
              <div className="empty-desc">{isAdmin ? 'Try switching filters above' : 'Start shopping to see your orders here'}</div>
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {filteredOrders.slice(0, 20).map(order => {
                const firstItem = order.items?.[0];
                const product = firstItem ? products[firstItem.product_id || firstItem.productId] : null;
                const imageUrl = product?.images?.[0] || `https://placehold.co/80x80/eeeeee/9e9e9e?text=Order`;

                return (
                  <div key={order.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-100)' }}>
                    <div className="flex-center gap-14">
                      <img
                        src={imageUrl} alt="product"
                        className="order-thumb"
                        onError={(e) => { e.target.src = 'https://placehold.co/68x68/eeeeee/9e9e9e?text=Img'; }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex-between mb-4">
                          <div className="order-id">Order #{order.id}</div>
                          <div className="flex-center gap-8">
                            <span className={getBadgeClass(order.status)}>
                              {order.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.93rem', color: 'var(--gray-900)', marginBottom: 3 }}>
                          {product ? product.name : (firstItem?.name || 'Product')}
                        </div>
                        <div className="flex-between">
                          <span className="text-muted">
                            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.97rem', color: 'var(--gray-900)' }}>₹{fmt(order.totalAmount)}</span>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteConfirm(order.id)}
                            className="btn btn-danger btn-sm"
                            style={{ marginTop: 8 }}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">Delete Order?</span>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '2.8rem', marginBottom: 12 }}>🗑️</div>
              <p style={{ fontSize: '.88rem', color: 'var(--gray-700)', lineHeight: 1.5 }}>
                This will permanently delete order <strong>#{deleteConfirm}</strong>. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteOrder(deleteConfirm)}>Delete Order</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast-fixed ${toast.type === 'success' ? 'toast-success' : toast.type === 'error' ? 'toast-error' : 'toast-info'}`}>
          {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'} {toast.msg}
        </div>
      )}
    </div>
  );
}

export default Dashboard;