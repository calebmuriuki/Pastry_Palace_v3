// BakeryShop.tsx - COMPLETE FIX FOR 403 ERROR
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CategoryGrid } from './CategoryGrid';
import ProductCard from './ProductCard';
import { ProductDetail } from './ProductDetail';
import PageLayout from './PageLayout';
import type { Category, Product, ApiResponse } from './types';
import { useCart } from '../Contexts/CartContext';
import './BakeryShop.css'

// Constants
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const BASE_URL = API_BASE_URL.replace('/api', '');

// ✅ CRITICAL FIX: Add CSRF token getter
const getCSRFToken = (): string => {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
};

// Enhanced Image Normalization
const normalizeImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl) return '/placeholder-product.jpg';
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  if (imageUrl.startsWith('/')) {
    return `${BASE_URL}${imageUrl}`;
  }
  return `${BASE_URL}/media/${imageUrl}`;
};

const normalizeProductImages = (product: any): Product => {
  return {
    ...product,
    image: normalizeImageUrl(product.image),
    image_thumbnail: normalizeImageUrl(product.image_thumbnail),
    image_medium: normalizeImageUrl(product.image_medium),
    image_large: normalizeImageUrl(product.image_large),
    base_price: normalizePrice(product.base_price),
  };
};

const normalizePrice = (price: string | number | undefined): number => {
  if (typeof price === 'string') return parseFloat(price) || 0;
  if (typeof price === 'number') return price;
  return 0;
};

