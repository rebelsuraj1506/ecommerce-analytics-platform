import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import './pages.css';

function Products({ token, userRole }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts]           = useState([]);
  const [showForm, setShowForm]           = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [orderModal, setOrderModal]       = useState(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderLoading, setOrderLoading]   = useState(false);
  const [orderSuccess, setOrderSuccess]   = useState(null);
  const [shippingAddress, setShippingAddress] = useState({street:'',city:'',state:'',zipCode:'',phone:''});
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddr, setSelectedSavedAddr] = useState(null);
  const [saveAddrChecked, setSaveAddrChecked] = useState(false);
  const [formData, setFormData] = useState({name:'',description:'',price:'',inventory:'',category:'electronics',images:[]});
  const [loading, setLoading]             = useState(true);
  const [searchQ, setSearchQ]             = useState(searchParams.get('search')||'');
  const [catFilter, setCatFilter]         = useState('all');
  const [toast, setToast]                 = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(()=>{ setSearchQ(searchParams.get('search')||''); },[searchParams]);

  const handleSearchChange = e => {
    const val = e.target.value; setSearchQ(val);
    val.trim() ? setSearchParams({search:val}) : setSearchParams({});
  };

  const showToast = (msg,type='info') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const isAdmin = userRole==='admin';

  const getProductImage = (name,category) => {
    const seed = Math.abs((name||category||'p').split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a;},0));
    return `https://picsum.photos/seed/${seed}/400/400`;
  };

  const fetchProducts = () => {
    setLoading(true);
    fetch('http://localhost:8000/api/products?limit=100')
      .then(r=>r.json()).then(d=>{setProducts(d.data?.products||[]); setLoading(false);}).catch(()=>setLoading(false));
  };
  useEffect(()=>{ fetchProducts(); },[]);

  const fetchSavedAddresses = async () => {
    if(!token) return;
    try { const r=await fetch('http://localhost:8000/api/users/addresses',{headers:{Authorization:`Bearer ${token}`}}); const d=await r.json(); if(r.ok) setSavedAddresses(d.data?.addresses||[]); } catch(e){console.error(e);}
  };
  useEffect(()=>{ if(userRole!=='admin') fetchSavedAddresses(); },[token]);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      let img = formData.images[0];
      if(!img||img.includes('placeholder')) img = getProductImage(formData.name,formData.category);
      const r = await fetch('http://localhost:8000/api/products',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...formData,price:parseFloat(formData.price),inventory:parseInt(formData.inventory),images:[img]})});
      if(r.ok){setShowForm(false); setFormData({name:'',description:'',price:'',inventory:'',category:'electronics',images:[]}); fetchProducts(); showToast('Product created','success');}
      else{const d=await r.json(); showToast(d.message||'Failed','error');}
    } catch(e){showToast(e.message,'error');}
  };

  const deleteProduct = async id => {
    try { const r=await fetch(`http://localhost:8000/api/products/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}}); if(r.ok){fetchProducts(); showToast('Product deleted','success');}else showToast('Failed','error'); } catch(e){showToast(e.message,'error');}
    setDeleteConfirm(null);
  };

  const saveEdit = async () => {
    try { const r=await fetch(`http://localhost:8000/api/products/${editingProduct._id}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...editingProduct,price:parseFloat(editingProduct.price),inventory:parseInt(editingProduct.inventory)})}); if(r.ok){setEditingProduct(null); fetchProducts(); showToast('Product updated','success');}else showToast('Save failed','error'); } catch(e){showToast(e.message,'error');}
  };

  const saveNewAddressIfChecked = async () => {
    if(!saveAddrChecked||!shippingAddress.street) return;
    try { await fetch('http://localhost:8000/api/users/addresses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...shippingAddress,label:shippingAddress.city+' Address'})}); await fetchSavedAddresses(); } catch(e){console.error(e);}
  };

  const handlePlaceOrder = async () => {
    if(!shippingAddress.street||!shippingAddress.city||!shippingAddress.state||!shippingAddress.zipCode||!shippingAddress.phone){showToast('Fill in all address fields','error'); return;}
    setOrderLoading(true);
    if(saveAddrChecked) await saveNewAddressIfChecked();
    try {
      const r=await fetch('http://localhost:8000/api/orders',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({items:[{productId:orderModal._id,name:orderModal.name,quantity:orderQuantity,price:orderModal.price}],paymentMethod,shippingAddress})});
      const d=await r.json();
      if(d.success){setOrderSuccess(d.data.order); fetchProducts();}
      else showToast('Error: '+(d.message||'Failed to place order'),'error');
    } catch(e){showToast(e.message,'error');} finally{setOrderLoading(false);}
  };

  const closeOrderModal = () => {
    setOrderModal(null); setOrderSuccess(null); setOrderQuantity(1);
    setShippingAddress({street:'',city:'',state:'',zipCode:'',phone:''});
    setPaymentMethod('cod'); setSelectedSavedAddr(null); setSaveAddrChecked(false);
  };

  const CATS = ['all',...new Set(products.map(p=>p.category).filter(Boolean))];
  const filtered = products.filter(p => {
    const matchCat = catFilter==='all'||p.category===catFilter;
    const q = searchQ.toLowerCase();
    const matchQ = !q||p.name?.toLowerCase().includes(q)||p.description?.toLowerCase().includes(q)||p.category?.toLowerCase().includes(q)||p.brand?.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  const PAY_OPTS = [{value:'cod',label:'💵 Cash on Delivery'},{value:'upi',label:'📱 UPI'},{value:'card',label:'💳 Card'},{value:'netbanking',label:'🏦 Net Banking'}];

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon">{isAdmin?'📦':'🛍️'}</div>
          <h1 className="page-title">{isAdmin?'Products Catalog':'Shop'}</h1>
          <span className="page-count">{filtered.length}</span>
        </div>
        {isAdmin && (
          <button className={`btn ${showForm?'btn-ghost':'btn-primary'}`} onClick={()=>setShowForm(!showForm)}>
            {showForm?'✕ Cancel':'+ Add Product'}
          </button>
        )}
      </div>

      <div className="page-body">
        {/* Add Product Form */}
        {isAdmin && showForm && (
          <div className="card mb-20">
            <div className="card-header"><span className="card-title">➕ Add New Product</span></div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="grid-2 mb-12">
                  <div className="form-group"><label className="form-label">Product Name *</label><input type="text" className="form-control" placeholder="e.g. iPhone 15 Pro" value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})} required/></div>
                  <div className="form-group"><label className="form-label">Category</label>
                    <select className="form-control" value={formData.category} onChange={e=>setFormData({...formData,category:e.target.value})}>
                      {['electronics','clothing','books','home','sports','toys'].map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Price (₹) *</label><input type="number" step="0.01" className="form-control" placeholder="0.00" value={formData.price} onChange={e=>setFormData({...formData,price:e.target.value})} required/></div>
                  <div className="form-group"><label className="form-label">Stock Qty *</label><input type="number" className="form-control" placeholder="0" value={formData.inventory} onChange={e=>setFormData({...formData,inventory:e.target.value})} required/></div>
                </div>
                <div className="form-group mb-12"><label className="form-label">Description *</label><textarea className="form-control" placeholder="Describe the product…" value={formData.description} onChange={e=>setFormData({...formData,description:e.target.value})} required/></div>
                <div className="form-group mb-16"><label className="form-label">Image URL <span className="text-muted">(auto-generated if blank)</span></label><input type="url" className="form-control" placeholder="https://…" value={formData.images[0]||''} onChange={e=>setFormData({...formData,images:[e.target.value]})}/></div>
                <button type="submit" className="btn btn-primary">Add Product</button>
              </form>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="toolbar-card mb-16">
          <div className="search-bar-pro" style={{flex:1,minWidth:200}}>
            <span className="search-icon-wrap">🔍</span>
            <input type="text" placeholder="Search products…" value={searchQ} onChange={handleSearchChange}/>
            {searchQ && <button className="search-clear-btn" onClick={()=>{setSearchQ(''); setSearchParams({});}}>✕</button>}
          </div>
          <div className="filter-tabs">
            {CATS.map(cat=>(
              <button key={cat} className={`filter-tab${catFilter===cat?' active':''}`} onClick={()=>setCatFilter(cat)}>
                {cat==='all'?'All':cat.charAt(0).toUpperCase()+cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading && <div className="spinner-wrap"><div className="spinner"/><span className="text-muted">Loading products…</span></div>}
        {!loading && filtered.length===0 && (
          <div className="card"><div className="empty-state"><div className="empty-icon">📦</div><div className="empty-title">No products found</div><div className="empty-desc">{isAdmin?'Click "+ Add Product" to get started':'Try adjusting your search or filter'}</div></div></div>
        )}
        {!loading && filtered.length>0 && (
          <div className="product-grid">
            {filtered.map(product=>{
              const isEditing = editingProduct?._id===product._id;
              const img = product.images?.[0]||getProductImage(product.name,product.category);
              const inv = Number(product.inventory)||0;
              const inStock = inv>0;
              return (
                <div key={product._id} className="product-card">
                  <div className="product-card-img">
                    <img src={img} alt={product.name} onError={e=>{e.target.src='https://placehold.co/400x400/f3f4f6/9ca3af?text=📦';}}/>
                    <div className="product-stock-badge" style={{background:inStock?(inv>20?'var(--success)':'var(--warning)'):'var(--gray-500)'}}>
                      {inStock?`${inv} in stock`:'Sold out'}
                    </div>
                  </div>
                  <div className="product-card-body">
                    {isEditing ? (
                      <>
                        <div className="form-group mb-8"><select className="form-control" style={{fontSize:'.8rem'}} value={editingProduct.category} onChange={e=>setEditingProduct({...editingProduct,category:e.target.value})}>{['electronics','clothing','books','home','sports','toys'].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                        <div className="form-group mb-8"><input type="text" className="form-control" style={{fontSize:'.85rem'}} value={editingProduct.name||''} onChange={e=>setEditingProduct({...editingProduct,name:e.target.value})} placeholder="Product name"/></div>
                        <div className="form-group mb-8"><textarea rows={2} className="form-control" style={{fontSize:'.8rem',minHeight:56}} value={editingProduct.description||''} onChange={e=>setEditingProduct({...editingProduct,description:e.target.value})} placeholder="Description"/></div>
                        <div className="grid-2 mb-8">
                          <input type="number" step="0.01" className="form-control" style={{fontSize:'.85rem'}} value={editingProduct.price??''} onChange={e=>setEditingProduct({...editingProduct,price:e.target.value})} placeholder="Price"/>
                          <input type="number" min="0" className="form-control" style={{fontSize:'.85rem'}} value={editingProduct.inventory??''} onChange={e=>setEditingProduct({...editingProduct,inventory:e.target.value})} placeholder="Stock"/>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="product-category">{product.category}</div>
                        <div className="product-name">{product.name}</div>
                        <div className="product-desc">{product.description}</div>
                        {product.rating?.count>0 && (
                          <div className="flex-center gap-6 mb-8">
                            <span className="rating-pill">★ {(product.rating.average||0).toFixed(1)}</span>
                            <span className="rating-count">{product.rating.count} reviews</span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="product-card-footer">
                      {!isEditing && <div className="product-price">₹{product.price?.toFixed(2)}</div>}
                      {!isAdmin && (
                        <button className="btn-buy-now" disabled={!inStock} onClick={()=>inStock&&setOrderModal(product)}>
                          {inStock?'🛒 Buy Now':'Out of Stock'}
                        </button>
                      )}
                      {isAdmin && (
                        <div className="flex-center gap-8">
                          {isEditing ? (
                            <><button className="btn btn-success btn-sm w-full" onClick={saveEdit}>Save</button><button className="btn btn-ghost btn-sm w-full" onClick={()=>setEditingProduct(null)}>Cancel</button></>
                          ) : (
                            <><button className="btn btn-blue btn-sm w-full" onClick={()=>setEditingProduct(product)}>✏️ Edit</button><button className="btn btn-icon btn-danger" onClick={()=>setDeleteConfirm(product)} title="Delete">🗑️</button></>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Modal */}
      {orderModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&closeOrderModal()}>
          <div className="modal">
            {orderSuccess ? (
              <div className="success-screen">
                <div className="success-icon">✅</div>
                <h2 className="success-title">Order Placed!</h2>
                <p className="success-sub">Your order #{orderSuccess.userOrderNumber||orderSuccess.id} has been confirmed.</p>
                <div className="order-summary-box mb-20" style={{textAlign:'left'}}>
                  <div className="order-summary-row"><span>Order ID</span><span className="text-mono font-bold">#{orderSuccess.userOrderNumber||orderSuccess.id}</span></div>
                  <div className="order-summary-row"><span>Amount</span><span className="font-bold">₹{parseFloat(orderSuccess.totalAmount).toFixed(2)}</span></div>
                  <div className="order-summary-row"><span>Status</span><span style={{textTransform:'capitalize'}}>{orderSuccess.status}</span></div>
                  <div className="order-summary-row"><span>Payment</span><span>{orderSuccess.paymentMethod?.toUpperCase()}</span></div>
                </div>
                <p className="text-muted mb-20" style={{fontSize:'.83rem'}}>Track your order in the "My Orders" page.</p>
                <button className="btn btn-success btn-lg" onClick={closeOrderModal}>Continue Shopping</button>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <h3 className="modal-title">Place Order</h3>
                  <button className="modal-close" onClick={closeOrderModal}>✕</button>
                </div>
                <div className="modal-body">
                  {/* Product preview */}
                  <div className="product-preview-card">
                    <img src={orderModal.images?.[0]||getProductImage(orderModal.name,orderModal.category)} alt={orderModal.name}
                      className="product-preview-img" onError={e=>{e.target.src='https://placehold.co/72x72/f3f4f6/9ca3af?text=📦';}}/>
                    <div>
                      <div className="product-preview-name">{orderModal.name}</div>
                      <div className="product-preview-price">₹{orderModal.price?.toFixed(2)}</div>
                      <div className="product-preview-stock">{Number(orderModal.inventory)||0} available</div>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="form-group mb-20">
                    <label className="form-label">Quantity</label>
                    <div className="flex-center gap-12">
                      <div className="qty-stepper">
                        <button className="qty-btn" onClick={()=>setOrderQuantity(Math.max(1,orderQuantity-1))}>−</button>
                        <input type="number" className="qty-input" value={orderQuantity} min={1} max={Number(orderModal.inventory)||1}
                          onChange={e=>setOrderQuantity(Math.min(Number(orderModal.inventory)||1,Math.max(1,parseInt(e.target.value)||1)))}/>
                        <button className="qty-btn" onClick={()=>setOrderQuantity(Math.min(Number(orderModal.inventory)||1,orderQuantity+1))}>+</button>
                      </div>
                      <span className="qty-total">Total: ₹{(orderModal.price*orderQuantity).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="form-group mb-20">
                    <label className="form-label">Payment Method</label>
                    <div className="payment-grid">
                      {PAY_OPTS.map(pm=>(
                        <div key={pm.value} className={`payment-option${paymentMethod===pm.value?' selected':''}`} onClick={()=>setPaymentMethod(pm.value)}>{pm.label}</div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping */}
                  <div className="form-group mb-20">
                    <label className="form-label">📍 Shipping Address</label>
                    {savedAddresses.length>0 && (
                      <div className="mb-12">
                        <div className="form-section-label">Saved Addresses</div>
                        <div style={{display:'flex',flexDirection:'column',gap:7}}>
                          {savedAddresses.map(addr=>(
                            <div key={addr.id}
                              className={`addr-radio-card${selectedSavedAddr===addr.id?' selected':''}`}
                              onClick={()=>{ setSelectedSavedAddr(addr.id); setShippingAddress({street:addr.street||'',city:addr.city||'',state:addr.state||'',zipCode:addr.zipCode||addr.zip_code||'',phone:addr.phone||''}); setSaveAddrChecked(false); }}>
                              <div className="addr-radio-dot">{selectedSavedAddr===addr.id&&<div className="addr-radio-dot-inner"/>}</div>
                              <div style={{flex:1}}>
                                <div className="addr-radio-label">{addr.label||addr.city} {addr.isDefault&&<span className="addr-default-tag" style={{position:'static',fontSize:'.58rem',padding:'1px 6px'}}>Default</span>}</div>
                                <div className="addr-radio-detail">{[addr.street,addr.city,addr.state,addr.zipCode||addr.zip_code].filter(Boolean).join(', ')}{addr.phone&&` · ${addr.phone}`}</div>
                              </div>
                            </div>
                          ))}
                          <button type="button" className="new-addr-btn" onClick={()=>{setSelectedSavedAddr(null); setShippingAddress({street:'',city:'',state:'',zipCode:'',phone:''});}}>+ Enter a new address</button>
                        </div>
                        {selectedSavedAddr && <div className="form-text" style={{marginTop:8}}>✅ Delivering to selected address above</div>}
                      </div>
                    )}
                    {!selectedSavedAddr && (
                      <div style={{display:'flex',flexDirection:'column',gap:10}}>
                        <input type="text" className="form-control" placeholder="Street Address *" value={shippingAddress.street} onChange={e=>setShippingAddress({...shippingAddress,street:e.target.value})}/>
                        <div className="grid-2">
                          <input type="text" className="form-control" placeholder="City *" value={shippingAddress.city} onChange={e=>setShippingAddress({...shippingAddress,city:e.target.value})}/>
                          <input type="text" className="form-control" placeholder="State *" value={shippingAddress.state} onChange={e=>setShippingAddress({...shippingAddress,state:e.target.value})}/>
                        </div>
                        <div className="grid-2">
                          <input type="text" className="form-control" placeholder="PIN Code *" value={shippingAddress.zipCode} onChange={e=>setShippingAddress({...shippingAddress,zipCode:e.target.value})}/>
                          <input type="tel" className="form-control" placeholder="Phone *" value={shippingAddress.phone} onChange={e=>setShippingAddress({...shippingAddress,phone:e.target.value})}/>
                        </div>
                        <div className="form-checkbox">
                          <input type="checkbox" id="saveAddr" checked={saveAddrChecked} onChange={e=>setSaveAddrChecked(e.target.checked)}/>
                          <label htmlFor="saveAddr">Save this address to my profile</label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="order-summary-box">
                    <div className="order-summary-row"><span>Price ({orderQuantity} item{orderQuantity>1?'s':''})</span><span>₹{(orderModal.price*orderQuantity).toFixed(2)}</span></div>
                    <div className="order-summary-row"><span>Delivery</span><span className="free-text">FREE</span></div>
                    <div className="order-summary-row total"><span>Total Amount</span><span>₹{(orderModal.price*orderQuantity).toFixed(2)}</span></div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={closeOrderModal}>Cancel</button>
                  <button className="btn btn-primary btn-lg" onClick={handlePlaceOrder} disabled={orderLoading} style={{minWidth:200}}>
                    {orderLoading?'Placing Order…':`Place Order · ₹${(orderModal.price*orderQuantity).toFixed(2)}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header">
              <span className="modal-title">Delete Product?</span>
              <button className="modal-close" onClick={()=>setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body" style={{textAlign:'center',padding:'32px 24px'}}>
              <div className="confirm-icon">🗑️</div>
              <div className="confirm-title">"{deleteConfirm.name}"</div>
              <div className="confirm-desc">This action cannot be undone. The product will be permanently removed.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>deleteProduct(deleteConfirm._id)}>Delete Product</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast-fixed toast-${toast.type}`}>{toast.type==='success'?'✅':toast.type==='error'?'❌':'ℹ️'} {toast.msg}</div>}
    </div>
  );
}
export default Products;