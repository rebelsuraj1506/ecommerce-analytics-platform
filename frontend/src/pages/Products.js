import React, { useState, useEffect } from 'react';
import './pages.css';

function Products({ token, userRole }) {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [orderModal, setOrderModal] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [shippingAddress, setShippingAddress] = useState({ street:'', city:'', state:'', zipCode:'', phone:'' });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [formData, setFormData] = useState({ name:'', description:'', price:'', inventory:'', category:'electronics', images:[] });
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const isAdmin = userRole === 'admin';

  const getProductImage = (name, category) => {
    const seed = Math.abs((name || category || 'product').split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0));
    return `https://picsum.photos/seed/${seed}/400/400`;
  };

  const fetchProducts = () => {
    setLoading(true);
    fetch('http://localhost:8002/api/products?limit=100')
      .then(r => r.json())
      .then(d => { setProducts(d.data?.products || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imageUrl = formData.images[0];
      if (!imageUrl || imageUrl.includes('placeholder')) imageUrl = getProductImage(formData.name, formData.category);
      const res = await fetch('http://localhost:8002/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, price: parseFloat(formData.price), inventory: parseInt(formData.inventory), images: [imageUrl] })
      });
      if (res.ok) { setShowForm(false); setFormData({ name:'', description:'', price:'', inventory:'', category:'electronics', images:[] }); fetchProducts(); showToast('Product created successfully', 'success'); }
      else { const d = await res.json(); showToast(d.message || 'Failed to create product', 'error'); }
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  };

  const deleteProduct = async (id) => {
    try {
      const res = await fetch(`http://localhost:8002/api/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { fetchProducts(); showToast('Product deleted', 'success'); }
      else showToast('Failed to delete', 'error');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    setDeleteConfirm(null);
  };

  const saveEdit = async () => {
    try {
      const res = await fetch(`http://localhost:8002/api/products/${editingProduct._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...editingProduct, price: parseFloat(editingProduct.price), inventory: parseInt(editingProduct.inventory) })
      });
      if (res.ok) { setEditingProduct(null); fetchProducts(); showToast('Product updated', 'success'); }
      else showToast('Save failed', 'error');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  };

  const handlePlaceOrder = async () => {
    if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zipCode || !shippingAddress.phone) {
      showToast('Please fill in all shipping address fields', 'error'); return;
    }
    setOrderLoading(true);
    try {
      const res = await fetch('http://localhost:8003/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: [{ productId: orderModal._id, name: orderModal.name, quantity: orderQuantity, price: orderModal.price }], paymentMethod, shippingAddress })
      });
      const data = await res.json();
      if (data.success) { setOrderSuccess(data.data.order); fetchProducts(); }
      else { showToast('Error: ' + (data.message || 'Failed to place order'), 'error'); }
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setOrderLoading(false); }
  };

  const closeOrderModal = () => {
    setOrderModal(null); setOrderSuccess(null); setOrderQuantity(1);
    setShippingAddress({ street:'', city:'', state:'', zipCode:'', phone:'' });
    setPaymentMethod('cod');
  };

  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = products.filter(p => {
    const matchCat = catFilter === 'all' || p.category === catFilter;
    const matchSearch = !searchQ || p.name?.toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchSearch;
  });

  const paymentOptions = [
    { value: 'cod', label: '💵 Cash on Delivery' },
    { value: 'upi', label: '📱 UPI' },
    { value: 'card', label: '💳 Card' },
    { value: 'netbanking', label: '🏦 Net Banking' },
  ];

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <span style={{ fontSize: '1.4rem' }}>{isAdmin ? '📦' : '🛍️'}</span>
          <h1 className="page-title">{isAdmin ? 'Products Catalog' : 'Shop Products'}</h1>
          <span className="page-count">{filtered.length}</span>
        </div>
        <div className="flex-center gap-8">
          {isAdmin && (
            <button
              className={`btn ${showForm ? 'btn-ghost' : 'btn-primary'}`}
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? '✕ Cancel' : '+ Add Product'}
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Add Product Form */}
        {isAdmin && showForm && (
          <div className="card mb-20">
            <div className="card-header">
              <span className="card-title">Add New Product</span>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="grid-2 mb-12">
                  <div className="form-group">
                    <label className="form-label">Product Name *</label>
                    <input type="text" className="form-control" placeholder="e.g. iPhone 15 Pro" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-control" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      <option value="electronics">Electronics</option>
                      <option value="clothing">Clothing</option>
                      <option value="books">Books</option>
                      <option value="home">Home & Kitchen</option>
                      <option value="sports">Sports</option>
                      <option value="toys">Toys</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price (₹) *</label>
                    <input type="number" step="0.01" className="form-control" placeholder="0.00" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock Quantity *</label>
                    <input type="number" className="form-control" placeholder="0" value={formData.inventory} onChange={e => setFormData({...formData, inventory: e.target.value})} required />
                  </div>
                </div>
                <div className="form-group mb-12">
                  <label className="form-label">Description *</label>
                  <textarea className="form-control" placeholder="Describe the product..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
                </div>
                <div className="form-group mb-16">
                  <label className="form-label">Image URL <span className="text-muted">(optional — auto-generated if blank)</span></label>
                  <input type="url" className="form-control" placeholder="https://..." value={formData.images[0] || ''} onChange={e => setFormData({...formData, images: [e.target.value]})} />
                </div>
                <button type="submit" className="btn btn-primary">Add Product</button>
              </form>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card mb-16">
          <div className="card-body" style={{ padding: '14px 20px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: '1rem' }}>🔍</span>
              <input
                type="text"
                className="form-control"
                placeholder="Search products…"
                style={{ paddingLeft: 32 }}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
            </div>
            <div className="filter-tabs">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`filter-tab${catFilter === cat ? ' active' : ''}`}
                  onClick={() => setCatFilter(cat)}
                >
                  {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="spinner-wrap">
            <div className="spinner" />
            <span className="text-muted">Loading products…</span>
          </div>
        )}

        {/* Product Grid */}
        {!loading && filtered.length > 0 && (
          <div className="product-grid">
            {filtered.map(product => {
              const isEditing = editingProduct?._id === product._id;
              const imageUrl = product.images?.[0] || getProductImage(product.name, product.category);
              const inventory = Number(product.inventory) || 0;
              const inStock = inventory > 0;

              return (
                <div key={product._id} className="product-card">
                  <div className="product-card-img">
                    <img
                      src={imageUrl} alt={product.name}
                      onError={e => { e.target.src = `https://placehold.co/400x400/eeeeee/9e9e9e?text=Product`; }}
                    />
                    <div
                      className="product-stock-badge"
                      style={{ background: inStock ? (inventory > 20 ? 'var(--brand-success)' : 'var(--brand-warning)') : 'var(--gray-600)' }}
                    >
                      {inStock ? `${inventory} in stock` : 'Sold out'}
                    </div>
                  </div>

                  <div className="product-card-body">
                    {isEditing ? (
                      <>
                        <div className="form-group mb-8">
                          <select className="form-control" style={{ fontSize: '0.8rem' }} value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}>
                            <option value="electronics">Electronics</option>
                            <option value="clothing">Clothing</option>
                            <option value="books">Books</option>
                            <option value="home">Home & Kitchen</option>
                            <option value="sports">Sports</option>
                            <option value="toys">Toys</option>
                          </select>
                        </div>
                        <div className="form-group mb-8">
                          <input type="text" className="form-control" style={{ fontSize: '0.85rem' }} value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="Product name" />
                        </div>
                        <div className="form-group mb-8">
                          <textarea rows={2} className="form-control" style={{ fontSize: '0.8rem', minHeight: 60 }} value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="Description" />
                        </div>
                        <div className="grid-2 mb-8">
                          <input type="number" step="0.01" className="form-control" style={{ fontSize: '0.85rem' }} value={editingProduct.price ?? ''} onChange={e => setEditingProduct({...editingProduct, price: e.target.value})} placeholder="Price" />
                          <input type="number" min="0" className="form-control" style={{ fontSize: '0.85rem' }} value={editingProduct.inventory ?? ''} onChange={e => setEditingProduct({...editingProduct, inventory: e.target.value})} placeholder="Stock" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="product-category">{product.category}</div>
                        <div className="product-name">{product.name}</div>
                        <div className="product-desc">{product.description}</div>
                        {product.rating?.count > 0 && (
                          <div className="flex-center gap-6 mb-8">
                            <span className="rating-pill">★ {(product.rating.average || 0).toFixed(1)}</span>
                            <span className="rating-count">{product.rating.count} reviews</span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="product-card-footer">
                      {!isEditing && <div className="product-price">₹{product.price?.toFixed(2)}</div>}

                      {!isAdmin && (
                        <button
                          className="btn btn-block"
                          disabled={!inStock}
                          onClick={() => inStock && setOrderModal(product)}
                          style={{
                            background: inStock ? 'linear-gradient(135deg, var(--brand-accent) 0%, #ff9f00 100%)' : 'var(--gray-200)',
                            color: inStock ? '#fff' : 'var(--gray-500)',
                            fontWeight: 700, fontSize: '0.88rem',
                            cursor: inStock ? 'pointer' : 'not-allowed',
                            border: 'none'
                          }}
                        >
                          {inStock ? '🛒 Buy Now' : 'Out of Stock'}
                        </button>
                      )}

                      {isAdmin && (
                        <div className="flex-center gap-8">
                          {isEditing ? (
                            <>
                              <button className="btn btn-success btn-sm w-full" onClick={saveEdit}>Save</button>
                              <button className="btn btn-ghost btn-sm w-full" onClick={() => setEditingProduct(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="btn btn-blue btn-sm w-full" onClick={() => setEditingProduct(product)}>✏️ Edit</button>
                              <button className="btn btn-danger btn-sm w-full" onClick={() => setDeleteConfirm(product)}>🗑️</button>
                            </>
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

        {!loading && filtered.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">No products found</div>
              <div className="empty-desc">
                {isAdmin ? 'Click "+ Add Product" to get started' : 'Try adjusting your search or category filter'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order Modal */}
      {orderModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeOrderModal()}>
          <div className="modal">
            {orderSuccess ? (
              <div className="success-screen">
                <div className="success-icon">✅</div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--brand-success)', marginBottom: 8 }}>Order Placed!</h2>
                <p className="text-muted mb-20">Your order #{orderSuccess.id} has been confirmed.</p>
                <div className="order-summary-box mb-20" style={{ textAlign: 'left' }}>
                  <div className="order-summary-row"><span>Order ID</span><span className="text-mono font-bold">#{orderSuccess.id}</span></div>
                  <div className="order-summary-row"><span>Amount</span><span className="font-600">₹{parseFloat(orderSuccess.totalAmount).toFixed(2)}</span></div>
                  <div className="order-summary-row"><span>Status</span><span className="font-600" style={{ textTransform: 'capitalize' }}>{orderSuccess.status}</span></div>
                  <div className="order-summary-row"><span>Payment</span><span className="font-600">{orderSuccess.paymentMethod?.toUpperCase()}</span></div>
                </div>
                <p className="text-muted mb-20" style={{ fontSize: '0.83rem' }}>Track your order in "My Orders" page.</p>
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
                  <div className="flex-center gap-12 mb-20" style={{ background: 'var(--gray-50)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)' }}>
                    <img
                      src={orderModal.images?.[0] || getProductImage(orderModal.name, orderModal.category)} alt={orderModal.name}
                      style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
                      onError={e => { e.target.src = 'https://placehold.co/72x72/eeeeee/9e9e9e?text=Img'; }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.93rem', marginBottom: 3 }}>{orderModal.name}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-success)' }}>₹{orderModal.price?.toFixed(2)}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{(Number(orderModal.inventory) || 0)} available</div>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="form-group mb-20">
                    <label className="form-label">Quantity</label>
                    <div className="flex-center gap-12">
                      <div className="qty-stepper">
                        <button className="qty-btn" onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}>−</button>
                        <input type="number" className="qty-input" value={orderQuantity} min={1} max={Number(orderModal.inventory) || 1}
                          onChange={e => setOrderQuantity(Math.min(Number(orderModal.inventory) || 1, Math.max(1, parseInt(e.target.value) || 1)))} />
                        <button className="qty-btn" onClick={() => setOrderQuantity(Math.min(Number(orderModal.inventory) || 1, orderQuantity + 1))}>+</button>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--gray-900)' }}>
                        Total: ₹{(orderModal.price * orderQuantity).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="form-group mb-20">
                    <label className="form-label">Payment Method</label>
                    <div className="payment-grid">
                      {paymentOptions.map(pm => (
                        <div key={pm.value} className={`payment-option${paymentMethod === pm.value ? ' selected' : ''}`} onClick={() => setPaymentMethod(pm.value)}>
                          {pm.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping */}
                  <div className="form-group mb-20">
                    <label className="form-label">📍 Shipping Address</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <input type="text" className="form-control" placeholder="Street Address *" value={shippingAddress.street} onChange={e => setShippingAddress({...shippingAddress, street: e.target.value})} required />
                      <div className="grid-2">
                        <input type="text" className="form-control" placeholder="City *" value={shippingAddress.city} onChange={e => setShippingAddress({...shippingAddress, city: e.target.value})} required />
                        <input type="text" className="form-control" placeholder="State *" value={shippingAddress.state} onChange={e => setShippingAddress({...shippingAddress, state: e.target.value})} required />
                      </div>
                      <div className="grid-2">
                        <input type="text" className="form-control" placeholder="PIN Code *" value={shippingAddress.zipCode} onChange={e => setShippingAddress({...shippingAddress, zipCode: e.target.value})} required />
                        <input type="tel" className="form-control" placeholder="Phone *" value={shippingAddress.phone} onChange={e => setShippingAddress({...shippingAddress, phone: e.target.value})} required />
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="order-summary-box">
                    <div className="order-summary-row"><span>Price ({orderQuantity} item{orderQuantity > 1 ? 's' : ''})</span><span>₹{(orderModal.price * orderQuantity).toFixed(2)}</span></div>
                    <div className="order-summary-row"><span>Delivery</span><span className="free-text">FREE</span></div>
                    <div className="order-summary-row total"><span>Total Amount</span><span>₹{(orderModal.price * orderQuantity).toFixed(2)}</span></div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={closeOrderModal}>Cancel</button>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={handlePlaceOrder}
                    disabled={orderLoading}
                    style={{ minWidth: 200 }}
                  >
                    {orderLoading ? 'Placing Order…' : `Place Order • ₹${(orderModal.price * orderQuantity).toFixed(2)}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">Delete Product?</span>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '2.8rem', marginBottom: 12 }}>🗑️</div>
              <p style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--gray-900)', marginBottom: 6 }}>"{deleteConfirm.name}"</p>
              <p style={{ fontSize: '.8rem', color: 'var(--gray-500)', lineHeight: 1.5 }}>This action <strong>cannot be undone</strong>. The product will be permanently removed.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteProduct(deleteConfirm._id)}>Delete Product</button>
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

export default Products;