// ✅ FIXED API Service with CSRF token
const api = {
  // ✅ NEW: Initialize CSRF token on first load
  async initializeSession(): Promise<void> {
    try {
      console.log('🔐 Initializing session and CSRF token...');
      const response = await fetch(`${API_BASE_URL}/get-csrf/`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Session initialized:', {
          csrfToken: data.csrfToken?.substring(0, 10) + '...',
          sessionKey: data.sessionKey
        });
      }
    } catch (error) {
      console.error('❌ Failed to initialize session:', error);
    }
  },

  async getCategories(): Promise<Category[]> {
    try {
      console.log('🔍 Fetching categories from:', `${API_BASE_URL}/categories/`);
      const response = await fetch(`${API_BASE_URL}/categories/`, {
        credentials: 'include', // ✅ Important for session
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Categories HTTP error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: Failed to fetch categories`);
      }

      const responseData: ApiResponse = await response.json();
      let categoriesArray: any[];

      if (Array.isArray(responseData.results)) {
        categoriesArray = responseData.results;
      } else if (Array.isArray(responseData)) {
        categoriesArray = responseData;
      } else if (responseData.data && Array.isArray(responseData.data)) {
        categoriesArray = responseData.data;
      } else {
        const arrayKeys = Object.keys(responseData).filter(key => Array.isArray(responseData[key]));
        if (arrayKeys.length > 0) {
          categoriesArray = responseData[arrayKeys[0]];
        } else {
          throw new Error('API response does not contain categories array');
        }
      }

      const transformedCategories = categoriesArray.map((cat: any): Category => ({
        id: cat.id,
        name: cat.name,
        display_name: cat.display_name || cat.name,
        slug: cat.slug,
        image_url: cat.image_url || null,
        category_type: cat.category_type || 'default',
        description: cat.description || '',
        product_count: cat.menu_count || 0,
        display_order: cat.display_order || 0,
        is_active: cat.is_active !== false,
        created_at: cat.created_at || new Date().toISOString(),
        updated_at: cat.updated_at || cat.created_at || new Date().toISOString(),
      }));

      console.log(`✅ Successfully transformed ${transformedCategories.length} categories`);
      return transformedCategories;

    } catch (error) {
      console.error('❌ Categories API error:', error);
      throw error instanceof Error ? error : new Error('Unknown error fetching categories');
    }
  },

  async getProducts(categorySlug?: string): Promise<Product[]> {
    try {
      const url = categorySlug
        ? `${API_BASE_URL}/products/?category=${categorySlug}`
        : `${API_BASE_URL}/products/`;

      console.log('🔍 Fetching products from:', url);
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const data = await response.json();
      const productsArray = data.results || data || [];

      console.log(`📦 Fetched ${productsArray.length} products`);
      return productsArray.map((prod: any) => normalizeProductImages(prod));

    } catch (error) {
      console.error('❌ Products API error:', error);
      throw error;
    }
  },

  async getProduct(slug: string): Promise<Product> {
    try {
      console.log('🔍 Fetching product details:', slug);
      const response = await fetch(`${API_BASE_URL}/products/${slug}/`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.status}`);
      }

      const prod = await response.json();
      return normalizeProductImages(prod);

    } catch (error) {
      console.error('❌ Product API error:', error);
      throw error;
    }
  },

  // ✅ CRITICAL FIX: Add CSRF token to cart request
  async addToCart(productId: number, quantity: number, variantId?: number) {
    try {
      console.log('🛒 Adding to cart:', { productId, quantity, variantId });

      // ✅ Get CSRF token
      const csrfToken = getCSRFToken();
      console.log('🔐 CSRF Token:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'NOT FOUND');

      // ✅ If no CSRF token, try to get it first
      if (!csrfToken) {
        console.warn('⚠️ No CSRF token found, initializing session...');
        await this.initializeSession();
        const newToken = getCSRFToken();
        if (!newToken) {
          throw new Error('Could not obtain CSRF token');
        }
      }

      const response = await fetch(`${API_BASE_URL}/cart/add/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCSRFToken(), // ✅ CRITICAL: Add CSRF token
        },
        credentials: 'include', // ✅ Important for session cookies
        body: JSON.stringify({
          product_id: productId,
          variant_id: variantId,
          quantity: quantity,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Cart API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });

        // ✅ Better error messages
        if (response.status === 403) {
          throw new Error('Permission denied. Please refresh the page and try again.');
        }

        throw new Error(errorData.message || 'Failed to add to cart');
      }

      const result = await response.json();
      console.log('✅ Cart updated:', result);
      return result;

    } catch (error) {
      console.error('❌ Add to cart error:', error);
      throw error;
    }
  },
};

// Main Component
export const BakeryShop: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const { getTotalItems, addToCart } = useCart();
  const cartCount = getTotalItems();

  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const currentCategory = useMemo(() =>
    categories.find(c => c.slug === selectedCategory)?.name || selectedCategory,
    [categories, selectedCategory]
  );

  // ✅ CRITICAL: Initialize session on app load
  useEffect(() => {
    const initialize = async () => {
      await api.initializeSession();
      loadCategories();
    };
    initialize();
  }, []); // Run once on mount

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCategories();
      setCategories(data);
      console.log('✅ Categories loaded:', data.length);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load categories: ${errorMessage}`);
      console.error('Load categories error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async (categorySlug: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProducts(categorySlug);
      setProducts(data);
      console.log('✅ Products loaded:', data.length);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load products: ${errorMessage}`);
      console.error('Load products error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadProducts(selectedCategory);
    }
  }, [selectedCategory, loadProducts]);

  const handleCategoryClick = useCallback((categorySlug: string) => {
    console.log('📂 Category clicked:', categorySlug);
    setSelectedCategory(categorySlug);
    setSelectedProduct(null);
  }, []);

  const handleBackToCategories = useCallback(() => {
    console.log('⬅️ Back to categories');
    setSelectedCategory(null);
    setProducts([]);
    setSelectedProduct(null);
  }, []);

  const handleProductClick = useCallback(async (productSlug: string) => {
    try {
      console.log('🔍 Loading product details:', productSlug);
      const product = await api.getProduct(productSlug);
      setSelectedProduct(product);
      console.log('✅ Product detail loaded:', product.name);
    } catch (err) {
      console.error('Failed to load product details:', err);
      showNotification('❌ Failed to load product details');
    }
  }, [showNotification]);

  const handleAddToCart = useCallback(
    async (productId: number, quantity: number, variantId?: number) => {
      try {
        // 1. Persist to backend
        await api.addToCart(productId, quantity, variantId);

        // 2. Find product
        const productToAdd = selectedProduct || products.find(p => p.id === productId);
        if (!productToAdd) {
          throw new Error('Product not found');
        }

        // 3. Find variant
        const selectedVariant = variantId
          ? productToAdd.variants?.find(v => v.id === variantId)
          : null;

        // 4. Update frontend cart
        addToCart(
          {
            id: productId,
            name: selectedVariant
              ? `${productToAdd.name} - ${selectedVariant.name}`
              : productToAdd.name,
            price: selectedVariant
              ? normalizePrice(selectedVariant.price)
              : normalizePrice(productToAdd.base_price),
            image: productToAdd.image_url || "/placeholder-product.jpg",
            variantId: variantId,
            variantName: selectedVariant?.name,
          },
          quantity
        );

        showNotification(`✅ Added ${quantity} item(s) to cart successfully!`);
        setSelectedProduct(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add to cart";
        console.error("Add to cart error:", err);
        showNotification(`❌ ${message}`);
      }
    },
    [selectedProduct, products, addToCart, showNotification]
  );

  const handleAddToCartForCard = useCallback((id: number, quantity: number) => {
    console.log('🛒 Adding to cart from ProductCard:', { id, quantity });

    if (isNaN(id)) {
      console.error('Invalid product ID:', id);
      showNotification('❌ Invalid product');
      return;
    }

    const product = products.find(p => p.id === id);
    if (!product) {
      showNotification('❌ Product not found');
      return;
    }

    // Optimistic update
    addToCart(
      {
        id: id,
        name: product.name,
        price: normalizePrice(product.base_price),
        image: product.image_url || "/placeholder-product.svg",
      },
      quantity
    );

    // Backend sync
    handleAddToCart(id, quantity).catch(err => {
      console.error('Backend cart sync failed:', err);
    });
  }, [products, addToCart, handleAddToCart, showNotification]);

  // Loading State
  if (loading && categories.length === 0) {
    return (
      <PageLayout cartCount={cartCount}>
        <div className="bakery-shop">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading delicious treats...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Error State
  if (error) {
    return (
      <PageLayout cartCount={cartCount}>
        <div className="bakery-shop">
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={loadCategories} className="retry-btn">
              🔄 Try Again
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Main Render
  return (
    <PageLayout cartCount={cartCount}>
      <div className="bakery-shop">
        {notification && (
          <div className="notification-toast">
            {notification}
          </div>
        )}

        <main className="shop-content">
          {!selectedCategory ? (
            <>
              <h2 className="section-title">Browse Our Collections</h2>
              <CategoryGrid
                categories={categories}
                onCategoryClick={handleCategoryClick}
              />
            </>
          ) : (
            <>
              <div className="breadcrumb">
                <button
                  onClick={handleBackToCategories}
                  className="back-btn"
                  type="button"
                >
                  ← Back to Categories
                </button>
                <span className="current-category">{currentCategory}</span>
              </div>

              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading products...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="empty-state">
                  <p>No products found in this category.</p>
                </div>
              ) : (
                <div className="products-grid">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      slug={product.slug}
                      name={product.name}
                      price={normalizePrice(product.base_price)}
                      image_url={product.image_thumbnail_url || product.image_url || '/placeholder-product.jpg'}
                      hasVariants={product.has_variants}
                      variantCount={product.variants?.length || 0}
                      onAddToCart={handleAddToCartForCard}
                      onProductClick={handleProductClick}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        {selectedProduct && (
          <ProductDetail
            product={selectedProduct}
            onAddToCart={handleAddToCart}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default BakeryShop;