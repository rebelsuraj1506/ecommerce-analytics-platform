import React, { useState, useEffect } from 'react';
import './pages.css';
import BackToTop from './BackToTop';
const OS = {
  pending:          { label:'Order Placed',         color:'#f57c00', icon:'📋', canCancel:true },
  processing:       { label:'Processing',            color:'#1565c0', icon:'⚙️',  canCancel:true },
  shipped:          { label:'Shipped',               color:'#4527a0', icon:'🚚', canCancel:true },
  out_for_delivery: { label:'Out for Delivery',      color:'#bf360c', icon:'🚛', canCancel:true },
  delivered:        { label:'Delivered',             color:'#2e7d32', icon:'✅', canCancel:false },
  cancel_requested: { label:'Cancellation Requested',color:'#e65100', icon:'⏳', canCancel:false },
  cancelled:        { label:'Cancelled',             color:'#c62828', icon:'❌', canCancel:false },
  refund_processing:{ label:'Refund Processing',     color:'#6a1b9a', icon:'💰', canCancel:false },
  refunded:         { label:'Refunded',              color:'#2e7d32', icon:'✅', canCancel:false },
};
const STEP_KEYS = ['pending','processing','shipped','out_for_delivery','delivered'];
const CANCEL_STATES = ['cancel_requested','cancelled','refund_processing','refunded'];

const formatPrice = v => { const n=parseFloat(v); return isNaN(n)?'0.00':n.toFixed(2); };
const getAddr = a => {
  if (!a) return {};
  const obj = typeof a==='string' ? (() => { try{return JSON.parse(a);}catch{return{};} })() : a;
  const parts=[obj.street,obj.city,obj.state].filter(Boolean);
  return { line:parts.length?parts.join(', ')+(obj.zipCode?` – ${obj.zipCode}`:''):null, phone:obj.phone||null };
};

const CANCEL_REASONS = [
  'Product no longer needed','Found a better price elsewhere','Ordered by mistake',
  'Expected delivery time is too long','Changed my mind','Quality concerns based on reviews',
  'Wrong product ordered','Shipping address is incorrect','Payment method issue',
  'Other (Please specify)'
];
const RETURN_REASONS = [
  { label:'Damaged / Defective', icon:'💔', sub:['Item is physically damaged','Item is not working','Packaging was damaged','Missing accessories / parts'] },
  { label:'Wrong Item Received',  icon:'📦', sub:['Wrong product delivered','Wrong colour received','Wrong size / variant received','Different brand received'] },
  { label:'Quality Issues',       icon:'⚠️',  sub:['Product quality is poor','Fabric / material issue','Fading / discolouration','Item looks different from photos'] },
  { label:'Incomplete Order',     icon:'📋', sub:['Item is missing from package','Quantity is less than ordered','Free gift / offer item missing'] },
  { label:'Changed My Mind',      icon:'🔄', sub:['No longer needed','Ordered by mistake','Found a better option','Too expensive for the quality'] },
  { label:'Other',                icon:'✏️',  sub:['Please describe your issue below'] },
];
const DETAIL_REASONS = [
  'Need invoice / billing proof','Warranty / service claim','Bank / payment dispute',
  'Return / replacement reference','Tax / accounting','Other'
];

