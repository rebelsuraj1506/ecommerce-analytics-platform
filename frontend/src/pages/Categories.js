import React, { useState, useEffect } from 'react';
import './pages.css';
import BackToTop from './BackToTop';
const CATEGORY_META = {
  electronics: { icon: '💻', gradient: 'linear-gradient(135deg, #1976d2, #1565c0)' },
  clothing:    { icon: '👕', gradient: 'linear-gradient(135deg, #e53935, #b71c1c)' },
  books:       { icon: '📚', gradient: 'linear-gradient(135deg, #43a047, #1b5e20)' },
  home:        { icon: '🏠', gradient: 'linear-gradient(135deg, #fb8c00, #e65100)' },
  sports:      { icon: '⚽', gradient: 'linear-gradient(135deg, #8e24aa, #4a148c)' },
  toys:        { icon: '🧸', gradient: 'linear-gradient(135deg, #00acc1, #006064)' },
  other:       { icon: '📦', gradient: 'linear-gradient(135deg, #546e7a, #37474f)' },
};

function formatINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function DeleteModal({ product, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Delete Product?</span>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center', padding: '28px 24px' }}>
          <div style={{ fontSize: '3.2rem', marginBottom: 14 }}>🗑️</div>
          <p style={{ fontSize: '.9rem', color: 'var(--gray-700)', marginBottom: 8, fontWeight: 700 }}>
            "{product.name}"
          </p>
          <p style={{ fontSize: '.8rem', color: 'var(--gray-500)', lineHeight: 1.5 }}>
            This action <strong>cannot be undone</strong>. The product and all its data will be permanently removed.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? '⏳ Deleting…' : '🗑️ Delete Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type }) {
  const cls = type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : 'toast-info';
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  return (
    <div className={`toast-fixed ${cls}`}>
      <span>{icons[type] || '•'}</span>
      {message}
    </div>
  );
}

function ProductCard({ product, isAdmin, onDeleteClick }) {
  const inv = Number(product.inventory) || 0;
  const totalVal = product.price * inv;
  const imageUrl = product.images?.[0] || `https://picsum.photos/seed/${encodeURIComponent(product.name)}/400/400`;
  const hasRating = product.rating?.count > 0 || (product.reviews?.length > 0);
  const avgRating = product.rating?.average ?? 0;
  const ratingCount = product.rating?.count ?? product.reviews?.length ?? 0;

  const stockBg = inv === 0 ? 'var(--danger)' : inv < 10 ? 'var(--warning)' : 'var(--success)';
  const stockLabel = inv === 0 ? 'Out of Stock' : inv < 10 ? `Only ${inv} left` : `${inv} in stock`;

  return (
    <div className="product-card">
      <div className="product-card-img">
        <img
          src={imageUrl}
          alt={product.name}
          onError={e => { e.target.src = `https://via.placeholder.com/200x200?text=${encodeURIComponent(product.name)}`; }}
        />
        <span className="product-stock-badge" style={{ background: stockBg }}>{stockLabel}</span>
        {isAdmin && (
          <span style={{
            position: 'absolute', top: 8, right: 8,
            background: 'var(--warning-bg)', color: 'var(--warning)',
            border: '1px solid #ffe082',
            padding: '2px 7px', borderRadius: 'var(--radius-xs)',
            fontSize: '.62rem', fontWeight: 700, letterSpacing: '.3px'
          }}>ADMIN</span>
        )}
      </div>

      <div className="product-card-body">
        <span className="product-category">{product.category}</span>
        <p className="product-name">{product.name}</p>

        {hasRating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span className="rating-pill">★ {avgRating.toFixed(1)}</span>
            <span className="rating-count">({ratingCount})</span>
          </div>
        )}

        {product.description && (
          <p className="product-desc">{product.description}</p>
        )}

        <div className="product-card-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--gray-500)' }}>
              <span>Unit Price</span>
              <span style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{formatINR(product.price)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--gray-500)' }}>
              <span>Inventory</span>
              <span style={{ fontWeight: 700, color: 'var(--fk-blue)' }}>{inv} units</span>
            </div>
            <div style={{ borderTop: '1px dashed var(--gray-200)', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--gray-500)' }}>
              <span>Total Value</span>
              <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: '.8rem' }}>{formatINR(totalVal)}</span>
            </div>
          </div>

          {isAdmin && (
            <div>
              <div style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>
                ⚙️ Admin Action
              </div>
              <button
                className="btn btn-danger btn-sm w-full"
                onClick={() => onDeleteClick(product)}
              >
                🗑️ Delete Product
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Categories({ token, userRole }) {
  const isAdmin = userRole === 'admin';

  const [categories, setCategories] = useState([]);
  const [productsByCategory, setProductsByCategory] = useState({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch('http://localhost:8002/api/categories'),
        fetch('http://localhost:8002/api/products?limit=100'),
      ]);
      const catData = await catRes.json();
      const prodData = await prodRes.json();
      const catList = catData.data?.categories || [];
      const allProducts = prodData.data?.products || [];

      const grouped = {};
      catList.forEach(cat => {
        grouped[cat] = allProducts.filter(p => p.category === cat);
      });

      setCategories(catList);
      setProductsByCategory(grouped);
    } catch (err) {
      showToast('Failed to load data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Categories — ShopMart';
    return () => { document.title = 'ShopMart'; };
  }, []);

  useEffect(() => { fetchData(); }, []);

  const handleDeleteClick = (product) => {
    if (!isAdmin) return;
    setDeleteTarget(product);
  };

  const confirmDelete = async () => {
    if (!isAdmin || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`http://localhost:8002/api/products/${deleteTarget._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        showToast(`"${deleteTarget.name}" deleted successfully`, 'success');
        setDeleteTarget(null);
        await fetchData();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || 'Delete failed', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalProducts = Object.values(productsByCategory).reduce((s, arr) => s + arr.length, 0);
  const totalInventory = Object.values(productsByCategory)
    .flat().reduce((s, p) => s + (Number(p.inventory) || 0), 0);
  const totalValue = Object.values(productsByCategory)
    .flat().reduce((s, p) => s + (p.price * (Number(p.inventory) || 0)), 0);

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="spinner-wrap">
          <div className="spinner" />
          <p style={{ color: 'var(--gray-500)', fontSize: '.86rem', margin: 0 }}>Loading categories…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-row">
          <div style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, var(--fk-blue), var(--fk-blue-dark))',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', boxShadow: '0 2px 8px rgba(40,116,240,.3)', flexShrink: 0
          }}>🏷️</div>
          <div>
            <h1 className="page-title">Product Categories</h1>
            <p style={{ fontSize: '.72rem', color: 'var(--gray-500)', marginTop: 2 }}>
              {categories.length} categories · Browse by department
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="info-chip" style={{ background: 'var(--fk-blue-light)', color: 'var(--fk-blue)' }}>
            📦 {totalProducts} products
          </span>
          <span className="info-chip" style={{ background: '#fff4ec', color: 'var(--fk-orange)' }}>
            {formatINR(totalValue)} total value
          </span>
        </div>
      </div>

      <div className="page-body">
        {/* Summary Cards */}
        {categories.length > 0 && (
          <div className="cat-summary-grid mb-20">
            {[
              { label: 'Total Categories', val: categories.length,               sub: 'Active departments',      icon: '🏷️', color: 'var(--fk-blue)',   bg: 'var(--fk-blue-light)' },
              { label: 'Total Products',   val: totalProducts,                   sub: 'Across all categories',   icon: '📦', color: 'var(--success)',   bg: 'var(--success-bg)' },
              { label: 'Total Inventory',  val: totalInventory.toLocaleString(), sub: 'Units in stock',          icon: '📊', color: 'var(--fk-orange)', bg: '#fff4ec' },
              { label: 'Portfolio Value',  val: formatINR(totalValue),           sub: 'Total inventory value',   icon: '💰', color: '#9c27b0',          bg: '#f3e5f5', small: true },
            ].map((s, i) => (
              <div key={i} className="cat-summary-card">
                <div className="cat-summary-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                <div>
                  <div className="cat-summary-label">{s.label}</div>
                  <div className="cat-summary-val" style={{ color: s.color, fontSize: s.small ? '1rem' : undefined }}>{s.val}</div>
                  <div style={{ fontSize: '.65rem', color: 'var(--gray-400)', marginTop: 2 }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="alert alert-warning mb-16">
            🔐&nbsp;<strong>Admin Mode:</strong>&nbsp;You can delete products. Delete buttons are visible only to you.
          </div>
        )}

        {categories.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏷️</div>
            <div className="empty-title">No categories found</div>
            <div className="empty-desc">Products will appear here once added.</div>
          </div>
        ) : (
          categories.map(category => {
            const meta = CATEGORY_META[category] || CATEGORY_META.other;
            const products = productsByCategory[category] || [];
            const catTotal = products.reduce((s, p) => s + p.price * (Number(p.inventory) || 0), 0);
            const catUnits = products.reduce((s, p) => s + (Number(p.inventory) || 0), 0);

            return (
              <div key={category} className="card mb-16" style={{ overflow: 'hidden' }}>
                {/* Category Header */}
                <div
                  className="cat-section-header"
                  style={{ background: meta.gradient, position: 'relative', overflow: 'hidden' }}
                >
                  <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.1)' }} />
                  <div style={{ position: 'absolute', right: 20, bottom: -40, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, zIndex: 1 }}>
                    <span style={{ fontSize: '2.2rem', lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.2))' }}>{meta.icon}</span>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', letterSpacing: '-.2px' }}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </div>
                      <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.85)', marginTop: 3 }}>
                        {products.length} product{products.length !== 1 ? 's' : ''} · {catUnits.toLocaleString()} units · {formatINR(catTotal)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, zIndex: 1, flexWrap: 'wrap' }}>
                    {[`📦 ${products.length}`, formatINR(catTotal)].map((label, i) => (
                      <span key={i} className="cat-section-count" style={{
                        background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,.3)',
                        color: '#fff', padding: '5px 14px', fontSize: '.7rem', fontWeight: 600
                      }}>{label}</span>
                    ))}
                  </div>
                </div>

                {/* Products */}
                {products.length === 0 ? (
                  <div className="empty-state" style={{ padding: '40px 20px' }}>
                    <div className="empty-icon">📭</div>
                    <div className="empty-title">No products in this category yet</div>
                  </div>
                ) : (
                  <div className="product-grid">
                    {products.map(product => (
                      <ProductCard
                        key={product._id}
                        product={product}
                        isAdmin={isAdmin}
                        onDeleteClick={handleDeleteClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {isAdmin && deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          loading={deleteLoading}
          onConfirm={confirmDelete}
          onCancel={() => !deleteLoading && setDeleteTarget(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
      <BackToTop />
    </div>
  );
}

export default Categories;
