import React, { useState, useEffect } from 'react';
import './pages.css';
import BackToTop from './BackToTop';

const OS = {
  pending:          { label:'Order Placed',          color:'#f57c00', icon:'📋', next:['processing','cancelled'] },
  processing:       { label:'Processing',             color:'#1565c0', icon:'⚙️',  next:['shipped','cancelled'] },
  shipped:          { label:'Shipped',                color:'#4527a0', icon:'🚚', next:['out_for_delivery','cancelled'] },
  out_for_delivery: { label:'Out for Delivery',       color:'#bf360c', icon:'🚛', next:['delivered','cancelled'] },
  delivered:        { label:'Delivered',              color:'#2e7d32', icon:'✅', next:[] },
  cancel_requested: { label:'Cancel Requested',       color:'#e65100', icon:'⏳', next:['cancelled','processing'] },
  cancelled:        { label:'Cancelled',              color:'#c62828', icon:'❌', next:['refund_processing'] },
  refund_processing:{ label:'Refund Processing',      color:'#6a1b9a', icon:'💰', next:['refunded'] },
  refunded:         { label:'Refunded',               color:'#2e7d32', icon:'✅', next:[] },
};
const parseAddr = a => {
  if (!a) return {};
  const obj = typeof a==='string' ? (() => { try{return JSON.parse(a);}catch{return {};} })() : a;
  const parts = [obj.street,obj.city,obj.state].filter(Boolean);
  return { line:parts.length?parts.join(', ')+(obj.zipCode?` – ${obj.zipCode}`:''):null, phone:obj.phone||null };
};
const fmt = v => { const n=parseFloat(v); return isNaN(n)?'0.00':n.toFixed(2); };