export default function MyOrders({ token, userId, userName }) {
  const [orders,   setOrders]   = useState([]);
  const [deletedOrders, setDeletedOrders] = useState([]);
  const [products, setProducts] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [expandedTracking, setExpandedTracking] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [restoreModal, setRestoreModal] = useState(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);

  /* Cancel modal state */
  const [cancelModal,  setCancelModal]  = useState(null);
  const [cancelData,   setCancelData]   = useState({ reason:'', customReason:'', images:[] });

  /* Review modal state */
  const [reviewModal,       setReviewModal]       = useState(null);
  const [reviewRating,      setReviewRating]      = useState(5);
  const [reviewComment,     setReviewComment]     = useState('');
  const [reviewSubmitting,  setReviewSubmitting]  = useState(false);

  /* Return/replace modal */
  const [returnModal,      setReturnModal]      = useState(null);
  const [returnData,       setReturnData]       = useState({ type:'return', primaryReason:'', subReason:'', customReason:'', images:[] });
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  /* Detail request modal */
  const [detailModal,      setDetailModal]      = useState(null);
  const [detailReason,     setDetailReason]     = useState('');
  const [detailOther,      setDetailOther]      = useState('');
  const [detailSubmitting, setDetailSubmitting] = useState(false);
  const [detailInfo,       setDetailInfo]       = useState(null);

  useEffect(() => {
    document.title = 'My Orders — ShopMart';
    return () => { document.title = 'ShopMart'; };
  }, []);

  useEffect(() => { fetchProducts(); fetchOrders(); fetchDeletedOrders(); }, [token, userId]);

  const fetchProducts = async () => {
    try {
      const r = await fetch('http://localhost:8000/api/products?limit=100');
      const d = await r.json();
      const m = {}; (d.data?.products||[]).forEach(p=>{m[p._id]=p;});
      setProducts(m);
    } catch(e){ console.error(e); }
  };

  const fetchOrders = async () => {
    if (!userId) { setError('User ID missing — please log out and log in again.'); setLoading(false); return; }
    try {
      const r = await fetch('http://localhost:8000/api/orders',{ headers:{ Authorization:`Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const all = d.data?.orders||[];
      const mine = all.filter(o => String(o.userId||o.user_id||o._userId) === String(userId));
      mine.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
      setOrders(mine);
    } catch(e){ setError('Failed to load orders: '+e.message); }
    finally { setLoading(false); }
  };

  const fetchDeletedOrders = async () => {
    if (!token) return;
    try {
      const r = await fetch('http://localhost:8000/api/orders/deleted', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d = await r.json();
        setDeletedOrders(d.data?.orders || []);
      }
    } catch(e) { console.error(e); }
  };

  const handleRestoreRequest = async () => {
    if (!restoreModal || restoreReason.trim().length < 10) { alert('Please provide a reason (min 10 characters).'); return; }
    setRestoreSubmitting(true);
    try {
      const r = await fetch(`http://localhost:8000/api/orders/${restoreModal.id}/restore-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: restoreReason.trim() })
      });
      const d = await r.json();
      if (r.ok) { alert('✅ Restoration request submitted! Admin will review shortly.'); setRestoreModal(null); setRestoreReason(''); fetchDeletedOrders(); }
      else alert(d.message || 'Failed');
    } catch(e) { alert(e.message); }
    setRestoreSubmitting(false);
  };

  /* ── Cancel request ── */
  const handleCancelRequest = async orderId => {
    if (!cancelData.reason) return alert('Please select a reason.');
    if (cancelData.reason==='Other (Please specify)' && !cancelData.customReason.trim()) return alert('Please provide a reason.');
    const reason = cancelData.reason==='Other (Please specify)' ? cancelData.customReason : cancelData.reason;
    try {
      const r = await fetch(`http://localhost:8000/api/orders/${orderId}/cancel-request`,{
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ reason, images:cancelData.images.filter(x=>x.trim()) })
      });
      if (r.ok) { alert('✅ Cancellation request submitted! Our team will review within 24–48 hours.'); setCancelModal(null); setCancelData({reason:'',customReason:'',images:[]}); fetchOrders(); }
      else { const e=await r.json(); alert(e.message||'Failed'); }
    } catch(e){ alert(e.message); }
  };

  /* ── Review ── */
  const handleSubmitReview = async () => {
    if (!reviewModal) return; setReviewSubmitting(true);
    try {
      const r = await fetch(`http://localhost:8000/api/orders/${reviewModal.orderId}/review`,{
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ productId:reviewModal.productId, rating:reviewRating, comment:reviewComment.trim(), userName:userName||'User' })
      });
      const d = await r.json();
      if (r.ok) { alert('✅ Review submitted! Thank you.'); setReviewModal(null); setReviewRating(5); setReviewComment(''); fetchProducts(); }
      else alert(d.message||'Failed');
    } catch(e){ alert(e.message); } finally { setReviewSubmitting(false); }
  };

  /* ── Return/replace ── */
  const handleReturnRequest = async () => {
    if (!returnModal||!returnData.primaryReason) return alert('Please select a reason.');
    if (returnData.primaryReason==='Other'&&!returnData.customReason.trim()) return alert('Please describe your issue.');
    setReturnSubmitting(true);
    const finalReason = `${returnData.primaryReason}${returnData.subReason?' – '+returnData.subReason:''}`;
    const note = returnData.customReason.trim();
    try {
      const r = await fetch(`http://localhost:8000/api/orders/${returnModal.order.id}/cancel-request`,{
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ reason:note?`${finalReason}: ${note}`:finalReason, returnType:returnData.type, images:returnData.images.filter(x=>x.trim()) })
      });
      if (r.ok) { alert(`✅ ${returnData.type==='replace'?'Replacement':'Return'} request submitted!`); setReturnModal(null); setReturnData({type:'return',primaryReason:'',subReason:'',customReason:'',images:[]}); fetchOrders(); }
      else { const e=await r.json(); alert(e.message||'Failed'); }
    } catch(e){ alert(e.message); } finally { setReturnSubmitting(false); }
  };

  /* ── Detail request ── */
  const openDetailRequest = async (orderId, userOrderNumber) => {
    setDetailModal({orderId, userOrderNumber}); setDetailReason(''); setDetailOther(''); setDetailInfo(null);
    try {
      const r = await fetch(`http://localhost:8000/api/orders/${orderId}/detail-request`,{ headers:{ Authorization:`Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) setDetailInfo(d.data?.request||null);
    } catch(e){ console.error(e); }
  };
  const submitDetailRequest = async () => {
    if (!detailModal||!detailReason) return alert('Please select a reason.');
    if (detailReason==='Other'&&!detailOther.trim()) return alert('Please enter your reason.');
    setDetailSubmitting(true);
    try {
      const r = await fetch(`http://localhost:8000/api/orders/${detailModal.orderId}/detail-request`,{
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ reason:detailReason, otherReason:detailOther })
      });
      const d = await r.json();
      if (r.ok) { alert('✅ Request submitted. Admin will review it soon.'); setDetailInfo(d.data?.request||null); }
      else alert(d.message||'Failed');
    } catch(e){ alert(e.message); } finally { setDetailSubmitting(false); }
  };

  if (loading) return <div className="page-wrap"><div className="spinner-wrap"><div className="spinner"/><span className="text-muted">Loading your orders…</span></div></div>;
  if (error)   return <div className="page-wrap"><div className="page-body"><div className="alert alert-danger">{error}</div></div></div>;

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">My Orders</h1>
          <span className="page-count">{orders.length}</span>
        </div>
      </div>

      <div className="my-orders-wrap">
        {orders.length===0 ? (
          <div className="card"><div className="empty-state">
            <div className="empty-icon">🛒</div>
            <div className="empty-title">No orders yet</div>
            <div className="empty-desc">You haven't placed any orders. Start shopping!</div>
          </div></div>
        ) : orders.map(order => {
          const firstItem = order.items?.[0];
          const product   = firstItem ? products[firstItem.product_id||firstItem.productId] : null;
          // For deleted orders with approved access, show last known status instead of 'deleted'
          const displayStatus = (order.status === 'deleted' && order.canViewDetails && order.statusBeforeDeletion)
            ? order.statusBeforeDeletion
            : order.status;
          const si        = OS[displayStatus]||{ label:displayStatus, color:'#757575', icon:'📦', canCancel:false };
          const imgUrl    = product?.images?.[0]||`https://placehold.co/84x84/eeeeee/9e9e9e?text=Order`;
          const addr      = getAddr(order.shippingAddress);
          const isCancelState = CANCEL_STATES.includes(displayStatus);
          const SEVEN_DAYS    = 7*24*60*60*1000;
          const isWithin7Days = displayStatus==='delivered' && order.deliveredAt && (Date.now()-new Date(order.deliveredAt).getTime())<=SEVEN_DAYS;
          const daysLeft      = isWithin7Days ? Math.ceil((SEVEN_DAYS-(Date.now()-new Date(order.deliveredAt).getTime()))/(24*60*60*1000)) : 0;
          const canCancel     = (si.canCancel && !['cancelled','delivered','refunded'].includes(displayStatus)) || isWithin7Days;
          const expanded      = expandedTracking===order.id;

          const curStepIdx = STEP_KEYS.indexOf(displayStatus);

          return (
            <div key={order.id} className={`my-order-card${order.status==='cancel_requested'?' flagged':''}`}>

              {/* ── Card header ── */}
              <div className="my-order-head">
                <div>
                  <div className="my-order-id">Order #{order.userOrderNumber || order.id}</div>
                  <div className="my-order-date">{new Date(order.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>
                  {order.status === 'deleted' && order.canViewDetails && (
                    <div style={{fontSize:'0.7rem',color:'#9e9e9e',marginTop:2}}>🗑️ Deleted order · details restored by admin</div>
                  )}
                </div>
                <span className="status-pill" style={{background:si.color}}>{si.icon} {si.label}</span>
              </div>

              {/* ── Card body ── */}
              <div className="my-order-body">
                <img src={imgUrl} alt="product" className="my-order-img" onError={e=>{e.target.src='https://placehold.co/84x84/eee/999?text=Img';}}/>
                <div className="my-order-info">
                  <div className="my-order-name">{product?.name||(firstItem?.name||'Product')}</div>
                  <div className="my-order-qty">Qty: {firstItem?.quantity||1}</div>
                  <div className="my-order-price">₹{formatPrice(order.totalAmount)}</div>
                  {addr.line && <div className="my-order-addr">📍 {addr.line}{addr.phone&&<> · 📞 {addr.phone}</>}</div>}
                </div>
              </div>

              {/* ── Progress tracker ── */}
              {!isCancelState ? (
                <div className="progress-wrap">
                  <div className="progress-steps">
                    {STEP_KEYS.map((key, i) => {
                      const isDone    = i<=curStepIdx;
                      const isCurrent = i===curStepIdx;
                      return (
                        <div key={key} className={`progress-step${isDone?' done':''}${isCurrent?' current':''}`}>
                          <div className="progress-dot">{isDone?'✓':i+1}</div>
                          <div className="progress-label">{OS[key]?.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{padding:'12px 16px'}}>
                  <div className="cancel-status-banner">
                    <div className="cancel-status-icon">{si.icon}</div>
                    <div>
                      <div className="cancel-status-label" style={{color:si.color}}>{si.label}</div>
                      {order.cancellationReason && <div className="cancel-status-desc">{order.cancellationReason}</div>}
                      {order.status==='cancel_requested' && <div style={{fontSize:'.72rem',color:'var(--warning)',marginTop:4}}>⏳ Under review · you'll be notified via email</div>}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tracking expanded panel ── */}
              {expanded && (
                <div className="track-panel">
                  <div className="track-panel-inner">
                    <div className="track-title">📍 Order Tracking Details</div>
                    <div className="track-timeline">
                      {STEP_KEYS.map((key, i) => {
                        const step = OS[key];
                        const isDone    = curStepIdx>=i;
                        const isCurrent = curStepIdx===i;
                        const dateField = {pending:'createdAt',processing:'processingAt',shipped:'shippedAt',out_for_delivery:'outForDeliveryAt',delivered:'deliveredAt'}[key];
                        const dt = order[dateField];
                        return (
                          <div key={key} className={`track-step${isDone?' done':''}${isCurrent?' current':''}`} style={{position:'relative'}}>
                            {i < STEP_KEYS.length-1 && <div className="track-step-line"/>}
                            <div className="track-dot">{isDone?'✓':''}</div>
                            <div style={{paddingLeft:4,paddingBottom:i<STEP_KEYS.length-1?16:0}}>
                              <div className="track-info-label">{step.label}</div>
                              {dt && <div className="track-info-date">{new Date(dt).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {order.trackingNumber && (
                    <div className="track-detail-row">
                      🚚 <strong>{order.courierName}</strong> · #{order.trackingNumber}
                      {order.estimatedDelivery&&<> · Est: {new Date(order.estimatedDelivery).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</>}
                    </div>
                  )}
                  <div className="track-detail-row">
                    💳 <strong>{order.paymentMethod?.toUpperCase()||'N/A'}</strong> · ₹{formatPrice(order.totalAmount)} · Ordered {new Date(order.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              )}

              {/* ── Review items (delivered) ── */}
              {displayStatus==='delivered' && order.items?.length>0 && (
                <div className="review-items-wrap">
                  <div className="review-items-title">⭐ Rate your purchase:</div>
                  {order.items.map((item,idx) => {
                    const pid  = item.product_id||item.productId;
                    const name = item.name||(products[pid]?.name)||`Item ${idx+1}`;
                    return (
                      <div key={pid||idx} className="review-item-row">
                        <div className="review-item-name">{name}</div>
                        <button className="btn btn-sm" style={{background:'var(--fk-orange)',color:'#fff',flexShrink:0}}
                          onClick={()=>setReviewModal({orderId:order.id,productId:pid,productName:name})}>
                          ⭐ Review
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Action footer ── */}
              <div className="my-order-footer">
                <button className={`btn btn-sm${expanded?' btn-blue':''}`} onClick={()=>setExpandedTracking(expanded?null:order.id)}>
                  📍 {expanded?'Hide Tracking':'Track Order'} {expanded?'▲':'▼'}
                </button>

                {canCancel && !isWithin7Days && (
                  <button className="btn btn-danger btn-sm" onClick={()=>setCancelModal(order)}>❌ Cancel</button>
                )}

                {isWithin7Days && (
                  <>
                    <button className="btn btn-danger btn-sm" onClick={()=>{setReturnModal({order,type:'return'});setReturnData({type:'return',primaryReason:'',subReason:'',customReason:'',images:[]});}}>
                      ↩️ Return <span style={{opacity:.8,fontSize:'.65rem'}}>({daysLeft}d left)</span>
                    </button>
                    <button className="btn btn-sm" style={{background:'var(--fk-blue)',color:'#fff'}} onClick={()=>{setReturnModal({order,type:'replace'});setReturnData({type:'replace',primaryReason:'',subReason:'',customReason:'',images:[]});}}>
                      🔄 Replace <span style={{opacity:.8,fontSize:'.65rem'}}>({daysLeft}d left)</span>
                    </button>
                  </>
                )}

                {!order.canViewDetails && order.canRequestDetails && (
                  <button className="btn btn-sm" style={{background:'#673ab7',color:'#fff'}} onClick={()=>openDetailRequest(order.id, order.userOrderNumber)}>📄 Request Details</button>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* ═══════════════════ CANCEL MODAL ═══════════════════ */}
      {cancelModal && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:580}}>
            <div className="modal-header" style={{background:'linear-gradient(135deg,#c62828,#e53935)',borderRadius:'var(--radius-lg) var(--radius-lg) 0 0'}}>
              <div><div className="modal-title" style={{color:'#fff'}}>🚫 Cancel Order #{cancelModal.userOrderNumber || cancelModal.id}</div><div style={{fontSize:'.72rem',color:'rgba(255,255,255,.8)',marginTop:3}}>Please select a reason for cancellation</div></div>
              <button className="modal-close" style={{background:'rgba(255,255,255,.15)',color:'#fff'}} onClick={()=>{setCancelModal(null);setCancelData({reason:'',customReason:'',images:[]});}}>✕</button>
            </div>
            <div className="modal-body" style={{maxHeight:'62vh',overflowY:'auto'}}>
              <div className="form-label mb-8">Reason for cancellation *</div>
              <div className="reason-list">
                {CANCEL_REASONS.map(r => (
                  <label key={r} className={`reason-opt${cancelData.reason===r?' selected':''}`}>
                    <input type="radio" name="cancelReason" value={r} checked={cancelData.reason===r} onChange={e=>setCancelData({...cancelData,reason:e.target.value})}/>
                    {r}
                  </label>
                ))}
              </div>
              {cancelData.reason==='Other (Please specify)' && (
                <div className="form-group mb-14">
                  <label className="form-label">Specify your reason *</label>
                  <textarea className="form-control" rows={3} value={cancelData.customReason} onChange={e=>setCancelData({...cancelData,customReason:e.target.value})} placeholder="Please provide a detailed reason…"/>
                </div>
              )}
              <div className="form-group mb-14">
                <label className="form-label">Supporting Images <span className="text-muted">(optional)</span></label>
                <div className="form-text mb-8">Add screenshots, photos of defects, etc.</div>
                <div className="image-url-list">
                  {cancelData.images.map((img,i) => (
                    <div key={i} className="image-url-row">
                      <input type="url" className="form-control" placeholder="Paste image URL" value={img} onChange={e=>{const a=[...cancelData.images];a[i]=e.target.value;setCancelData({...cancelData,images:a});}}/>
                      <button className="image-url-del" onClick={()=>setCancelData({...cancelData,images:cancelData.images.filter((_,x)=>x!==i)})}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
                    </div>
                  ))}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={()=>setCancelData({...cancelData,images:[...cancelData.images,'']})}>+ Add Image URL</button>
              </div>
              <div className="alert alert-warning" style={{borderRadius:'var(--radius-md)',fontSize:'.76rem'}}>
                📋 <strong>Refund Policy:</strong> Request reviewed within 24–48 hours. Refund credited to original payment method within 5–7 business days if approved.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>{setCancelModal(null);setCancelData({reason:'',customReason:'',images:[]});}}>Back</button>
              <button className="btn btn-danger" onClick={()=>handleCancelRequest(cancelModal.id)}>Submit Request</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ REVIEW MODAL ═══════════════════ */}
      {reviewModal && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-header">
              <span className="modal-title">⭐ Rate Your Purchase</span>
              <button className="modal-close" onClick={()=>{setReviewModal(null);setReviewRating(5);setReviewComment('');}}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-product-banner">
                <div className="modal-product-name">{reviewModal.productName}</div>
              </div>
              <div className="form-group mb-14">
                <label className="form-label">Rating</label>
                <div className="star-row">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} type="button" className={`star-btn${reviewRating>=s?' lit':''}`} onClick={()=>setReviewRating(s)}>★</button>
                  ))}
                  <span style={{marginLeft:8,fontSize:'.84rem',fontWeight:700,color:'var(--fk-orange)'}}>{reviewRating}/5</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Review <span className="text-muted">(optional)</span></label>
                <textarea className="form-control" rows={3} value={reviewComment} onChange={e=>setReviewComment(e.target.value)} placeholder="Share your experience…"/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>{setReviewModal(null);setReviewRating(5);setReviewComment('');}}>Cancel</button>
              <button className="btn btn-sm" style={{background:'var(--fk-orange)',color:'#fff'}} onClick={handleSubmitReview} disabled={reviewSubmitting}>{reviewSubmitting?'Submitting…':'Submit Review'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ RETURN/REPLACE MODAL ═══════════════════ */}
      {returnModal && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:600}}>
            <div className="modal-header" style={{background:returnData.type==='replace'?'linear-gradient(135deg,#1565c0,#1976d2)':'linear-gradient(135deg,#c62828,#e53935)',borderRadius:'var(--radius-lg) var(--radius-lg) 0 0'}}>
              <div><div className="modal-title" style={{color:'#fff'}}>{returnData.type==='replace'?'🔄 Request Replacement':'↩️ Return & Refund'}</div><div style={{fontSize:'.72rem',color:'rgba(255,255,255,.8)',marginTop:3}}>Order #{returnModal.order.userOrderNumber || returnModal.order.id}</div></div>
              <button className="modal-close" style={{background:'rgba(255,255,255,.15)',color:'#fff'}} onClick={()=>setReturnModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{maxHeight:'65vh',overflowY:'auto'}}>
              {/* Return/Replace toggle */}
              <div className="return-toggle mb-14">
                <button className={`return-btn${returnData.type==='return'?' active-return':''}`} onClick={()=>setReturnData({...returnData,type:'return'})}>↩️ Return & Refund</button>
                <button className={`return-btn${returnData.type==='replace'?' active-replace':''}`} onClick={()=>setReturnData({...returnData,type:'replace'})}>🔄 Replace Item</button>
              </div>

              <div className="form-label mb-10">Why are you {returnData.type==='replace'?'requesting a replacement':'returning this item'}? *</div>
              <div className="reason-cat-grid mb-14">
                {RETURN_REASONS.map(r => (
                  <div key={r.label} className={`reason-cat-card${returnData.primaryReason===r.label?' selected':''}`}
                    onClick={()=>setReturnData({...returnData,primaryReason:r.label,subReason:''})}>
                    <span className="reason-cat-icon">{r.icon}</span>
                    <div className="reason-cat-label">{r.label}</div>
                  </div>
                ))}
              </div>

              {returnData.primaryReason && returnData.primaryReason!=='Other' && (
                <div className="mb-14">
                  <div className="form-label mb-8">Tell us more:</div>
                  <div className="reason-list">
                    {(RETURN_REASONS.find(r=>r.label===returnData.primaryReason)?.sub||[]).map(sub => (
                      <label key={sub} className={`reason-opt${returnData.subReason===sub?' selected':''}`}>
                        <input type="radio" name="returnSub" value={sub} checked={returnData.subReason===sub} onChange={()=>setReturnData({...returnData,subReason:sub})}/>
                        {sub}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group mb-14">
                <label className="form-label">{returnData.primaryReason==='Other'?'Describe your issue *':'Additional details (optional)'}</label>
                <textarea className="form-control" rows={3} value={returnData.customReason} onChange={e=>setReturnData({...returnData,customReason:e.target.value})} placeholder="Describe the issue in detail…"/>
              </div>

              <div className="form-group mb-14">
                <label className="form-label">Upload Images <span className="text-muted">(optional)</span></label>
                <div className="form-text mb-8">Photos of damage, wrong item etc. help speed up your request</div>
                <div className="image-url-list">
                  {returnData.images.map((img,i) => (
                    <div key={i} className="image-url-row">
                      <input type="url" className="form-control" placeholder="Paste image URL" value={img} onChange={e=>{const a=[...returnData.images];a[i]=e.target.value;setReturnData({...returnData,images:a});}}/>
                      <button className="image-url-del" onClick={()=>setReturnData({...returnData,images:returnData.images.filter((_,x)=>x!==i)})}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
                    </div>
                  ))}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={()=>setReturnData({...returnData,images:[...returnData.images,'']})}>+ Add Image URL</button>
              </div>

              <div className="alert alert-warning" style={{borderRadius:'var(--radius-md)',fontSize:'.76rem'}}>
                📋 Requests are reviewed within 24–48 hours. {returnData.type==='return'?'Refund credited within 5–7 business days after item pickup.':'Replacement dispatched after original item is picked up.'}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setReturnModal(null)}>Close</button>
              <button className="btn" style={{background:returnData.type==='replace'?'var(--fk-blue)':'var(--danger)',color:'#fff'}} onClick={handleReturnRequest} disabled={returnSubmitting}>
                {returnSubmitting?'Submitting…':returnData.type==='replace'?'🔄 Submit Replacement':'↩️ Submit Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ DETAIL REQUEST MODAL ═══════════════════ */}
      {detailModal && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:500}}>
            <div className="modal-header">
              <span className="modal-title">📄 Request Order Details</span>
              <button className="modal-close" onClick={()=>setDetailModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-text mb-14">Order #{detailModal.userOrderNumber ? `#${detailModal.userOrderNumber}` : `#${detailModal.orderId}`} · Requests are reviewed within 30 days and require admin approval.</div>
              {detailInfo && (
                <div className="detail-request-card mb-14">
                  <div className="detail-request-title">Latest Request Status: {detailInfo.status}</div>
                  <div className="detail-request-status">Reason: {detailInfo.reason}{detailInfo.other_reason?` — ${detailInfo.other_reason}`:''}</div>
                  {detailInfo.admin_note && <div className="detail-request-status" style={{marginTop:4}}>Admin note: {detailInfo.admin_note}</div>}
                </div>
              )}
              <div className="form-group mb-14">
                <label className="form-label">Reason *</label>
                <select className="form-control" value={detailReason} onChange={e=>setDetailReason(e.target.value)}>
                  <option value="">Select a reason</option>
                  {DETAIL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {detailReason==='Other' && (
                <div className="form-group">
                  <label className="form-label">Your reason *</label>
                  <textarea className="form-control" rows={3} value={detailOther} onChange={e=>setDetailOther(e.target.value)}/>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setDetailModal(null)}>Close</button>
              <button className="btn btn-blue" onClick={submitDetailRequest} disabled={detailSubmitting}>{detailSubmitting?'Submitting…':'Submit Request'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ DELETED ORDERS ═══════════════════ */}
      {deletedOrders.length > 0 && (
        <div className="my-orders-wrap" style={{ marginTop: 24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <h2 style={{ fontSize:'1rem', fontWeight:700, color:'var(--gray-700)', margin:0 }}>🗑️ Deleted Orders</h2>
            <span style={{ fontSize:'.72rem', background:'var(--gray-200)', color:'var(--gray-600)', borderRadius:12, padding:'2px 9px', fontWeight:600 }}>{deletedOrders.length}</span>
            <button className="btn btn-ghost btn-sm" style={{marginLeft:'auto'}} onClick={()=>setShowDeleted(s=>!s)}>
              {showDeleted ? '▲ Hide' : '▼ Show'}
            </button>
          </div>
          {showDeleted && deletedOrders.map(order => {
            const statusKey = order.statusBeforeDeletion || order.status;
            const si = OS[statusKey] || { label: statusKey, color:'#757575', icon:'📦' };
            const daysLeft = order.deletionExpiresAt ? Math.max(0, Math.ceil((new Date(order.deletionExpiresAt) - Date.now()) / (24*60*60*1000))) : 0;
            const firstItem = order.items?.[0];
            const product = firstItem ? products[firstItem.product_id||firstItem.productId] : null;
            const imgUrl = product?.images?.[0] || `https://placehold.co/72x72/eeeeee/9e9e9e?text=Del`;
            const adminApproved = order.canViewDetails;
            return (
              <div key={order.id} style={{
                background: adminApproved ? 'linear-gradient(135deg,#f3e5ff,#ede7f6)' : 'var(--gray-50)',
                border: adminApproved ? '1.5px solid #ce93d8' : '1.5px dashed var(--gray-300)',
                borderRadius: 14, marginBottom: 12, overflow: 'hidden',
                boxShadow: adminApproved ? '0 2px 12px rgba(103,58,183,0.10)' : 'none',
                opacity: adminApproved ? 1 : 0.82,
              }}>
                {/* Card Header */}
                <div style={{
                  background: adminApproved ? 'linear-gradient(135deg,#7b1fa2,#9c27b0)' : 'var(--gray-200)',
                  padding: '10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center'
                }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'.9rem', color: adminApproved ? '#fff' : 'var(--gray-700)' }}>
                      Order #{order.userOrderNumber || order.id}
                    </div>
                    <div style={{ fontSize:'.7rem', color: adminApproved ? 'rgba(255,255,255,0.78)' : 'var(--gray-400)', marginTop:2 }}>
                      {adminApproved
                        ? '✅ Admin restored access · details visible below'
                        : <>🗑️ Deleted {order.deletedAt ? new Date(order.deletedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : ''}
                           {daysLeft > 0 ? ` · ${daysLeft}d left to restore` : ' · Restoration expired'}</>
                      }
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'.65rem', color: adminApproved ? 'rgba(255,255,255,0.65)' : 'var(--gray-400)', marginBottom:3 }}>Last status</div>
                    <span className="status-pill" style={{ background:si.color, fontSize:'.7rem' }}>{si.icon} {si.label}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding:'14px 16px' }}>
                  <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom: adminApproved ? 12 : 0 }}>
                    <img src={imgUrl} alt="p" style={{ width:54, height:54, objectFit:'cover', borderRadius:10, border:'2px solid', borderColor: adminApproved ? '#ce93d8' : 'var(--gray-200)' }} onError={e=>{e.target.src='https://placehold.co/54x54/eee/999?text=Img';}}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:'.85rem', color:'var(--gray-800)' }}>{product?.name||(firstItem?.name||'Product')}</div>
                      <div style={{ fontSize:'.76rem', color:'var(--gray-500)', marginTop:2 }}>
                        ₹{parseFloat(order.totalAmount||0).toFixed(2)} · Qty {firstItem?.quantity||1}
                        {order.paymentMethod && <> · {order.paymentMethod.toUpperCase()}</>}
                      </div>
                      {order.createdAt && (
                        <div style={{ fontSize:'.7rem', color:'var(--gray-400)', marginTop:2 }}>
                          Placed {new Date(order.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Admin-restored detail strip */}
                  {adminApproved && (
                    <div style={{
                      background:'rgba(255,255,255,0.65)', borderRadius:10, padding:'10px 14px',
                      border:'1px solid rgba(156,39,176,0.18)', display:'flex', flexDirection:'column', gap:5
                    }}>
                      <div style={{ fontSize:'.72rem', fontWeight:700, color:'#6a1b9a', marginBottom:2, letterSpacing:'.03em' }}>
                        🔓 Restored Order Details
                      </div>
                      {order.shippingAddress && (() => {
                        const a = typeof order.shippingAddress === 'string'
                          ? (() => { try { return JSON.parse(order.shippingAddress); } catch { return {}; } })()
                          : (order.shippingAddress || {});
                        const line = [a.street, a.city, a.state].filter(Boolean).join(', ') + (a.zipCode ? ` – ${a.zipCode}` : '');
                        return line ? (
                          <div style={{ fontSize:'.76rem', color:'var(--gray-600)' }}>📍 {line}{a.phone ? ` · 📞 ${a.phone}` : ''}</div>
                        ) : null;
                      })()}
                      {order.trackingNumber && (
                        <div style={{ fontSize:'.76rem', color:'var(--gray-600)' }}>🚚 {order.courierName} · #{order.trackingNumber}</div>
                      )}
                      <div style={{ fontSize:'.72rem', color:'#9e9e9e', marginTop:3, fontStyle:'italic' }}>
                        This order was deleted. Admin approved access to your order history.
                      </div>
                    </div>
                  )}

                  {/* Restore request button or status */}
                  {!adminApproved && (
                    <div style={{ marginTop:10 }}>
                      {daysLeft > 0 && !order.restorationRequested && (
                        <button className="btn btn-sm" style={{ background:'#673ab7', color:'#fff', fontSize:'.75rem' }}
                          onClick={() => { setRestoreModal(order); setRestoreReason(''); }}>
                          🔄 Request Restoration
                        </button>
                      )}
                      {order.restorationRequested && (
                        <div style={{
                          display:'inline-flex', alignItems:'center', gap:6, fontSize:'.75rem',
                          background: order.restorationStatus==='rejected' ? '#fff3e0' : '#f3e5f5',
                          color: order.restorationStatus==='rejected' ? '#e65100' : '#6a1b9a',
                          borderRadius:8, padding:'5px 10px', border:'1px solid',
                          borderColor: order.restorationStatus==='rejected' ? '#ffcc80' : '#ce93d8'
                        }}>
                          {order.restorationStatus==='pending' ? '⏳' : order.restorationStatus==='rejected' ? '❌' : '✅'}
                          &nbsp;Restoration {order.restorationStatus==='pending'?'pending admin review':order.restorationStatus}
                          {order.restorationStatus==='rejected'&&order.restorationRejectionReason?` — ${order.restorationRejectionReason}`:''}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════ RESTORE REQUEST MODAL ═══════════════════ */}
      {restoreModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header" style={{ background:'linear-gradient(135deg,#5e35b1,#7b1fa2)', borderRadius:'var(--radius-lg) var(--radius-lg) 0 0' }}>
              <div>
                <div className="modal-title" style={{ color:'#fff' }}>🔄 Request Order Restoration</div>
                <div style={{ fontSize:'.72rem', color:'rgba(255,255,255,.8)', marginTop:3 }}>Order #{restoreModal.userOrderNumber || restoreModal.id}</div>
              </div>
              <button className="modal-close" style={{ background:'rgba(255,255,255,.15)', color:'#fff' }} onClick={()=>setRestoreModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background:'var(--gray-50)', borderRadius:10, padding:'12px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'.8rem', fontWeight:600, color:'var(--gray-700)' }}>Last status before deletion</div>
                  <div style={{ marginTop:4 }}>
                    {(() => { const si2 = OS[restoreModal.statusBeforeDeletion||restoreModal.status]||{label:restoreModal.status,color:'#757575',icon:'📦'}; return <span className="status-pill" style={{ background:si2.color }}>{si2.icon} {si2.label}</span>; })()}
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Why do you need to restore this order? *</label>
                <textarea className="form-control" rows={4} value={restoreReason} onChange={e=>setRestoreReason(e.target.value)} placeholder="Please provide a detailed reason (min 10 characters)…"/>
                <div className="form-text">Admin will review your request and restore the order if approved.</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setRestoreModal(null)}>Cancel</button>
              <button className="btn" style={{ background:'#673ab7', color:'#fff' }} onClick={handleRestoreRequest} disabled={restoreSubmitting}>
                {restoreSubmitting ? 'Submitting…' : '🔄 Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BackToTop />
    </div>
  );
}