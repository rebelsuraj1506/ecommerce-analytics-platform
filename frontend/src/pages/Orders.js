import React, { useState, useEffect } from 'react';
import './pages.css';
import BackToTop from './BackToTop';

const OS = {
  pending:          {label:'Order Placed',       color:'#d97706', icon:'📋', next:['processing','cancelled']},
  processing:       {label:'Processing',          color:'#1d4ed8', icon:'⚙️',  next:['shipped','cancelled']},
  shipped:          {label:'Shipped',             color:'#6d28d9', icon:'🚚', next:['out_for_delivery','cancelled']},
  out_for_delivery: {label:'Out for Delivery',    color:'#c2410c', icon:'🚛', next:['delivered','cancelled']},
  delivered:        {label:'Delivered',           color:'#16a34a', icon:'✅', next:[]},
  cancel_requested: {label:'Cancel Requested',    color:'#b45309', icon:'⏳', next:['cancelled','processing']},
  cancelled:        {label:'Cancelled',           color:'#dc2626', icon:'❌', next:['refund_processing']},
  refund_processing:{label:'Refund Processing',   color:'#7c3aed', icon:'💰', next:['refunded']},
  refunded:         {label:'Refunded',            color:'#0f766e', icon:'💚', next:[]},
};
const parseAddr = a => { if(!a) return {}; const o=typeof a==='string'?(() =>{try{return JSON.parse(a);}catch{return {};} })():a; const p=[o.street,o.city,o.state].filter(Boolean); return {line:p.length?p.join(', ')+(o.zipCode?` – ${o.zipCode}`:''): null,phone:o.phone||null}; };
const fmt = v => { const n=parseFloat(v); return isNaN(n)?'0.00':n.toFixed(2); };

const FILTER_LABELS = {
  all:'All', pending:'Pending', processing:'Processing', shipped:'Shipped',
  out_for_delivery:'Out for Delivery', delivered:'Delivered',
  cancel_requested:'Cancel Req.', cancelled:'Cancelled', refunded:'Refunded'
};
const FILTER_ICONS = {all:'🛒',pending:'📋',processing:'⚙️',shipped:'🚚',out_for_delivery:'🚛',delivered:'✅',cancel_requested:'⏳',cancelled:'❌',refunded:'💚'};

