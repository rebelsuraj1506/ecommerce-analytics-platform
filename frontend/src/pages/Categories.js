import React, { useState, useEffect } from 'react';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

  * { box-sizing: border-box; }

  .cat-page {
    background: #f1f3f6;
    min-height: 100vh;
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Page Header ── */
  .cat-header {
    background: #fff;
    border-bottom: 1px solid #e0e0e0;
    padding: 18px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 50;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  .cat-header-left { display: flex; align-items: center; gap: 14px; }
  .cat-header-icon {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, #2874f0, #1a5dc7);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; box-shadow: 0 2px 8px rgba(40,116,240,0.3);
  }
  .cat-header h2 {
    margin: 0; font-family: 'DM Sans', sans-serif;
    font-size: 20px; font-weight: 800; color: #212121;
    letter-spacing: -0.3px;
  }
  .cat-header p {
    margin: 2px 0 0; font-size: 12px; color: #878787;
  }
  .cat-stats-pill {
    display: flex; gap: 10px; align-items: center;
  }
  .stat-chip {
    background: #f0f4ff; border: 1px solid #c5d5fb;
    border-radius: 20px; padding: 6px 14px;
    font-size: 12px; font-weight: 600; color: #2874f0;
    display: flex; align-items: center; gap: 5px;
  }
  .stat-chip.orange { background: #fff4ec; border-color: #ffd5b0; color: #fb641b; }

  /* ── Loading ── */
  .cat-loading {
    min-height: 100vh; background: #f1f3f6;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
  }
  .cat-spinner {
    width: 48px; height: 48px;
    border: 4px solid #e0e0e0;
    border-top-color: #2874f0;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Body ── */
  .cat-body { max-width: 1440px; margin: 0 auto; padding: 24px 24px 40px; }

  /* ── Summary Bar ── */
  .cat-summary {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 14px; margin-bottom: 28px;
  }
  .summary-card {
    background: #fff; border-radius: 8px;
    padding: 16px 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    border-left: 4px solid var(--accent);
    transition: box-shadow 0.2s;
  }
  .summary-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
  .summary-label { font-size: 11px; color: #878787; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .summary-value { font-size: 22px; font-weight: 800; font-family: 'DM Sans', sans-serif; color: var(--accent); }
  .summary-sub { font-size: 11px; color: #b0b0b0; margin-top: 2px; }

  /* ── Category Block ── */
  .category-section { margin-bottom: 32px; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }

  /* ── Category Header ── */
  .cat-section-header {
    padding: 18px 24px;
    background: var(--cat-color, #2874f0);
    display: flex; align-items: center; justify-content: space-between;
    position: relative; overflow: hidden;
  }
  .cat-section-header::before {
    content: '';
    position: absolute; right: -30px; top: -30px;
    width: 120px; height: 120px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
  }
  .cat-section-header::after {
    content: '';
    position: absolute; right: 20px; bottom: -40px;
    width: 90px; height: 90px;
    border-radius: 50%;
    background: rgba(255,255,255,0.07);
  }
  .cat-title-group { display: flex; align-items: center; gap: 14px; z-index: 1; }
  .cat-emoji { font-size: 36px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
  .cat-name { font-family: 'DM Sans', sans-serif; font-size: 18px; font-weight: 800; color: white; margin: 0; }
  .cat-meta { font-size: 12px; color: rgba(255,255,255,0.85); margin: 3px 0 0; }
  .cat-badges { display: flex; gap: 8px; z-index: 1; }
  .cat-badge {
    background: rgba(255,255,255,0.2); backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 20px; padding: 5px 14px;
    font-size: 11px; font-weight: 600; color: white;
    display: flex; align-items: center; gap: 4px;
  }

  /* ── Product Grid ── */
  .product-grid {
    background: #fff;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(195px, 1fr));
    gap: 1px;
    background-color: #ebebeb;
  }

  /* ── Product Card ── */
  .product-card {
    background: #fff;
    padding: 16px;
    position: relative;
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: default;
  }
  .product-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.12); z-index: 2; }

  /* Image Container */
  .product-img-wrap {
    position: relative; padding-top: 100%;
    background: #fafafa; border-radius: 6px;
    overflow: hidden; margin-bottom: 12px;
    border: 1px solid #f0f0f0;
  }
  .product-img {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: contain; padding: 14px;
    transition: transform 0.3s ease;
  }
  .product-card:hover .product-img { transform: scale(1.04); }

  /* Badges on image */
  .badge-stock {
    position: absolute; bottom: 8px; left: 8px;
    padding: 3px 9px; border-radius: 3px;
    font-size: 10px; font-weight: 700; color: white;
    letter-spacing: 0.3px;
  }
  .badge-stock.in { background: #388e3c; }
  .badge-stock.low { background: #ff9800; }
  .badge-stock.out { background: #9e9e9e; }

  .badge-admin-only {
    position: absolute; top: 8px; right: 8px;
    background: #fff3e0; color: #e65100;
    border: 1px solid #ffcc02;
    padding: 2px 7px; border-radius: 3px;
    font-size: 9px; font-weight: 700; letter-spacing: 0.3px;
  }

  /* Product Info */
  .product-name {
    font-size: 13px; font-weight: 600; color: #212121;
    margin: 0 0 5px; line-height: 1.35;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
  }

  .product-rating {
    display: flex; align-items: center; gap: 5px;
    margin-bottom: 6px;
  }
  .rating-pill {
    background: #388e3c; color: white;
    padding: 2px 7px; border-radius: 3px;
    font-size: 11px; font-weight: 700;
    display: flex; align-items: center; gap: 3px;
  }
  .rating-count { font-size: 11px; color: #878787; }

  .product-desc {
    font-size: 11px; color: #878787; margin: 0 0 10px;
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
    line-height: 1.4;
  }

  /* Price Table */
  .price-table {
    border-top: 1px solid #f0f0f0;
    padding-top: 10px; margin-bottom: 12px;
  }
  .price-row {
    display: flex; justify-content: space-between;
    align-items: center; margin-bottom: 5px;
    font-size: 12px;
  }
  .price-label { color: #878787; }
  .price-val { font-weight: 600; color: #212121; }
  .price-val.blue { color: #2874f0; }
  .price-val.green { color: #388e3c; font-size: 13px; }
  .price-divider { border: none; border-top: 1px dashed #eee; margin: 6px 0; }

  /* Delete Button - Admin Only */
  .btn-delete {
    width: 100%; padding: 8px 12px;
    background: #fff; color: #d32f2f;
    border: 1.5px solid #ef9a9a; border-radius: 4px;
    cursor: pointer; font-size: 12px; font-weight: 600;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: all 0.2s; font-family: 'DM Sans', sans-serif;
  }
  .btn-delete:hover {
    background: #d32f2f; color: white;
    border-color: #d32f2f;
    box-shadow: 0 2px 8px rgba(211,47,47,0.3);
  }

  /* Admin Badge on delete section */
  .admin-gate {
    display: flex; flex-direction: column; gap: 4px;
  }
  .admin-label {
    font-size: 9px; font-weight: 700; color: #ff9800;
    text-transform: uppercase; letter-spacing: 0.5px;
    display: flex; align-items: center; gap: 4px;
  }

  /* Empty State */
  .empty-state {
    background: #fff; padding: 48px 24px;
    text-align: center;
  }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty-title { font-size: 14px; color: #9e9e9e; font-weight: 500; }

  /* No categories state */
  .no-categories {
    background: white; border-radius: 10px;
    padding: 80px 40px; text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  /* Admin-only notice bar */
  .admin-notice {
    background: linear-gradient(135deg, #fff3e0 0%, #fff8f5 100%);
    border: 1px solid #ffe0b2;
    border-radius: 8px; padding: 12px 18px;
    margin-bottom: 20px;
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; color: #e65100; font-weight: 500;
  }

  /* Delete confirm modal */
  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5); backdrop-filter: blur(3px);
    z-index: 1000; display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .modal-box {
    background: #fff; border-radius: 12px;
    padding: 32px; max-width: 420px; width: 90%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    animation: slideUp 0.2s ease;
  }
  @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .modal-icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
  .modal-title { font-family: 'DM Sans', sans-serif; font-size: 18px; font-weight: 800; color: #212121; margin: 0 0 8px; text-align: center; }
  .modal-body { font-size: 13px; color: #757575; text-align: center; margin-bottom: 24px; line-height: 1.6; }
  .modal-product { font-weight: 700; color: #212121; }
  .modal-actions { display: flex; gap: 12px; }
  .btn-cancel {
    flex: 1; padding: 12px; background: #f5f5f5; color: #424242;
    border: 1px solid #e0e0e0; border-radius: 6px;
    cursor: pointer; font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif;
    transition: background 0.2s;
  }
  .btn-cancel:hover { background: #eeeeee; }
  .btn-confirm-delete {
    flex: 1; padding: 12px; background: #d32f2f; color: white;
    border: none; border-radius: 6px; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif;
    transition: background 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .btn-confirm-delete:hover { background: #b71c1c; }
  .btn-confirm-delete:disabled { background: #ef9a9a; cursor: not-allowed; }

  /* Toast */
  .toast {
    position: fixed; bottom: 28px; right: 28px;
    background: #323232; color: white;
    padding: 14px 22px; border-radius: 8px;
    font-size: 13px; font-weight: 500;
    display: flex; align-items: center; gap: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    animation: slideInRight 0.3s ease;
    z-index: 2000;
  }
  .toast.success { background: #1b5e20; }
  .toast.error { background: #b71c1c; }
  @keyframes slideInRight {
    from { transform: translateX(80px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;

const CATEGORY_META = {
  electronics: { icon: '💻', color: '#1565c0', gradient: 'linear-gradient(135deg, #1976d2, #1565c0)' },
  clothing:    { icon: '👕', color: '#b71c1c', gradient: 'linear-gradient(135deg, #e53935, #b71c1c)' },
  books:       { icon: '📚', color: '#1b5e20', gradient: 'linear-gradient(135deg, #43a047, #1b5e20)' },
  home:        { icon: '🏠', color: '#e65100', gradient: 'linear-gradient(135deg, #fb8c00, #e65100)' },
  sports:      { icon: '⚽', color: '#4a148c', gradient: 'linear-gradient(135deg, #8e24aa, #4a148c)' },
  toys:        { icon: '🧸', color: '#006064', gradient: 'linear-gradient(135deg, #00acc1, #006064)' },
  other:       { icon: '📦', color: '#37474f', gradient: 'linear-gradient(135deg, #546e7a, #37474f)' },
};

function formatINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

// ── Delete Confirm Modal ──
function DeleteModal({ product, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-icon">🗑️</div>
        <div className="modal-title">Delete Product?</div>
        <div className="modal-body">
          You're about to permanently delete{' '}
          <span className="modal-product">"{product.name}"</span>.
          <br />This action <strong>cannot be undone</strong>.
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="btn-confirm-delete"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '⏳ Deleting…' : '🗑️ Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast Notification ──
function Toast({ message, type }) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  return (
    <div className={`toast ${type}`}>
      <span>{icons[type] || '•'}</span>
      {message}
    </div>
  );
}

// ── Product Card ──
function ProductCard({ product, isAdmin, onDeleteClick }) {
  const inv = Number(product.inventory) || 0;
  const totalVal = product.price * inv;
  const imageUrl = product.images?.[0] || `https://picsum.photos/seed/${encodeURIComponent(product.name)}/400/400`;
  const hasRating = product.rating?.count > 0 || (product.reviews?.length > 0);
  const avgRating = product.rating?.average ?? 0;
  const ratingCount = product.rating?.count ?? product.reviews?.length ?? 0;

  const stockClass = inv === 0 ? 'out' : inv < 10 ? 'low' : 'in';
  const stockLabel = inv === 0 ? 'Out of Stock' : `${inv} in stock`;

  return (
    <div className="product-card">
      {isAdmin && <div className="badge-admin-only">ADMIN</div>}

      {/* Image */}
      <div className="product-img-wrap">
        <img
          src={imageUrl}
          alt={product.name}
          className="product-img"
          onError={e => { e.target.src = `https://via.placeholder.com/200x200?text=${encodeURIComponent(product.name)}`; }}
        />
        <div className={`badge-stock ${stockClass}`}>{stockLabel}</div>
      </div>

      {/* Name */}
      <p className="product-name">{product.name}</p>

      {/* Rating */}
      {hasRating && (
        <div className="product-rating">
          <div className="rating-pill">
            ★ {avgRating.toFixed(1)}
          </div>
          <span className="rating-count">({ratingCount})</span>
        </div>
      )}

      {/* Description */}
      {product.description && (
        <p className="product-desc">{product.description}</p>
      )}

      {/* Pricing Table */}
      <div className="price-table">
        <div className="price-row">
          <span className="price-label">Unit Price</span>
          <span className="price-val">{formatINR(product.price)}</span>
        </div>
        <div className="price-row">
          <span className="price-label">Inventory</span>
          <span className="price-val blue">{inv} units</span>
        </div>
        <hr className="price-divider" />
        <div className="price-row">
          <span className="price-label">Total Value</span>
          <span className="price-val green">{formatINR(totalVal)}</span>
        </div>
      </div>

      {/* Delete — ADMIN ONLY */}
      {isAdmin && (
        <div className="admin-gate">
          <div className="admin-label">⚙️ Admin Action</div>
          <button
            className="btn-delete"
            onClick={() => onDeleteClick(product)}
          >
            🗑️ Delete Product
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
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

  useEffect(() => { fetchData(); }, []);

  const handleDeleteClick = (product) => {
    if (!isAdmin) return; // Strict guard — only admins can trigger this
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

  // Aggregate stats
  const totalProducts = Object.values(productsByCategory).reduce((s, arr) => s + arr.length, 0);
  const totalInventory = Object.values(productsByCategory)
    .flat().reduce((s, p) => s + (Number(p.inventory) || 0), 0);
  const totalValue = Object.values(productsByCategory)
    .flat().reduce((s, p) => s + (p.price * (Number(p.inventory) || 0)), 0);

  if (loading) {
    return (
      <>
        <style>{styles}</style>
        <div className="cat-loading">
          <div className="cat-spinner" />
          <p style={{ color: '#878787', fontSize: '14px', margin: 0 }}>Loading categories…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>

      <div className="cat-page">
        {/* ── Sticky Header ── */}
        <div className="cat-header">
          <div className="cat-header-left">
            <div className="cat-header-icon">🏷️</div>
            <div>
              <h2>Product Categories</h2>
              <p>{categories.length} categories • Browse by department</p>
            </div>
          </div>
          <div className="cat-stats-pill">
            <div className="stat-chip">📦 {totalProducts} products</div>
            <div className="stat-chip orange">{formatINR(totalValue)} total value</div>
          </div>
        </div>

        <div className="cat-body">
          {/* Summary Cards */}
          {categories.length > 0 && (
            <div className="cat-summary">
              <div className="summary-card" style={{ '--accent': '#2874f0' }}>
                <div className="summary-label">Total Categories</div>
                <div className="summary-value">{categories.length}</div>
                <div className="summary-sub">Active departments</div>
              </div>
              <div className="summary-card" style={{ '--accent': '#388e3c' }}>
                <div className="summary-label">Total Products</div>
                <div className="summary-value">{totalProducts}</div>
                <div className="summary-sub">Across all categories</div>
              </div>
              <div className="summary-card" style={{ '--accent': '#fb641b' }}>
                <div className="summary-label">Total Inventory</div>
                <div className="summary-value">{totalInventory.toLocaleString()}</div>
                <div className="summary-sub">Units in stock</div>
              </div>
              <div className="summary-card" style={{ '--accent': '#9c27b0' }}>
                <div className="summary-label">Portfolio Value</div>
                <div className="summary-value" style={{ fontSize: '16px', paddingTop: '3px' }}>{formatINR(totalValue)}</div>
                <div className="summary-sub">Total inventory value</div>
              </div>
            </div>
          )}

          {/* Admin notice */}
          {isAdmin && (
            <div className="admin-notice">
              🔐&nbsp;<strong>Admin Mode:</strong>&nbsp;You can delete products. Delete buttons are visible only to you.
            </div>
          )}

          {/* Category Sections */}
          {categories.length === 0 ? (
            <div className="no-categories">
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>🏷️</div>
              <h3 style={{ color: '#9e9e9e', fontWeight: '500', margin: '0 0 8px' }}>No categories found</h3>
              <p style={{ color: '#bdbdbd', fontSize: '13px', margin: 0 }}>Products will appear here once added.</p>
            </div>
          ) : (
            categories.map(category => {
              const meta = CATEGORY_META[category] || CATEGORY_META.other;
              const products = productsByCategory[category] || [];
              const catTotal = products.reduce((s, p) => s + p.price * (Number(p.inventory) || 0), 0);
              const catUnits = products.reduce((s, p) => s + (Number(p.inventory) || 0), 0);

              return (
                <div key={category} className="category-section">
                  {/* Category Header */}
                  <div
                    className="cat-section-header"
                    style={{ background: meta.gradient }}
                  >
                    <div className="cat-title-group">
                      <span className="cat-emoji">{meta.icon}</span>
                      <div>
                        <div className="cat-name">
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </div>
                        <div className="cat-meta">
                          {products.length} product{products.length !== 1 ? 's' : ''}&nbsp;•&nbsp;
                          {catUnits.toLocaleString()} units&nbsp;•&nbsp;
                          {formatINR(catTotal)} value
                        </div>
                      </div>
                    </div>
                    <div className="cat-badges">
                      <div className="cat-badge">
                        📦 {products.length}
                      </div>
                      <div className="cat-badge">
                        {formatINR(catTotal)}
                      </div>
                    </div>
                  </div>

                  {/* Products */}
                  {products.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📭</div>
                      <p className="empty-title">No products in this category yet</p>
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
      </div>

      {/* Delete Confirm Modal — only rendered when admin targets a product */}
      {isAdmin && deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          loading={deleteLoading}
          onConfirm={confirmDelete}
          onCancel={() => !deleteLoading && setDeleteTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}

export default Categories;