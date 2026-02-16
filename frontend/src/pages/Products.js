import React, { useState, useEffect } from 'react';

function Products({ token, userRole }) {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [orderModal, setOrderModal] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [shippingAddress, setShippingAddress] = useState({
    street: '', city: '', state: '', zipCode: '', phone: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [formData, setFormData] = useState({
    name: '', description: '', price: '', inventory: '', category: 'electronics', images: []
  });
  const [loading, setLoading] = useState(true);

  const isAdmin = userRole === 'admin';

  // Generate a product image URL using free APIs
  const getProductImage = (productName, category) => {
    // Use DiceBear for consistent placeholder icons, or picsum for photos
    const seed = encodeURIComponent(productName || category || 'product');
    // picsum.photos is a free, reliable image service
    const hash = Math.abs(seed.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0));
    return `https://picsum.photos/seed/${hash}/400/400`;
  };

  const fetchProducts = () => {
    setLoading(true);
    fetch('http://localhost:8002/api/products?limit=100')
      .then(res => res.json())
      .then(data => {
        console.log('Products API response:', data);
        setProducts(data.data?.products || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch products:', err);
        setLoading(false);
      });
  };

  useEffect(() => { fetchProducts(); }, []);

  // ========== ADMIN: Add Product ==========
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imageUrl = formData.images[0];
      if (!imageUrl || imageUrl.includes('placeholder')) {
        imageUrl = getProductImage(formData.name, formData.category);
      }
      
      const res = await fetch('http://localhost:8002/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          inventory: parseInt(formData.inventory),
          images: [imageUrl]
        })
      });
      
      if (res.ok) {
        alert('✅ Product created successfully!');
        setShowForm(false);
        setFormData({ name: '', description: '', price: '', inventory: '', category: 'electronics', images: [] });
        fetchProducts();
      } else {
        const errorData = await res.json();
        alert('Error: ' + (errorData.message || 'Failed to create product'));
      }
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ========== ADMIN: Delete Product ==========
  const deleteProduct = async (productId, productName) => {
    if (!window.confirm(`Delete "${productName}"? This cannot be undone!`)) return;
    try {
      const res = await fetch(`http://localhost:8002/api/products/${productId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { alert('Product deleted!'); fetchProducts(); }
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ========== ADMIN: Edit Product ==========
  const saveEdit = async () => {
    try {
      const res = await fetch(`http://localhost:8002/api/products/${editingProduct._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...editingProduct,
          price: parseFloat(editingProduct.price),
          inventory: parseInt(editingProduct.inventory)
        })
      });
      if (res.ok) { alert('Product updated!'); setEditingProduct(null); fetchProducts(); }
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ========== USER: Place Order ==========
  const handlePlaceOrder = async () => {
    if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zipCode || !shippingAddress.phone) {
      alert('Please fill in all shipping address fields');
      return;
    }

    setOrderLoading(true);
    try {
      const res = await fetch('http://localhost:8003/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          items: [{
            productId: orderModal._id,
            name: orderModal.name,
            quantity: orderQuantity,
            price: orderModal.price
          }],
          paymentMethod,
          shippingAddress
        })
      });

      const data = await res.json();
      if (data.success) {
        setOrderSuccess(data.data.order);
        fetchProducts(); // refresh inventory
      } else {
        alert('Error: ' + (data.message || 'Failed to place order'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setOrderLoading(false);
    }
  };

  const closeOrderModal = () => {
    setOrderModal(null);
    setOrderSuccess(null);
    setOrderQuantity(1);
    setShippingAddress({ street: '', city: '', state: '', zipCode: '', phone: '' });
    setPaymentMethod('cod');
  };

  return (
    <div style={{background: '#f1f3f6', minHeight: '100vh', padding: '20px'}}>
      <div style={{maxWidth: '1400px', margin: '0 auto'}}>
        {/* Header */}
        <div style={{background: 'white', padding: '20px 30px', borderRadius: '2px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
          <h2 style={{margin: 0, color: '#212121', fontSize: '24px', fontWeight: '500'}}>
            {isAdmin ? '📦 Products Catalog' : '🛍️ Shop Products'}
          </h2>
          {isAdmin && (
            <button onClick={() => setShowForm(!showForm)} style={{padding: '10px 20px', background: '#fb641b', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: '500', fontSize: '14px'}}>
              {showForm ? '✖ Cancel' : '+ Add New Product'}
            </button>
          )}
        </div>

        {/* Admin: Add Product Form */}
        {isAdmin && showForm && (
          <div style={{background: 'white', padding: '30px', borderRadius: '2px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <h3 style={{marginTop: 0}}>Add New Product</h3>
            <form onSubmit={handleSubmit}>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                <input type="text" placeholder="Product Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{padding: '12px', border: '1px solid #e0e0e0', borderRadius: '2px', fontSize: '14px'}} required />
                <input type="number" step="0.01" placeholder="Price (₹)" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} style={{padding: '12px', border: '1px solid #e0e0e0', borderRadius: '2px', fontSize: '14px'}} required />
                <input type="number" placeholder="Inventory Stock" value={formData.inventory} onChange={(e) => setFormData({...formData, inventory: e.target.value})} style={{padding: '12px', border: '1px solid #e0e0e0', borderRadius: '2px', fontSize: '14px'}} required />
                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} style={{padding: '12px', border: '1px solid #e0e0e0', borderRadius: '2px', fontSize: '14px'}}>
                  <option value="electronics">Electronics</option>
                  <option value="clothing">Clothing</option>
                  <option value="books">Books</option>
                  <option value="home">Home & Kitchen</option>
                  <option value="sports">Sports</option>
                  <option value="toys">Toys</option>
                </select>
              </div>
              <textarea placeholder="Product Description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} style={{width: '100%', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '2px', marginTop: '20px', minHeight: '100px', fontSize: '14px', boxSizing: 'border-box'}} required />
              <input type="url" placeholder="Image URL (leave blank for auto-generated)" value={formData.images[0] || ''} onChange={(e) => setFormData({...formData, images: [e.target.value]})} style={{width: '100%', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '2px', marginTop: '15px', fontSize: '14px', boxSizing: 'border-box'}} />
              <button type="submit" style={{marginTop: '20px', padding: '12px 30px', background: '#fb641b', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: '500', fontSize: '14px'}}>Add Product</button>
            </form>
          </div>
        )}

        {loading && (
          <div style={{background: 'white', padding: '60px', textAlign: 'center', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <div style={{fontSize: '48px', marginBottom: '20px'}}>⏳</div>
            <h3 style={{color: '#878787', fontWeight: '400'}}>Loading products...</h3>
          </div>
        )}

        {/* Product Grid */}
        {!loading && products.length > 0 && (
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px'}}>
          {products.map(product => {
            const isEditing = editingProduct?._id === product._id;
            const imageUrl = product.images?.[0] || getProductImage(product.name, product.category);
            const inv = Number(product.inventory);
            const inventory = typeof inv === 'number' && !Number.isNaN(inv) ? inv : 0;
            const inStock = inventory > 0;
            
            return (
              <div 
                key={product._id} 
                style={{background: 'white', borderRadius: '2px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', transition: 'box-shadow 0.3s'}}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)'}
                title={!inStock ? 'Will be back soon' : undefined}
              >
                
                <div style={{position: 'relative', paddingTop: '100%', background: '#fff', borderBottom: '1px solid #f0f0f0'}}>
                  <img src={imageUrl} alt={product.name} style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover'}}
                    onError={(e) => { e.target.src = `https://placehold.co/400x400/e0e0e0/757575?text=${encodeURIComponent(product.name?.substring(0,15) || 'Product')}`; }}
                  />
                  <div 
                    style={{position: 'absolute', bottom: '10px', left: '10px', background: inStock ? (inventory > 20 ? '#388e3c' : '#ff9800') : '#757575', color: 'white', padding: '4px 10px', borderRadius: '2px', fontSize: '11px', fontWeight: '500'}}
                    title={!inStock ? 'Will be back soon' : undefined}
                  >
                    {inStock ? `${inventory} in stock` : 'Sold out'}
                  </div>
                </div>

                <div style={{padding: '16px'}}>
                  {isEditing ? (
                    <>
                      <select value={editingProduct.category} onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})} style={{width: '100%', padding: '8px', marginBottom: '8px', fontSize: '12px', border: '1px solid #e0e0e0', borderRadius: '2px'}}>
                        <option value="electronics">Electronics</option>
                        <option value="clothing">Clothing</option>
                        <option value="books">Books</option>
                        <option value="home">Home & Kitchen</option>
                        <option value="sports">Sports</option>
                        <option value="toys">Toys</option>
                      </select>
                      <input type="text" value={editingProduct.name || ''} onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="Product name" style={{width: '100%', padding: '8px', marginBottom: '8px', fontSize: '14px', border: '1px solid #e0e0e0', borderRadius: '2px', boxSizing: 'border-box'}} />
                      <textarea value={editingProduct.description || ''} onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="Description" rows={2} style={{width: '100%', padding: '8px', marginBottom: '8px', fontSize: '12px', border: '1px solid #e0e0e0', borderRadius: '2px', boxSizing: 'border-box', resize: 'vertical'}} />
                      <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                        <input type="number" step="0.01" value={editingProduct.price ?? ''} onChange={(e) => setEditingProduct({...editingProduct, price: e.target.value})} placeholder="Price" style={{flex: 1, padding: '8px', fontSize: '14px', border: '1px solid #e0e0e0', borderRadius: '2px'}} />
                        <input type="number" min="0" value={editingProduct.inventory ?? ''} onChange={(e) => setEditingProduct({...editingProduct, inventory: e.target.value})} placeholder="Stock" style={{flex: 1, padding: '8px', fontSize: '14px', border: '1px solid #e0e0e0', borderRadius: '2px'}} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{fontSize: '12px', color: '#878787', marginBottom: '4px', textTransform: 'uppercase'}}>{product.category}</div>
                      <h3 style={{margin: '0 0 8px 0', fontSize: '14px', fontWeight: '500', color: '#212121', height: '40px', overflow: 'hidden', lineHeight: '1.4'}}>{product.name}</h3>
                      <p style={{color: '#878787', fontSize: '12px', margin: '0 0 12px 0', height: '36px', overflow: 'hidden', lineHeight: '1.5'}}>{product.description}</p>
                      {(product.rating?.count > 0 || (product.reviews && product.reviews.length > 0)) && (
                        <div style={{marginBottom: '6px'}}>
                          <div style={{fontSize: '12px', color: '#ff9800', fontWeight: '500'}}>★ {(product.rating?.average ?? 0).toFixed(1)} ({product.rating?.count ?? product.reviews?.length ?? 0} reviews)</div>
                          {product.reviews && product.reviews.length > 0 && (
                            <div style={{fontSize: '11px', color: '#757575', marginTop: '4px', maxHeight: '36px', overflow: 'hidden'}}>
                              {product.reviews.slice(0, 2).map((r, i) => (
                                <div key={i} style={{marginBottom: '2px'}}>"{r.comment ? (r.comment.length > 40 ? r.comment.slice(0, 40) + '…' : r.comment) : 'Rated ' + r.rating + '★'}" — {r.userName || 'User'}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div style={{borderTop: '1px solid #f0f0f0', paddingTop: '12px'}}>
                    {!isEditing && (
                      <div style={{display: 'flex', alignItems: 'baseline', marginBottom: '12px'}}>
                        <span style={{fontSize: '20px', fontWeight: '500', color: '#212121'}}>₹{product.price?.toFixed(2)}</span>
                      </div>
                    )}

                    {/* User: Buy Now button */}
                    {!isAdmin && (
                      <button 
                        onClick={() => inStock ? setOrderModal(product) : null}
                        disabled={!inStock}
                        title={!inStock ? 'Will be back soon' : undefined}
                        style={{
                          width: '100%', padding: '12px', 
                          background: inStock ? 'linear-gradient(135deg, #fb641b 0%, #ff9f00 100%)' : '#e0e0e0',
                          color: inStock ? 'white' : '#9e9e9e', 
                          border: 'none', borderRadius: '2px', cursor: inStock ? 'pointer' : 'not-allowed',
                          fontWeight: '600', fontSize: '14px', letterSpacing: '0.5px'
                        }}
                      >
                        {inStock ? '🛒 BUY NOW' : 'Sold out'}
                      </button>
                    )}

                    {/* Admin: Edit/Delete buttons */}
                    {isAdmin && (
                      <div style={{display: 'flex', gap: '8px'}}>
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit()} style={{flex: 1, padding: '10px', background: '#388e3c', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'}}>Save</button>
                            <button onClick={() => setEditingProduct(null)} style={{flex: 1, padding: '10px', background: '#757575', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'}}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditingProduct(product)} style={{flex: 1, padding: '10px', background: '#2874f0', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'}}>✏️ Edit</button>
                            <button onClick={() => deleteProduct(product._id, product.name)} style={{flex: 1, padding: '10px', background: '#ff6161', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'}}>🗑️ Delete</button>
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

        {!loading && products.length === 0 && (
          <div style={{background: 'white', padding: '60px', textAlign: 'center', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <div style={{fontSize: '48px', marginBottom: '20px'}}>📦</div>
            <h3 style={{color: '#878787', fontWeight: '400'}}>No products yet</h3>
            <p style={{color: '#bdbdbd'}}>
              {isAdmin ? 'Click "+ Add New Product" to get started' : 'Products will appear here once available'}
            </p>
          </div>
        )}

        {/* ========== ORDER MODAL ========== */}
        {orderModal && (
          <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'}}>
            <div style={{background: 'white', borderRadius: '8px', maxWidth: '550px', width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)'}}>

              {/* Order Success View */}
              {orderSuccess ? (
                <div style={{padding: '40px', textAlign: 'center'}}>
                  <div style={{fontSize: '64px', marginBottom: '15px'}}>✅</div>
                  <h2 style={{margin: '0 0 10px 0', color: '#388e3c'}}>Order Placed Successfully!</h2>
                  <p style={{color: '#757575', marginBottom: '20px'}}>Your order #{orderSuccess.id} has been placed.</p>
                  <div style={{background: '#e8f5e9', padding: '20px', borderRadius: '8px', marginBottom: '20px', textAlign: 'left'}}>
                    <div style={{fontSize: '14px', color: '#2e7d32', marginBottom: '8px'}}><strong>Order ID:</strong> #{orderSuccess.id}</div>
                    <div style={{fontSize: '14px', color: '#2e7d32', marginBottom: '8px'}}><strong>Amount:</strong> ₹{parseFloat(orderSuccess.totalAmount).toFixed(2)}</div>
                    <div style={{fontSize: '14px', color: '#2e7d32', marginBottom: '8px'}}><strong>Status:</strong> {orderSuccess.status}</div>
                    <div style={{fontSize: '14px', color: '#2e7d32'}}><strong>Payment:</strong> {orderSuccess.paymentMethod?.toUpperCase()}</div>
                  </div>
                  <p style={{fontSize: '13px', color: '#757575', marginBottom: '25px'}}>
                    You can track your order from "My Orders" page.
                  </p>
                  <button onClick={closeOrderModal} style={{padding: '12px 30px', background: '#388e3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', fontSize: '16px'}}>
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <>
                  {/* Modal Header */}
                  <div style={{padding: '20px', borderBottom: '1px solid #e0e0e0', background: 'linear-gradient(135deg, #fb641b 0%, #ff9f00 100%)', color: 'white', borderRadius: '8px 8px 0 0'}}>
                    <h3 style={{margin: 0, fontSize: '20px'}}>🛒 Place Order</h3>
                  </div>

                  <div style={{padding: '20px'}}>
                    {/* Product Summary */}
                    <div style={{display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '6px'}}>
                      <img src={orderModal.images?.[0] || getProductImage(orderModal.name, orderModal.category)} alt={orderModal.name} style={{width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px'}}
                        onError={(e) => { e.target.src = `https://placehold.co/80x80/e0e0e0/757575?text=Img`; }}
                      />
                      <div style={{flex: 1}}>
                        <div style={{fontWeight: '500', fontSize: '15px', marginBottom: '5px'}}>{orderModal.name}</div>
                        <div style={{fontSize: '18px', fontWeight: '600', color: '#388e3c'}}>₹{orderModal.price?.toFixed(2)}</div>
                        <div style={{fontSize: '12px', color: '#757575', marginTop: '3px'}}>{(Number(orderModal.inventory) || 0)} available</div>
                      </div>
                    </div>

                    {/* Quantity */}
                    <div style={{marginBottom: '20px'}}>
                      <label style={{display: 'block', fontWeight: '500', marginBottom: '8px', fontSize: '14px'}}>Quantity</label>
                      <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <button onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))} style={{width: '36px', height: '36px', border: '1px solid #e0e0e0', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '18px'}}>−</button>
                        <input type="number" value={orderQuantity} min="1" max={Math.max(1, Number(orderModal.inventory) || 0)} onChange={(e) => setOrderQuantity(Math.min(Math.max(1, Number(orderModal.inventory) || 0), Math.max(1, parseInt(e.target.value) || 1)))}
                          style={{width: '60px', textAlign: 'center', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '16px'}} />
                        <button onClick={() => setOrderQuantity(Math.min(Math.max(1, Number(orderModal.inventory) || 0), orderQuantity + 1))} style={{width: '36px', height: '36px', border: '1px solid #e0e0e0', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '18px'}}>+</button>
                        <span style={{fontSize: '16px', fontWeight: '600', color: '#212121', marginLeft: '15px'}}>
                          Total: ₹{(orderModal.price * orderQuantity).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div style={{marginBottom: '20px'}}>
                      <label style={{display: 'block', fontWeight: '500', marginBottom: '8px', fontSize: '14px'}}>Payment Method</label>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                        {[
                          { value: 'cod', label: '💵 Cash on Delivery' },
                          { value: 'upi', label: '📱 UPI' },
                          { value: 'card', label: '💳 Card' },
                          { value: 'netbanking', label: '🏦 Net Banking' }
                        ].map(pm => (
                          <div key={pm.value} onClick={() => setPaymentMethod(pm.value)} style={{
                            padding: '12px', border: paymentMethod === pm.value ? '2px solid #2874f0' : '1px solid #e0e0e0',
                            borderRadius: '4px', cursor: 'pointer', textAlign: 'center', fontSize: '13px',
                            background: paymentMethod === pm.value ? '#e3f2fd' : 'white',
                            fontWeight: paymentMethod === pm.value ? '600' : '400'
                          }}>
                            {pm.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div style={{marginBottom: '20px'}}>
                      <label style={{display: 'block', fontWeight: '500', marginBottom: '8px', fontSize: '14px'}}>📍 Shipping Address</label>
                      <input type="text" placeholder="Street Address *" value={shippingAddress.street} onChange={(e) => setShippingAddress({...shippingAddress, street: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', marginBottom: '10px', fontSize: '14px', boxSizing: 'border-box'}} required />
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                        <input type="text" placeholder="City *" value={shippingAddress.city} onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})} style={{padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '14px'}} required />
                        <input type="text" placeholder="State *" value={shippingAddress.state} onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})} style={{padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '14px'}} required />
                      </div>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px'}}>
                        <input type="text" placeholder="ZIP Code *" value={shippingAddress.zipCode} onChange={(e) => setShippingAddress({...shippingAddress, zipCode: e.target.value})} style={{padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '14px'}} required />
                        <input type="tel" placeholder="Phone Number *" value={shippingAddress.phone} onChange={(e) => setShippingAddress({...shippingAddress, phone: e.target.value})} style={{padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '14px'}} required />
                      </div>
                    </div>

                    {/* Order Summary */}
                    <div style={{background: '#fff9e6', padding: '15px', borderRadius: '4px', marginBottom: '20px', borderLeft: '3px solid #ffc107'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                        <span style={{color: '#757575'}}>Price ({orderQuantity} item{orderQuantity > 1 ? 's' : ''})</span>
                        <span>₹{(orderModal.price * orderQuantity).toFixed(2)}</span>
                      </div>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                        <span style={{color: '#757575'}}>Delivery</span>
                        <span style={{color: '#388e3c'}}>FREE</span>
                      </div>
                      <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e0e0e0', paddingTop: '8px', fontWeight: '600', fontSize: '16px'}}>
                        <span>Total Amount</span>
                        <span style={{color: '#388e3c'}}>₹{(orderModal.price * orderQuantity).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div style={{padding: '15px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '10px', background: '#f8f9fa'}}>
                    <button onClick={closeOrderModal} style={{flex: 1, padding: '12px', background: '#757575', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', fontSize: '14px'}}>
                      Cancel
                    </button>
                    <button onClick={handlePlaceOrder} disabled={orderLoading} style={{
                      flex: 2, padding: '12px', 
                      background: orderLoading ? '#bdbdbd' : 'linear-gradient(135deg, #fb641b 0%, #ff9f00 100%)',
                      color: 'white', border: 'none', borderRadius: '4px', 
                      cursor: orderLoading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '16px'
                    }}>
                      {orderLoading ? 'Placing Order...' : `Place Order • ₹${(orderModal.price * orderQuantity).toFixed(2)}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Products;
