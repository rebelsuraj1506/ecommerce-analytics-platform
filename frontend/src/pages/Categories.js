import React, { useState, useEffect } from 'react';

function Categories({ token }) {
  const [categories, setCategories] = useState([]);
  const [productsByCategory, setProductsByCategory] = useState({});
  const [loading, setLoading] = useState(true);

  const categoryIcons = {
    electronics: '💻',
    clothing: '👕',
    books: '📚',
    home: '🏠',
    sports: '⚽',
    toys: '🧸',
    other: '📦'
  };

  const categoryColors = {
    electronics: '#2874f0',
    clothing: '#ff6161',
    books: '#388e3c',
    home: '#ff9800',
    sports: '#9c27b0',
    toys: '#00bcd4',
    other: '#757575'
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const categoriesRes = await fetch('http://localhost:8002/api/categories');
        const categoriesData = await categoriesRes.json();
        const categoryList = categoriesData.data?.categories || [];
        setCategories(categoryList);

        const productsRes = await fetch('http://localhost:8002/api/products?limit=100');
        const productsData = await productsRes.json();
        const allProducts = productsData.data?.products || [];

        const grouped = {};
        categoryList.forEach(cat => {
          grouped[cat] = allProducts.filter(p => p.category === cat);
        });
        setProductsByCategory(grouped);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const deleteProduct = async (productId, productName) => {
    if (!window.confirm(`Delete "${productName}"?`)) return;
    try {
      const res = await fetch(`http://localhost:8002/api/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Product deleted!');
        window.location.reload();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (loading) {
    return <div style={{textAlign: 'center', padding: '40px', background: '#f1f3f6', minHeight: '100vh'}}>
      <div style={{fontSize: '48px', marginBottom: '20px'}}>⏳</div>
      <div style={{color: '#757575'}}>Loading categories...</div>
    </div>;
  }

  return (
    <div style={{background: '#f1f3f6', minHeight: '100vh', padding: '20px'}}>
      <div style={{maxWidth: '1400px', margin: '0 auto'}}>
        <div style={{background: 'white', padding: '20px 30px', borderRadius: '2px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
          <h2 style={{margin: 0, color: '#212121', fontSize: '24px', fontWeight: '500'}}>🏷️ Product Categories</h2>
        </div>

        {categories.map(category => {
          const products = productsByCategory[category] || [];
          const totalValue = products.reduce((sum, p) => sum + (p.price * p.inventory), 0);
          const totalUnits = products.reduce((sum, p) => sum + p.inventory, 0);
          const color = categoryColors[category] || '#757575';
          
          return (
            <div key={category} style={{marginBottom: '30px'}}>
              <div style={{
                background: `linear-gradient(135deg, ${color}dd 0%, ${color} 100%)`,
                color: 'white',
                padding: '20px 25px',
                borderRadius: '4px 4px 0 0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                    <span style={{fontSize: '2.5em'}}>{categoryIcons[category] || '📦'}</span>
                    <div>
                      <h3 style={{margin: 0, fontSize: '1.5em', fontWeight: '500'}}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </h3>
                      <div style={{fontSize: '0.9em', opacity: 0.9, marginTop: '5px'}}>
                        {products.length} products • {totalUnits} units • ₹{totalValue.toFixed(2)} total value
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {products.length === 0 ? (
                <div style={{
                  background: 'white',
                  padding: '40px',
                  textAlign: 'center',
                  borderRadius: '0 0 4px 4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                }}>
                  <div style={{fontSize: '48px', marginBottom: '15px'}}>📭</div>
                  <div style={{color: '#757575', fontSize: '14px'}}>No products in this category yet</div>
                </div>
              ) : (
                <div style={{
                  background: 'white',
                  borderRadius: '0 0 4px 4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                  padding: '0'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '1px',
                    background: '#f0f0f0'
                  }}>
                    {products.map(product => {
                      const inv = Number(product.inventory) || 0;
                      const totalValue = product.price * inv;
                      const imageUrl = product.images?.[0] || 'https://via.placeholder.com/200x200?text=No+Image';
                      
                      return (
                        <div key={product._id} style={{background: 'white', padding: '15px'}}>
                          <div style={{position: 'relative', paddingTop: '100%', background: '#fafafa', borderRadius: '4px', marginBottom: '12px'}}>
                            <img 
                              src={imageUrl}
                              alt={product.name}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                padding: '15px'
                              }}
                            />
                            {(inv > 0 ? (
                              <div style={{
                                position: 'absolute',
                                bottom: '8px',
                                left: '8px',
                                background: inv > 20 ? '#388e3c' : '#ff9800',
                                color: 'white',
                                padding: '3px 8px',
                                borderRadius: '2px',
                                fontSize: '10px',
                                fontWeight: '500'
                              }}>
                                {inv} units
                              </div>
                            ) : (
                              <div 
                                style={{
                                  position: 'absolute',
                                  bottom: '8px',
                                  left: '8px',
                                  background: '#757575',
                                  color: 'white',
                                  padding: '3px 8px',
                                  borderRadius: '2px',
                                  fontSize: '10px',
                                  fontWeight: '500'
                                }}
                                title="Will be back soon"
                              >
                                Sold out
                              </div>
                            ))}
                          </div>

                          <h4 style={{
                            margin: '0 0 8px 0',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#212121',
                            height: '32px',
                            overflow: 'hidden',
                            lineHeight: '1.3'
                          }}>
                            {product.name}
                          </h4>
                          {(product.rating?.count > 0 || (product.reviews && product.reviews.length > 0)) && (
                            <div style={{fontSize: '11px', color: '#ff9800', marginBottom: '6px'}}>★ {(product.rating?.average ?? 0).toFixed(1)} ({product.rating?.count ?? product.reviews?.length ?? 0} reviews)</div>
                          )}
                          <div style={{fontSize: '11px', color: '#757575', marginBottom: '10px', height: '30px', overflow: 'hidden'}}>
                            {product.description}
                          </div>

                          <div style={{borderTop: '1px solid #f0f0f0', paddingTop: '10px', marginBottom: '10px'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px'}}>
                              <span style={{color: '#757575'}}>Unit Price:</span>
                              <strong style={{color: '#212121'}}>₹{product.price?.toFixed(2)}</strong>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px'}}>
                              <span style={{color: '#757575'}}>Inventory:</span>
                              <strong style={{color: '#2874f0'}}>{inv}</strong>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px dashed #f0f0f0', fontSize: '12px'}}>
                              <span style={{color: '#757575'}}>Total:</span>
                              <strong style={{color: '#388e3c'}}>₹{totalValue.toFixed(2)}</strong>
                            </div>
                          </div>

                          <button 
                            onClick={() => deleteProduct(product._id, product.name)}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {categories.length === 0 && (
          <div style={{background: 'white', padding: '60px', textAlign: 'center', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)'}}>
            <div style={{fontSize: '48px', marginBottom: '20px'}}>🏷️</div>
            <h3 style={{color: '#757575', fontWeight: '400'}}>No categories found</h3>
          </div>
        )}
      </div>
    </div>
  );
}

export default Categories;