export default function Orders({token, userRole}) {
  const [orders,   setOrders]   = useState([]);
  const [products, setProducts] = useState({});
  const [users,    setUsers]    = useState({});
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [searchQ,  setSearchQ]  = useState('');
  const [selOrder, setSelOrder] = useState(null);
  const [cancelMod,setCancelMod]= useState(null);
  const [cancelReason,setCancelReason] = useState('');
  const [tracking, setTracking] = useState({trackingNumber:'',courierName:'',estimatedDelivery:''});
  const [toast,    setToast]    = useState(null);
  const [rejectModal,setRejectModal] = useState(null);
  const [rejectReason,setRejectReason] = useState('');
  const [page,     setPage]     = useState(1);
  const [pagination,setPagination] = useState({total:0,pages:1});
  const PAGE_SIZE = 15;

  const showToast = (msg,type='info') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  useEffect(()=>{ document.title=`${userRole==='admin'?'Order Management':'All Orders'} — ShopMart`; return()=>{document.title='ShopMart';}; },[userRole]);
  useEffect(()=>{ load(page); },[token,page]);

  const load = async (pg=1, statusFilter=filter) => {
    setLoading(true);
    try {
      const sp = statusFilter!=='all'?`&status=${statusFilter}`:'';
      const [oR,pR,uR] = await Promise.all([
        fetch(`http://localhost:8000/api/orders?limit=${PAGE_SIZE}&page=${pg}${sp}`,{headers:{Authorization:`Bearer ${token}`}}),
        fetch('http://localhost:8000/api/products?limit=100'),
        fetch('http://localhost:8000/api/users?limit=1000',{headers:{Authorization:`Bearer ${token}`}}),
      ]);
      const [oD,pD,uD] = await Promise.all([oR.json(),pR.json(),uR.json()]);
      const pMap={}, uMap={};
      (pD.data?.products||[]).forEach(p=>{pMap[p._id]=p;});
      (uD.data?.users||[]).forEach(u=>{uMap[u.id]=u; uMap[String(u.id)]=u; uMap[Number(u.id)]=u;});
      setProducts(pMap); setUsers(uMap);
      setOrders((oD.data?.orders||[]).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
      setPagination({total:oD.data?.pagination?.total||0, pages:oD.data?.pagination?.pages||1});
    } catch(e){console.error(e);} finally{setLoading(false);}
  };

  const updateStatus = async (id,status,extra={}) => {
    try {
      const r = await fetch(`http://localhost:8000/api/orders/${id}/status`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({status,...extra})});
      if(r.ok){load(page); setSelOrder(null); setTracking({trackingNumber:'',courierName:'',estimatedDelivery:''}); showToast('Status updated','success');}
      else{const d=await r.json(); showToast(d.message||'Failed','error');}
    } catch(e){showToast(e.message,'error');}
  };

  const onStatusClick = (order,ns) => {
    if(ns==='shipped'){setSelOrder({...order,pend:ns}); return;}
    if(ns==='cancelled'){setCancelMod({order}); setCancelReason(''); return;}
    updateStatus(order.id,ns);
  };
  const onCancelAction = async (id,action) => {
    if(action==='reject'){setRejectModal(id); setRejectReason(''); return;}
    const r = await fetch(`http://localhost:8000/api/orders/${id}/approve-cancel`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({})});
    if(r.ok){load(page); showToast('Cancellation approved','success');}
    else{const d=await r.json(); showToast(d.message||'Error','error');}
  };
  const submitReject = async () => {
    if(!rejectReason.trim()){showToast('Reason required','error'); return;}
    const r = await fetch(`http://localhost:8000/api/orders/${rejectModal}/reject-cancel`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({rejectionReason:rejectReason})});
    if(r.ok){load(page); showToast('Rejection submitted','success');}
    else{const d=await r.json(); showToast(d.message||'Error','error');}
    setRejectModal(null); setRejectReason('');
  };

  const handleFilterChange = f => { setFilter(f); setPage(1); load(1,f); };
  const handleSearch = val => { setSearchQ(val); setPage(1); load(1,filter); };

  const filtered = orders.filter(o => !searchQ || String(o.id).includes(searchQ) || (users[o.userId]?.name||'').toLowerCase().includes(searchQ.toLowerCase()));
  const FILTER_KEYS = Object.keys(FILTER_LABELS);

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon">{userRole==='admin'?'⚙️':'🛒'}</div>
          <h1 className="page-title">{userRole==='admin'?'Order Management':'All Orders'}</h1>
          <span className="page-count">{pagination.total}</span>
        </div>
      </div>

      <div className="page-body">
        {/* Filter & Search bar */}
        <div className="toolbar-card mb-16">
          <div className="search-bar-pro" style={{maxWidth:320}}>
            <span className="search-icon-wrap">🔍</span>
            <input type="text" placeholder="Search order ID or customer…" value={searchQ} onChange={e=>handleSearch(e.target.value)}/>
            {searchQ && <button className="search-clear-btn" onClick={()=>{setSearchQ(''); load(1,filter);}}>✕</button>}
          </div>
          <div className="filter-tabs">
            {FILTER_KEYS.map(s=>(
              <button key={s} className={`filter-tab${filter===s?' active':''}`} onClick={()=>handleFilterChange(s)}>
                <span className="filter-tab-icon">{FILTER_ICONS[s]}</span> {FILTER_LABELS[s]}
                {filter===s && pagination.total>0 && <span className="filter-tab-count">{pagination.total}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Orders */}
        {loading ? (
          <div className="spinner-wrap"><div className="spinner"/><span className="text-muted">Loading orders…</span></div>
        ) : filtered.length===0 ? (
          <div className="card"><div className="empty-state"><div className="empty-icon">📦</div><div className="empty-title">No orders found</div><div className="empty-desc">Try a different filter or search term</div></div></div>
        ) : (
          <div className="orders-list">
            {filtered.map(order=>{
              const item    = order.items?.[0];
              const prod    = item ? products[item.product_id||item.productId] : null;
              const user    = users[order.userId]||users[String(order.userId)]||users[Number(order.userId)];
              const si      = OS[order.status];
              const addr    = parseAddr(order.shippingAddress);
              const isCancel= order.status==='cancel_requested';
              return (
                <div key={order.id} className={`order-card${isCancel?' cancel-flag':''}`}>
                  <div className="order-card-head">
                    <div>
                      <div className="order-card-num">
                        Order <span className="order-id">#{order.id}</span>
                        {order.userOrderNumber && <span className="order-card-sub">· Customer #{order.userOrderNumber}</span>}
                      </div>
                      <div className="order-card-meta">
                        <strong>{user?.name||`User #${order.userId}`}</strong>
                        <span className="meta-dot">·</span>
                        {new Date(order.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </div>
                    </div>
                    <span className="status-pill" style={{background:si?.color||'#888'}}>{si?.icon} {si?.label}</span>
                  </div>

                  <div className="order-card-body">
                    <img src={prod?.images?.[0]||'https://placehold.co/72x72/f3f4f6/9ca3af?text=📦'} alt="product"
                      className="order-card-img" onError={e=>{e.target.src='https://placehold.co/72x72/f3f4f6/9ca3af?text=Img';}}/>
                    <div className="order-card-details">
                      <div className="order-card-product">{prod?.name||(item?.name||'Product')}</div>
                      <div className="order-card-qty">Qty: {item?.quantity||1} × ₹{fmt(item?.price||0)}</div>
                      {addr.line && <div className="order-card-addr">📍 {addr.line}{addr.phone&&` · ${addr.phone}`}</div>}
                      {order.trackingNumber && <div className="order-card-tracking">🚚 {order.courierName} · #{order.trackingNumber}</div>}
                      {isCancel && order.cancellationReason && <div className="cancel-warn">⚠️ {order.cancellationReason}</div>}
                    </div>
                    <div className="order-card-amount">₹{fmt(order.totalAmount)}</div>
                  </div>

                  {userRole==='admin' && (
                    <div className="order-card-actions">
                      {isCancel ? (
                        <>
                          <span className="action-needed-label">⚠️ Action needed:</span>
                          <button className="btn btn-success btn-sm" onClick={()=>onCancelAction(order.id,'approve')}>✅ Approve</button>
                          <button className="btn btn-danger btn-sm"  onClick={()=>onCancelAction(order.id,'reject')}>❌ Reject</button>
                        </>
                      ) : si?.next?.map(ns=>(
                        <button key={ns} className="btn btn-sm status-action-btn" onClick={()=>onStatusClick(order,ns)}
                          style={{background:OS[ns]?.color||'var(--brand)',color:'#fff',border:'none'}}>
                          {OS[ns]?.icon} {OS[ns]?.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages>1 && (
          <div className="pagination-bar">
            <button className="pagination-btn prev" disabled={page===1} onClick={()=>setPage(p=>{const n=Math.max(1,p-1); load(n); return n;})}>← Previous</button>
            <span className="pagination-info">Page {page} of {pagination.pages} · {pagination.total} orders</span>
            <button className="pagination-btn next" disabled={page===pagination.pages} onClick={()=>setPage(p=>{const n=Math.min(pagination.pages,p+1); load(n); return n;})}>Next →</button>
          </div>
        )}

        {/* Reject Modal */}
        {rejectModal && (
          <div className="modal-overlay">
            <div className="modal" style={{maxWidth:440}}>
              <div className="modal-header">
                <div className="modal-title">Reject Cancellation</div>
                <button className="modal-close" onClick={()=>{setRejectModal(null); setRejectReason('');}}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Rejection Reason *</label>
                  <textarea className="form-control" rows={3} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="e.g. Order already shipped, cannot cancel at this stage…"/>
                  <div className="form-text">Customer will see this reason in their order history.</div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={()=>{setRejectModal(null); setRejectReason('');}}>Back</button>
                <button className="btn btn-danger" onClick={submitReject}>Submit Rejection</button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Modal */}
        {cancelMod && (
          <div className="modal-overlay">
            <div className="modal" style={{maxWidth:460}}>
              <div className="modal-header modal-header-danger">
                <div>
                  <div className="modal-title" style={{color:'#fff'}}>❌ Cancel Order #{cancelMod.order.id}</div>
                  <div className="modal-header-sub">Customer will see this reason</div>
                </div>
                <button className="modal-close modal-close-white" onClick={()=>{setCancelMod(null); setCancelReason('');}}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Cancellation Reason *</label>
                  <textarea className="form-control" rows={4} value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="e.g. Item out of stock, payment verification failed…"/>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={()=>{setCancelMod(null); setCancelReason('');}}>Back</button>
                <button className="btn btn-danger" onClick={()=>{if(!cancelReason.trim()){showToast('Reason required','error');return;} updateStatus(cancelMod.order.id,'cancelled',{cancellationReason:cancelReason.trim()}); setCancelMod(null); setCancelReason('');}}>Confirm Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Shipping Modal */}
        {selOrder?.pend==='shipped' && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header modal-header-brand">
                <div>
                  <div className="modal-title" style={{color:'#fff'}}>🚚 Add Shipping Details</div>
                  <div className="modal-header-sub">Order #{selOrder.id}</div>
                </div>
                <button className="modal-close modal-close-white" onClick={()=>{setSelOrder(null); setTracking({trackingNumber:'',courierName:'',estimatedDelivery:''});}}>✕</button>
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
                    <label className="form-label">Estimated Delivery</label>
                    <input type="date" className="form-control" value={tracking.estimatedDelivery} onChange={e=>setTracking({...tracking,estimatedDelivery:e.target.value})} min={new Date().toISOString().split('T')[0]}/>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={()=>{setSelOrder(null); setTracking({trackingNumber:'',courierName:'',estimatedDelivery:''});}}>Cancel</button>
                <button className="btn btn-blue" onClick={()=>{if(!tracking.trackingNumber.trim()||!tracking.courierName){showToast('Tracking number and courier required','error');return;} updateStatus(selOrder.id,'shipped',tracking);}}>Confirm Shipment</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <BackToTop/>
      {toast && <div className={`toast-fixed toast-${toast.type}`}>{toast.type==='success'?'✅':toast.type==='error'?'❌':'ℹ️'} {toast.msg}</div>}
    </div>
  );
}