export default function Orders({ token, userRole }) {
  const [orders,   setOrders]   = useState([]);
  const [products, setProducts] = useState({});
  const [users,    setUsers]    = useState({});
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [selOrder, setSelOrder] = useState(null);   // for shipping modal
  const [cancelMod,setCancelMod]= useState(null);   // for cancel reason modal
  const [cancelReason, setCancelReason] = useState('');
  const [tracking, setTracking] = useState({ trackingNumber:'', courierName:'', estimatedDelivery:'' });
  const [toast, setToast] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total:0, pages:1 });
  const PAGE_SIZE = 15;

  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    document.title = `${userRole === 'admin' ? 'Order Management' : 'All Orders'} — ShopMart`;
    return () => { document.title = 'ShopMart'; };
  }, [userRole]);

  useEffect(() => { load(page); }, [token, page]);

  const load = async (pg = 1, statusFilter = filter) => {
    setLoading(true);
    try {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const [oR,pR,uR] = await Promise.all([
        fetch(`http://localhost:8000/api/orders?limit=${PAGE_SIZE}&page=${pg}${statusParam}`,{ headers:{ Authorization:`Bearer ${token}` } }),
        fetch('http://localhost:8000/api/products?limit=100'),
        fetch('http://localhost:8000/api/users?limit=1000',{ headers:{ Authorization:`Bearer ${token}` } }),
      ]);
      const [oD,pD,uD] = await Promise.all([oR.json(),pR.json(),uR.json()]);
      const pMap={}, uMap={};
      (pD.data?.products||[]).forEach(p=>{pMap[p._id]=p;});
      (uD.data?.users||[]).forEach(u=>{
        uMap[u.id]=u;
        uMap[String(u.id)]=u;
        uMap[Number(u.id)]=u;
      });
      setProducts(pMap); setUsers(uMap);
      setOrders((oD.data?.orders||[]).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
      setPagination({ total: oD.data?.pagination?.total||0, pages: oD.data?.pagination?.pages||1 });
    } catch(e){ console.error(e); } finally { setLoading(false); }
  };

  const updateStatus = async (id, status, extra={}) => {
    try {
      const r = await fetch(`http://localhost:8000/api/orders/${id}/status`,{
        method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ status, ...extra })
      });
      if (r.ok) { load(page); setSelOrder(null); setTracking({ trackingNumber:'',courierName:'',estimatedDelivery:'' }); showToast('Order status updated', 'success'); }
      else { const d=await r.json(); showToast(d.message||'Failed to update status', 'error'); }
    } catch(e){ showToast(e.message, 'error'); }
  };

  const onStatusClick = (order, ns) => {
    if (ns==='shipped')   { setSelOrder({...order,pend:ns}); return; }
    if (ns==='cancelled') { setCancelMod({order}); setCancelReason(''); return; }
    updateStatus(order.id, ns);
  };
  const onCancelAction = async (id, action) => {
    if (action === 'reject') { setRejectModal(id); setRejectReason(''); return; }
    const ep = `http://localhost:8000/api/orders/${id}/approve-cancel`;
    try {
      const res = await fetch(ep,{ method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({}) });
      if (res.ok) { load(page); showToast('Cancellation approved', 'success'); }
      else { const d=await res.json(); showToast(d.message||'Error', 'error'); }
    } catch(e){ showToast(e.message, 'error'); }
  };
  const submitReject = async () => {
    if (!rejectReason.trim()) { showToast('Rejection reason required', 'error'); return; }
    try {
      const res = await fetch(`http://localhost:8000/api/orders/${rejectModal}/reject-cancel`,{ method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ rejectionReason: rejectReason }) });
      if (res.ok) { load(page); showToast('Cancellation rejected', 'success'); }
      else { const d=await res.json(); showToast(d.message||'Error', 'error'); }
    } catch(e){ showToast(e.message, 'error'); }
    setRejectModal(null); setRejectReason('');
  };

  const filtered = orders.filter(o => !searchQ || String(o.id).includes(searchQ) || (users[o.userId]?.name||'').toLowerCase().includes(searchQ.toLowerCase()));
  const counts   = { total:pagination.total, pending:0, processing:0, delivered:0, cancelReq:0 };
  const FILTER_KEYS = ['all','pending','processing','shipped','out_for_delivery','delivered','cancel_requested','cancelled','refunded'];
  const handleFilterChange = (f) => { setFilter(f); setPage(1); load(1, f); };
  const handleSearch = (val) => { setSearchQ(val); setPage(1); load(1, filter); };

  if (loading) return <div className="page-wrap"><div className="spinner-wrap"><div className="spinner"/><span className="text-muted">Loading orders…</span></div></div>;

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">{userRole==='admin'?'Order Management':'All Orders'}</h1>
          <span className="page-count">{filtered.length}</span>
        </div>
      </div>

      <div className="page-body">
        {/* KPI */}
        <div className="stat-grid mb-20">
          <div className="stat-card c-primary"><div className="stat-icon">🛒</div><div className="stat-label">Total</div><div className="stat-value">{counts.total}</div></div>
          <div className="stat-card c-warning"><div className="stat-icon">📋</div><div className="stat-label">Pending</div><div className="stat-value">{counts.pending}</div></div>
          <div className="stat-card c-primary"><div className="stat-icon">⚙️</div><div className="stat-label">Processing</div><div className="stat-value">{counts.processing}</div></div>
          <div className="stat-card c-success"><div className="stat-icon">✅</div><div className="stat-label">Delivered</div><div className="stat-value">{counts.delivered}</div></div>
          {counts.cancelReq>0 && <div className="stat-card c-danger"><div className="stat-icon">⚠️</div><div className="stat-label">Cancel Requests</div><div className="stat-value">{counts.cancelReq}</div></div>}
        </div>

        {/* Filters */}
        <div className="card mb-16">
          <div className="card-body" style={{padding:'10px 14px', display:'flex', flexDirection:'column', gap:10}}>
            <div className="search-bar-pro" style={{ maxWidth: 340 }}>
              <span className="search-icon-wrap">🔍</span>
              <input
                type="text"
                placeholder="Search by order ID or customer…"
                value={searchQ}
                onChange={e => handleSearch(e.target.value)}
              />
              {searchQ && <button className="search-clear-btn" onClick={() => { setSearchQ(''); setPage(1); load(1, filter); }} title="Clear">✕</button>}
            </div>
            <div className="filter-tabs">
              {FILTER_KEYS.map(s => (
                <button key={s} className={`filter-tab${filter===s?' active':''}`} onClick={()=>handleFilterChange(s)}>
                  {s==='all'?'All':s.replace(/_/g,' ')}
                  {filter===s && <span style={{fontSize:'.65rem',marginLeft:4,opacity:.7}}>({pagination.total})</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Order cards */}
        {filtered.length===0
          ? <div className="card"><div className="empty-state"><div className="empty-icon">📦</div><div className="empty-title">No orders</div><div className="empty-desc">Try a different filter</div></div></div>
          : <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {filtered.map(order => {
                const item    = order.items?.[0];
                const product = item ? products[item.product_id||item.productId] : null;
                const user    = users[order.userId] || users[String(order.userId)] || users[Number(order.userId)];
                const si      = OS[order.status];
                const addr    = parseAddr(order.shippingAddress);
                const isCancel= order.status==='cancel_requested';
                return (
                  <div key={order.id} className={`order-card${isCancel?' cancel-flag':''}`}>
                    {/* head */}
                    <div className="order-card-head">
                      <div>
                        <div className="order-card-num">Order #{order.id}
                          {order.userOrderNumber && (
                            <span style={{fontSize:'.65rem',fontWeight:500,color:'var(--gray-400)',marginLeft:7,letterSpacing:0}}>
                              Customer's #{order.userOrderNumber}
                            </span>
                          )}
                        </div>
                        <div className="order-card-meta">
                          Customer: <strong>{user?.name || `User #${order.userId}` || 'Unknown'}</strong>
                          &nbsp;·&nbsp;
                          {new Date(order.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                        </div>
                      </div>
                      <span className="status-pill" style={{background:si?.color||'#888'}}>{si?.icon} {si?.label}</span>
                    </div>

                    {/* body */}
                    <div className="order-card-body">
                      <img src={product?.images?.[0]||`https://placehold.co/72x72/eee/999?text=O`} alt="p" className="order-card-img" onError={e=>{e.target.src='https://placehold.co/72x72/eee/999?text=Img';}}/>
                      <div className="order-card-details">
                        <div className="order-card-product">{product?.name||(item?.name||'Product')}</div>
                        <div className="order-card-qty">Qty: {item?.quantity||1} × ₹{fmt(item?.price||0)}</div>
                        {addr.line && <div className="order-card-addr">📍 {addr.line}{addr.phone&&` · ${addr.phone}`}</div>}
                        {order.trackingNumber && <div className="order-card-tracking">🚚 {order.courierName} · #{order.trackingNumber}{order.estimatedDelivery&&` · Est: ${new Date(order.estimatedDelivery).toLocaleDateString('en-IN')}`}</div>}
                        {isCancel && order.cancellationReason && <div className="cancel-warn">⚠️ Cancellation requested: {order.cancellationReason}</div>}
                      </div>
                      <div className="order-card-amount">₹{fmt(order.totalAmount)}</div>
                    </div>

                    {/* actions */}
                    {userRole==='admin' && (
                      <div className="order-card-actions">
                        {isCancel ? (
                          <>
                            <span style={{fontSize:'.76rem',fontWeight:700,color:'var(--warning)'}}>Action needed:</span>
                            <button className="btn btn-success btn-sm" onClick={()=>onCancelAction(order.id,'approve')}>✅ Approve</button>
                            <button className="btn btn-danger btn-sm"  onClick={()=>onCancelAction(order.id,'reject')}>❌ Reject</button>
                          </>
                        ) : si?.next?.map(ns => (
                          <button key={ns} className="btn btn-sm" onClick={()=>onStatusClick(order,ns)}
                            style={{background:ns==='cancelled'?'var(--danger)':OS[ns]?.color||'var(--fk-blue)',color:'#fff'}}>
                            {OS[ns]?.icon} {OS[ns]?.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
        }

        {/* ── Reject cancel modal ── */}
        {rejectModal && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: 440 }}>
              <div className="modal-header">
                <div className="modal-title">Reject Cancellation</div>
                <button className="modal-close" onClick={() => { setRejectModal(null); setRejectReason(''); }}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Rejection Reason *</label>
                  <textarea className="form-control" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Order already shipped, cannot cancel at this stage…" />
                  <div className="form-text">Customer will see this reason in their order history.</div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => { setRejectModal(null); setRejectReason(''); }}>Back</button>
                <button className="btn btn-danger" onClick={submitReject}>Submit Rejection</button>
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
        {cancelMod && (
          <div className="modal-overlay">
            <div className="modal" style={{maxWidth:460}}>
              <div className="modal-header" style={{background:'linear-gradient(135deg,#d32f2f,#b71c1c)',borderRadius:'var(--radius-lg) var(--radius-lg) 0 0'}}>
                <div><div className="modal-title" style={{color:'#fff'}}>❌ Cancel Order #{cancelMod.order.id}</div><div style={{fontSize:'.72rem',color:'rgba(255,255,255,.75)',marginTop:3}}>Customer will see this reason</div></div>
                <button className="modal-close" style={{background:'rgba(255,255,255,.15)',color:'#fff'}} onClick={()=>{setCancelMod(null);setCancelReason('');}}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Cancellation Reason *</label>
                  <textarea className="form-control" rows={4} value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="e.g. Item out of stock, payment verification failed…"/>
                  <div className="form-text" style={{marginTop:5}}>ℹ️ Customer will see this in their order history.</div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={()=>{setCancelMod(null);setCancelReason('');}}>Back</button>
                <button className="btn btn-danger" onClick={()=>{ if(!cancelReason.trim()){showToast('Reason required.','error');return;} updateStatus(cancelMod.order.id,'cancelled',{cancellationReason:cancelReason.trim()}); setCancelMod(null); setCancelReason(''); }}>Confirm Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Shipping modal ── */}
        {selOrder?.pend==='shipped' && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header" style={{background:'linear-gradient(135deg,var(--fk-blue),var(--fk-blue-dark))',borderRadius:'var(--radius-lg) var(--radius-lg) 0 0'}}>
                <div><div className="modal-title" style={{color:'#fff'}}>🚚 Add Shipping Details</div><div style={{fontSize:'.72rem',color:'rgba(255,255,255,.75)',marginTop:3}}>Order #{selOrder.id}</div></div>
                <button className="modal-close" style={{background:'rgba(255,255,255,.15)',color:'#fff'}} onClick={()=>{setSelOrder(null);setTracking({trackingNumber:'',courierName:'',estimatedDelivery:''});}}>✕</button>
              </div>
              <div className="modal-body">
                <div className="tracking-form-wrap">
                  <div className="tracking-form-title">🏷️ Tracking Information</div>
                  <div className="grid-2 mb-12">
                    <div className="form-group">
                      <label className="form-label">Tracking Number *</label>
                      <input className="form-control" value={tracking.trackingNumber} onChange={e=>setTracking({...tracking,trackingNumber:e.target.value})} placeholder="e.g. 1234567890"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Courier *</label>
                      <select className="form-control" value={tracking.courierName} onChange={e=>setTracking({...tracking,courierName:e.target.value})}>
                        <option value="">Select courier</option>
                        {['Blue Dart','Delhivery','FedEx','DHL','Ecom Express','India Post','DTDC'].map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Est. Delivery Date <span className="text-muted">(optional)</span></label>
                    <input type="date" className="form-control" value={tracking.estimatedDelivery} onChange={e=>setTracking({...tracking,estimatedDelivery:e.target.value})} min={new Date().toISOString().split('T')[0]}/>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={()=>{setSelOrder(null);setTracking({trackingNumber:'',courierName:'',estimatedDelivery:''});}}>Cancel</button>
                <button className="btn btn-blue" onClick={()=>{ if(!tracking.trackingNumber||!tracking.courierName){showToast('Tracking # and courier required.','error');return;} updateStatus(selOrder.id,'shipped',{...tracking,shippedAt:new Date().toISOString()}); }}>🚚 Mark as Shipped</button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'20px 0 8px' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => { const np = Math.max(1,p-1); load(np); return np; })}
            disabled={page === 1}
            style={{ minWidth:90 }}
          >
            ← Previous
          </button>
          <span style={{ fontSize:'.84rem', color:'var(--gray-600)', fontWeight:600 }}>
            Page {page} of {pagination.pages} &nbsp;·&nbsp; {pagination.total} orders
          </span>
          <button
            className="btn btn-sm"
            onClick={() => setPage(p => { const np = Math.min(pagination.pages,p+1); load(np); return np; })}
            disabled={page === pagination.pages}
            style={{ minWidth:90, background:'var(--fk-blue)', color:'#fff' }}
          >
            Next →
          </button>
        </div>
      )}
      <BackToTop />
    </div>
  );
}