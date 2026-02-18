/**
 * Unsplash Image Service
 * Fetches high-quality, relevant images for products
 * Uses Unsplash API with fallback to placeholder images
 */

const UNSPLASH_ACCESS_KEY = 'YOUR_UNSPLASH_ACCESS_KEY'; // Replace with your Unsplash API key
const UNSPLASH_API_URL = 'https://api.unsplash.com';

class ImageService {
  constructor() {
    this.cache = new Map();
    this.useUnsplash = UNSPLASH_ACCESS_KEY && UNSPLASH_ACCESS_KEY !== 'YOUR_UNSPLASH_ACCESS_KEY';
  }

  /**
   * Get product image from Unsplash or fallback
   * @param {string} productName - Name of the product
   * @param {string} category - Product category
   * @param {number} width - Desired image width
   * @param {number} height - Desired image height
   * @returns {Promise<string>} - Image URL
   */
  async getProductImage(productName, category, width = 400, height = 300) {
    const cacheKey = `${productName}-${category}-${width}x${height}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let imageUrl;

    if (this.useUnsplash) {
      imageUrl = await this.fetchFromUnsplash(productName, category, width, height);
    } else {
      imageUrl = this.generatePlaceholder(productName, width, height);
    }

    // Cache the result
    this.cache.set(cacheKey, imageUrl);
    return imageUrl;
  }

  /**
   * Fetch image from Unsplash API
   */
  async fetchFromUnsplash(productName, category, width, height) {
    try {
      const query = this.buildSearchQuery(productName, category);
      const url = `${UNSPLASH_API_URL}/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
        }
      });

      if (!response.ok) {
        throw new Error('Unsplash API request failed');
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const photo = data.results[0];
        // Get optimized URL with specific dimensions
        return `${photo.urls.raw}&w=${width}&h=${height}&fit=crop&q=80`;
      }

      // Fallback if no results
      return this.generatePlaceholder(productName, width, height);
    } catch (error) {
      console.error('Error fetching from Unsplash:', error);
      return this.generatePlaceholder(productName, width, height);
    }
  }

  /**
   * Build search query for better image matching
   */
  buildSearchQuery(productName, category) {
    // Remove common words and numbers
    const cleanName = productName
      .toLowerCase()
      .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with)\b/gi, '')
      .replace(/\d+/g, '')
      .trim();

    // Combine product name and category for better results
    const query = category ? `${cleanName} ${category}` : cleanName;
    return query || 'product';
  }

  /**
   * Generate placeholder image using placeholder service
   */
  generatePlaceholder(text, width, height) {
    const bgColor = this.stringToColor(text);
    const textColor = this.getContrastColor(bgColor);
    const encodedText = encodeURIComponent(text.substring(0, 20));
    
    // Using placeholder.com service
    return `https://via.placeholder.com/${width}x${height}/${bgColor}/${textColor}?text=${encodedText}`;
  }

  /**
   * Convert string to consistent color
   */
  stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '00000'.substring(0, 6 - c.length) + c;
  }

  /**
   * Get contrasting text color for background
   */
  getContrastColor(hexColor) {
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '000000' : 'FFFFFF';
  }

  /**
   * Preload multiple images
   */
  async preloadImages(products) {
    const promises = products.map(product => 
      this.getProductImage(
        product.name,
        product.category,
        400,
        300
      )
    );
    
    return Promise.all(promises);
  }

  /**
   * Get random product image from Unsplash
   */
  async getRandomProductImage(category = 'product', width = 400, height = 300) {
    if (!this.useUnsplash) {
      return this.generatePlaceholder(category, width, height);
    }

    try {
      const url = `${UNSPLASH_API_URL}/photos/random?query=${encodeURIComponent(category)}&orientation=landscape`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
        }
      });

      if (!response.ok) {
        throw new Error('Unsplash API request failed');
      }

      const photo = await response.json();
      return `${photo.urls.raw}&w=${width}&h=${height}&fit=crop&q=80`;
    } catch (error) {
      console.error('Error fetching random image:', error);
      return this.generatePlaceholder(category, width, height);
    }
  }

  /**
   * Clear image cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export default new ImageService();

/**
 * React Hook for lazy loading images with Unsplash
 */
export const useProductImage = (productName, category, width = 400, height = 300) => {
  const [imageUrl, setImageUrl] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      try {
        setLoading(true);
        const url = await ImageService.getProductImage(productName, category, width, height);
        if (mounted) {
          setImageUrl(url);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
          setImageUrl(ImageService.generatePlaceholder(productName, width, height));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      mounted = false;
    };
  }, [productName, category, width, height]);

  return { imageUrl, loading, error };
};

/**
 * LazyImage Component with loading state
 */
export const LazyProductImage = ({ 
  productName, 
  category, 
  width = 400, 
  height = 300,
  alt,
  className = '',
  onLoad,
  onError
}) => {
  const { imageUrl, loading, error } = useProductImage(productName, category, width, height);

  return (
    <div className={`lazy-image-container ${className}`} style={{ width, height }}>
      {loading && (
        <div className="lazy-image-skeleton" style={{ width, height }}>
          <div className="lazy-image-spinner" />
        </div>
      )}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={alt || productName}
          loading="lazy"
          onLoad={onLoad}
          onError={onError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: loading ? 'none' : 'block'
          }}
        />
      )}
      {error && (
        <div className="lazy-image-error" style={{ width, height }}>
          Failed to load image
        </div>
      )}
    </div>
  );
};

// CSS for lazy loading (add to your CSS file)
const lazyImageStyles = `
.lazy-image-container {
  position: relative;
  overflow: hidden;
  background-color: #f0f0f0;
}

.lazy-image-skeleton {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

.lazy-image-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.lazy-image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ffebee;
  color: #c62828;
  font-size: 14px;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes spin {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}
`;
