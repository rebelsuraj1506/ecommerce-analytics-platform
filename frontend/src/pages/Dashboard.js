import React, { useState, useEffect } from 'react';

function Dashboard({ token, userRole }) {
  const [stats, setStats] = useState({
    totalOrders: 0, totalRevenue: 0, totalUnits: 0,
    ordersByStatus: {}, revenueByStatus: {}, allOrders: []
  });
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('summary');

  const isAdmin = userRole === 'admin';

  const formatPrice = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [ordersRes, productsRes] = await Promise.all([
          fetch('http://localhost:8003/api/orders', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('http://localhost:8002/api/products?limit=100')
        ]);

        const ordersData = await ordersRes.json();
        const productsData = await productsRes.json();
        
        const orders = ordersData.data?.orders || [];
        const productList = productsData.data?.products || [];
        
        const productMap = {};
        productList.forEach(p => { productMap[p._id] = p; });
        setProducts(productMap);

        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        const totalUnits = orders.reduce((sum, order) => {
          return sum + (order.items || []).reduce((s, item) => s + (item.quantity || 0), 0);
        }, 0);

        const statuses = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancel_requested', 'cancelled', 'refund_processing', 'refunded'];
        const ordersByStatus = {};
        const revenueByStatus = {};
        statuses.forEach(s => {
          const filtered = orders.filter(o => o.status === s);
          ordersByStatus[s] = filtered.length;
          revenueByStatus[s] = filtered.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        });

        setStats({ totalOrders, totalRevenue, totalUnits, ordersByStatus, revenueByStatus, allOrders: orders });
        setLoading(false);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Delete this order?')) return;
    try {
      const res = await fetch(`http://localhost:8003/api/orders/${orderId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { alert('Order deleted!'); window.location.reload(); }
    } catch (err) { alert('Error: ' + err.message); }
  };

  if (loading) return <div style={{textAlign: 'center', padding: '40px'}}>Loading dashboard...</div>;

  const filteredOrders = viewMode === 'summary' ? stats.allOrders : stats.allOrders.filter(o => o.status === viewMode);

  const StatusCard = ({ title, count, revenue, color, icon, status }) => (
    <div onClick={() => setViewMode(status)} style={{
      background: `linear-gradient(135deg, ${color}dd 0%, ${color} 100%)`,
      color: 'white', padding: '20px', borderRadius: '8px', cursor: 'pointer',
      transition: 'transform 0.2s', border: viewMode === status ? '3px solid white' : 'none'
    }}
    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
      <div style={{fontSize: '0.85em', opacity: 0.9, marginBottom: '5px'}}>{icon} {title}</div>
      <div style={{fontSize: '2em', fontWeight: 'bold'}}>{count}</div>
      {isAdmin && <div style={{fontSize: '1em', opacity: 0.95, marginTop: '5px', fontWeight: '600'}}>₹{formatPrice(revenue)}</div>}
    </div>
  );

  return (
    <div style={{background: '#f1f3f6', minHeight: '100vh', padding: '20px'}}>
      <div style={{maxWidth: '1400px', margin: '0 auto'}}>
        {/* Header */}
        <div style={{background: 'white', padding: '20px 30px', borderRadius: '2px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
          <h2 style={{margin: 0, color: '#212121', fontSize: '24px', fontWeight: '500'}}>
            {isAdmin ? '📊 Analytics Dashboard' : '📊 My Dashboard'}
          </h2>
        </div>

        {/* Summary Cards */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px'}}>
          <div style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '25px', borderRadius: '8px'}}>
            <div style={{fontSize: '0.9em', opacity: 0.9}}>{isAdmin ? 'Total Orders' : 'My Orders'}</div>
            <div style={{fontSize: '2.5em', fontWeight: 'bold', marginTop: '10px'}}>{stats.totalOrders}</div>
          </div>
          <div style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', padding: '25px', borderRadius: '8px'}}>
            <div style={{fontSize: '0.9em', opacity: 0.9}}>{isAdmin ? 'Total Revenue' : 'Total Spent'}</div>
            <div style={{fontSize: '2.5em', fontWeight: 'bold', marginTop: '10px'}}>₹{formatPrice(stats.totalRevenue)}</div>
          </div>
          <div style={{background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', padding: '25px', borderRadius: '8px'}}>
            <div style={{fontSize: '0.9em', opacity: 0.9}}>Items {isAdmin ? 'Sold' : 'Purchased'}</div>
            <div style={{fontSize: '2.5em', fontWeight: 'bold', marginTop: '10px'}}>{stats.totalUnits}</div>
          </div>
        </div>

        {/* Status Cards */}
        <div style={{marginBottom: '20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <h3 style={{margin: 0, color: '#333'}}>Order Status</h3>
            <button onClick={() => setViewMode('summary')} style={{padding: '8px 16px', background: viewMode === 'summary' ? '#2874f0' : '#757575', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '13px'}}>
              View All
            </button>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px'}}>
            <StatusCard title="Placed" count={stats.ordersByStatus.pending || 0} revenue={stats.revenueByStatus.pending || 0} color="#ffc107" icon="📋" status="pending" />
            <StatusCard title="Processing" count={stats.ordersByStatus.processing || 0} revenue={stats.revenueByStatus.processing || 0} color="#17a2b8" icon="⚙️" status="processing" />
            <StatusCard title="Shipped" count={stats.ordersByStatus.shipped || 0} revenue={stats.revenueByStatus.shipped || 0} color="#2874f0" icon="🚚" status="shipped" />
            <StatusCard title="Delivered" count={stats.ordersByStatus.delivered || 0} revenue={stats.revenueByStatus.delivered || 0} color="#388e3c" icon="✅" status="delivered" />
            <StatusCard title="Cancelled" count={stats.ordersByStatus.cancelled || 0} revenue={stats.revenueByStatus.cancelled || 0} color="#f44336" icon="❌" status="cancelled" />
          </div>
        </div>

        {/* Orders List */}
        <div style={{background: 'white', padding: '20px', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
          <h3 style={{marginTop: 0}}>
            {viewMode === 'summary' ? `Recent Orders (${filteredOrders.length})` : `${viewMode.replace('_', ' ').toUpperCase()} Orders (${filteredOrders.length})`}
          </h3>
          {filteredOrders.length === 0 ? (
            <div style={{textAlign: 'center', padding: '40px'}}>
              <div style={{fontSize: '48px', marginBottom: '10px'}}>📦</div>
              <p style={{color: '#757575'}}>{isAdmin ? 'No orders in this category' : 'No orders yet. Start shopping!'}</p>
            </div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              {filteredOrders.slice(0, 20).map(order => {
                const firstItem = order.items?.[0];
                const product = firstItem ? products[firstItem.product_id || firstItem.productId] : null;
                const imageUrl = product?.images?.[0] || `https://placehold.co/80x80/e0e0e0/757575?text=Order`;

                return (
                  <div key={order.id} style={{border: '1px solid #e0e0e0', borderRadius: '4px', padding: '15px', background: '#fafafa'}}>
                    <div style={{display: 'flex', gap: '15px', alignItems: 'flex-start'}}>
                      <img src={imageUrl} alt="product" style={{width: '70px', height: '70px', objectFit: 'cover', borderRadius: '4px', background: 'white'}}
                        onError={(e) => { e.target.src = 'https://placehold.co/70x70/e0e0e0/757575?text=Img'; }} />
                      <div style={{flex: 1}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '5px'}}>
                          <div>
                            <div style={{fontSize: '12px', color: '#757575'}}>Order #{order.id} • {new Date(order.createdAt).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'})}</div>
                            <div style={{fontWeight: '500', fontSize: '15px', marginTop: '4px'}}>{product ? product.name : (firstItem?.name || 'Product')}</div>
                          </div>
                          <div style={{textAlign: 'right'}}>
                            <div style={{fontSize: '16px', fontWeight: 'bold', color: '#212121'}}>₹{formatPrice(order.totalAmount)}</div>
                            <div style={{display: 'inline-block', marginTop: '4px', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '500', color: 'white',
                              background: order.status === 'delivered' ? '#388e3c' : order.status === 'cancelled' ? '#f44336' : order.status === 'shipped' ? '#2874f0' : order.status === 'processing' ? '#17a2b8' : '#ffc107',
                              textTransform: 'capitalize'
                            }}>
                              {order.status.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                        {isAdmin && (
                          <button onClick={() => deleteOrder(order.id)} style={{marginTop: '8px', padding: '4px 10px', background: '#f44336', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '11px'}}>
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
    </div>
  );
}

export default Dashboard;
