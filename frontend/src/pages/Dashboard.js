import React, { useState, useEffect } from 'react';
import './pages.css';

function Dashboard({ token, userRole }) {
  const [stats, setStats] = useState({ totalOrders:0, totalRevenue:0, totalUnits:0, ordersByStatus:{}, revenueByStatus:{}, allOrders:[] });
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('summary');
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const showToast = (msg, type='info') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const isAdmin = userRole==='admin';
  const fmt  = v => { const n=parseFloat(v); return isNaN(n)?'0.00':n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  const fmtI = v => Number(v).toLocaleString('en-IN');

  const computeStats = orders => {
    const EXCL = new Set(['cancelled','cancel_requested','refund_processing','refunded']);
    const totalRevenue = orders.reduce((s,o)=>EXCL.has(o.status)?s:s+(o.totalAmount||0),0);
    const totalUnits   = orders.reduce((s,o)=>s+(o.items||[]).reduce((ss,i)=>ss+(i.quantity||0),0),0);
    const statuses = ['pending','processing','shipped','out_for_delivery','delivered','cancel_requested','cancelled','refund_processing','refunded'];
    const ordersByStatus={}, revenueByStatus={};
    statuses.forEach(s=>{ const f=orders.filter(o=>o.status===s); ordersByStatus[s]=f.length; revenueByStatus[s]=EXCL.has(s)?0:f.reduce((sum,o)=>sum+(o.totalAmount||0),0); });
    return { totalOrders:orders.length, totalRevenue, totalUnits, ordersByStatus, revenueByStatus, allOrders:orders };
  };

  useEffect(()=>{
    const fetch_ = async ()=>{
      try {
        const [oR,pR] = await Promise.all([
          fetch('http://localhost:8000/api/orders?limit=1000',{headers:{Authorization:`Bearer ${token}`}}),
          fetch('http://localhost:8000/api/products?limit=100')
        ]);
        const [oD,pD] = await Promise.all([oR.json(),pR.json()]);
        const pm={}; (pD.data?.products||[]).forEach(p=>{pm[p._id]=p;});
        setProducts(pm); setStats(computeStats(oD.data?.orders||[]));
      } catch(e){console.error(e);} finally{setLoading(false);}
    };
    fetch_(); const iv=setInterval(fetch_,15000); return ()=>clearInterval(iv);
  },[token]);

  const deleteOrder = async id => {
    try {
      const r = await fetch(`http://localhost:8000/api/orders/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
      if(r.ok){ setStats(p=>computeStats(p.allOrders.filter(o=>o.id!==id))); showToast('Order deleted','success'); }
      else showToast('Failed to delete','error');
    } catch(e){ showToast(e.message,'error'); }
    setDeleteConfirm(null);
  };

  const STATUS_CFG = [
    {key:'pending',        label:'Placed',          icon:'📋', color:'#d97706', bg:'#fffbeb'},
    {key:'processing',     label:'Processing',       icon:'⚙️',  color:'#1d4ed8', bg:'#eff6ff'},
    {key:'shipped',        label:'Shipped',          icon:'🚚', color:'#6d28d9', bg:'#f5f3ff'},
    {key:'out_for_delivery',label:'Out for Delivery',icon:'🚛', color:'#c2410c', bg:'#fff7ed'},
    {key:'delivered',      label:'Delivered',        icon:'✅', color:'#16a34a', bg:'#f0fdf4'},
    {key:'cancelled',      label:'Cancelled',        icon:'❌', color:'#dc2626', bg:'#fef2f2'},
  ];
  const BADGE = {pending:'badge-pending',processing:'badge-processing',shipped:'badge-shipped',out_for_delivery:'badge-out_for_delivery',delivered:'badge-delivered',cancelled:'badge-cancelled',cancel_requested:'badge-cancel_requested',refund_processing:'badge-refund_processing',refunded:'badge-refunded'};

  if(loading) return <div className="page-wrap"><div className="spinner-wrap"><div className="spinner"/><span className="text-muted">Loading dashboard…</span></div></div>;

  const filteredOrders = viewMode==='summary' ? stats.allOrders : stats.allOrders.filter(o=>o.status===viewMode);

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon">📊</div>
          <h1 className="page-title">{isAdmin?'Analytics Dashboard':'My Dashboard'}</h1>
        </div>
        <div className="dash-live-badge">
          <div className="dash-live-dot"/>
          <span>Live · Auto-refreshes every 15s</span>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Row */}
        <div className="stat-grid mb-20">
          <div className="stat-card c-primary">
            <div className="stat-icon">🛒</div>
            <div className="stat-label">{isAdmin?'Total Orders':'My Orders'}</div>
            <div className="stat-value">{fmtI(stats.totalOrders)}</div>
            <div className="stat-sub">All time</div>
          </div>
          <div className="stat-card c-accent">
            <div className="stat-icon">₹</div>
            <div className="stat-label">{isAdmin?'Net Revenue':'Total Spent'}</div>
            <div className={`stat-value${stats.totalRevenue>99999?' stat-value-sm':''}`}>₹{fmt(stats.totalRevenue)}</div>
            <div className="stat-sub">Excl. refunds &amp; cancellations</div>
          </div>
          <div className="stat-card c-success">
            <div className="stat-icon">📦</div>
            <div className="stat-label">Items {isAdmin?'Sold':'Purchased'}</div>
            <div className="stat-value">{fmtI(stats.totalUnits)}</div>
            <div className="stat-sub">Units</div>
          </div>
          {isAdmin && (
            <div className="stat-card c-warning">
              <div className="stat-icon">🎯</div>
              <div className="stat-label">Delivered</div>
              <div className="stat-value">{fmtI(stats.ordersByStatus.delivered||0)}</div>
              <div className="stat-sub">of {fmtI(stats.totalOrders)} orders</div>
            </div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="card mb-20">
          <div className="card-header">
            <span className="card-title">Order Status Breakdown</span>
            <button className={`filter-tab${viewMode==='summary'?' active':''}`} onClick={()=>setViewMode('summary')}>View All</button>
          </div>
          <div className="card-body">
            <div className="status-cards-grid">
              {STATUS_CFG.map(sc=>(
                <div key={sc.key}
                  className={`status-mini-card${viewMode===sc.key?' selected':''}`}
                  onClick={()=>setViewMode(sc.key)}
                  style={{color:sc.color, borderColor:viewMode===sc.key?sc.color:'var(--border)', background:viewMode===sc.key?sc.bg:'var(--surface)'}}
                >
                  <div className="s-icon">{sc.icon}</div>
                  <div className="s-label">{sc.label}</div>
                  <div className="s-count">{stats.ordersByStatus[sc.key]||0}</div>
                  {isAdmin && <div className="s-revenue">₹{fmt(stats.revenueByStatus[sc.key]||0)}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="card">
          <div className="card-header">
            <div className="flex-center gap-8">
              <span className="card-title">
                {viewMode==='summary'?'Recent Orders':`${viewMode.replace(/_/g,' ')} Orders`}
              </span>
              <span className="page-count">{filteredOrders.length}</span>
            </div>
          </div>
          {filteredOrders.length===0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">{isAdmin?'No orders in this category':'No orders yet'}</div>
              <div className="empty-desc">{isAdmin?'Switch filters above to explore':'Start shopping to see your orders here'}</div>
            </div>
          ) : (
            <div>
              {filteredOrders.slice(0,20).map(order=>{
                const fi = order.items?.[0];
                const prod = fi ? products[fi.product_id||fi.productId] : null;
                const img = prod?.images?.[0] || 'https://placehold.co/68x68/f3f4f6/9ca3af?text=📦';
                return (
                  <div key={order.id} className="order-row">
                    <img src={img} alt="product" className="order-thumb"
                      onError={e=>{e.target.src='https://placehold.co/68x68/f3f4f6/9ca3af?text=Img';}}/>
                    <div className="order-row-info">
                      <div className="order-row-name">{prod?prod.name:(fi?.name||'Product')}</div>
                      <div className="order-row-meta">
                        <span className="order-id">#{isAdmin?order.id:(order.userOrderNumber||order.id)}</span>
                        <span className={`badge ${BADGE[order.status]||'badge-pending'}`}>{order.status.replace(/_/g,' ')}</span>
                        <span className="text-muted">{new Date(order.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
                      </div>
                    </div>
                    <div className="order-row-right">
                      <div className="order-row-amount">₹{fmt(order.totalAmount)}</div>
                      {isAdmin && (
                        <button className="btn btn-icon btn-danger btn-sm" onClick={()=>setDeleteConfirm(order.id)} title="Delete">🗑️</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header">
              <span className="modal-title">Delete Order</span>
              <button className="modal-close" onClick={()=>setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body" style={{textAlign:'center',padding:'32px 24px'}}>
              <div className="confirm-icon confirm-icon-danger">🗑️</div>
              <div className="confirm-title">Delete Order #{deleteConfirm}?</div>
              <div className="confirm-desc">This action cannot be undone. The order will be permanently removed from the system.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>deleteOrder(deleteConfirm)}>Delete Order</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast-fixed toast-${toast.type}`}>{toast.type==='success'?'✅':toast.type==='error'?'❌':'ℹ️'} {toast.msg}</div>}
    </div>
  );
}

export default Dashboard;