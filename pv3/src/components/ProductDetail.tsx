// ProductDetail.tsx - FIXED VERSION WITH 100% CSS ALIGNMENT
import React, { useState, useEffect } from 'react';
import { type Product, type ProductVariant } from './types';
import './ProductDetail.css';

interface ProductDetailProps {
  product: Product;
  onAddToCart: (productId: number, quantity: number, variantId?: number) => void;
  onClose: () => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  onAddToCart,
  onClose
}) => {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showVariantDropdown, setShowVariantDropdown] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Auto-select default variant on mount
  useEffect(() => {
    if (product.variants && product.variants.length > 0) {
      const defaultVariant = product.variants.find(v => v.is_default) || product.variants[0];
      setSelectedVariant(defaultVariant);
    }
  }, [product]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.variant-dropdown-wrapper')) {
        setShowVariantDropdown(false);
      }
    };

    if (showVariantDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showVariantDropdown]);

  // Get best image for detail view (prioritize larger images, with fallbacks)
  const getDetailImage = (): string => {
    return product.image_large_url ||
      product.image_medium_url ||
      product.image_url ||
      '/placeholder-product.jpg';
  };

  // Generate responsive image srcSet with fallbacks
  const getImageSrcSet = (): string => {
    const sources = [];

    // Use main image as fallback for all sizes if thumbnails don't exist
    const thumb = product.image_thumbnail_url || product.image_url;
    const medium = product.image_medium_url || product.image_url;
    const large = product.image_large_url || product.image_url;

    if (thumb) sources.push(`${thumb} 300w`);
    if (medium) sources.push(`${medium} 600w`);
    if (large) sources.push(`${large} 900w`);
    if (product.image_url) sources.push(`${product.image_url} 1200w`);

    return sources.join(', ');
  };

  const handleVariantSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setShowVariantDropdown(false);
  };

  const handleAddToCart = () => {
    // If product has variants but none are available
    if (product.has_variants && (!product.variants || product.variants.length === 0)) {
      alert('This product currently has no size options available. Please contact support.');
      return;
    }

    // If product has variants but none selected
    if (product.has_variants && product.variants && product.variants.length > 0 && !selectedVariant) {
      alert('Please select a size before adding to cart');
      return;
    }

    if (product.has_variants && selectedVariant) {
      onAddToCart(product.id, quantity, selectedVariant.id);
    } else {
      onAddToCart(product.id, quantity);
    }
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `KShs ${numPrice.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const currentPrice = selectedVariant?.price || product.base_price;

  // Get variant label based on category
  const getVariantLabel = () => {
    const categoryLower = product.category_name?.toLowerCase() || '';
    if (categoryLower.includes('cake')) return 'Cake Size:';
    if (categoryLower.includes('bread')) return 'Bread Size:';
    return 'Size:';
  };

  return (
    <div className="product-detail-overlay" onClick={onClose}>
      <div className="product-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="product-detail-content">
          {/* IMAGE SECTION */}
          <div className="product-detail-image-section">
            <div className="product-detail-image-container">
              <img
                src={getDetailImage()}
                alt={product.name}
                className={`product-detail-image ${imageLoaded ? 'loaded' : 'loading'}`}
                srcSet={getImageSrcSet()}
                sizes="(max-width: 768px) 100vw, 50vw"
                onLoad={() => setImageLoaded(true)}
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-product.jpg';
                  setImageLoaded(true);
                }}
                loading="lazy"
              />

              {!imageLoaded && (
                <div className="image-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading image...</p>
                </div>
              )}
            </div>
          </div>

          {/* INFO SECTION */}
          <div className="product-detail-info-section">
            <h1 className="product-detail-name">{product.name}</h1>
            <p className="product-detail-price">{formatPrice(currentPrice)}</p>

            {product.description && (
              <p className="product-description">{product.description}</p>
            )}

            {/* VARIANT SELECTOR - Matching Image 1 */}
            {product.has_variants && product.variants && product.variants.length > 0 && (
              <div className="variant-selector">
                <label className="variant-label">
                  {getVariantLabel()}
                </label>

                <div className="variant-dropdown-wrapper">
                  <button
                    className="variant-dropdown-trigger"
                    onClick={() => setShowVariantDropdown(!showVariantDropdown)}
                    aria-expanded={showVariantDropdown}
                    aria-haspopup="listbox"
                    type="button"
                  >
                    <span>{selectedVariant?.name || 'Choose an option'}</span>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      className={showVariantDropdown ? 'rotated' : ''}
                      aria-hidden="true"
                    >
                      <path
                        d="M5 7.5L10 12.5L15 7.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {showVariantDropdown && (
                    <div className="variant-dropdown-menu" role="listbox">
                      <div className="variant-dropdown-header">
                        <span>Choose an option</span>
                        <button
                          className="clear-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVariant(null);
                            setShowVariantDropdown(false);
                          }}
                          type="button"
                        >
                          × Clear
                        </button>
                      </div>

                      <div className="variant-options">
                        {product.variants
                          .filter(v => v.is_active)
                          .sort((a, b) => a.display_order - b.display_order)
                          .map((variant) => (
                            <button
                              key={variant.id}
                              type="button"
                              role="option"
                              aria-selected={selectedVariant?.id === variant.id}
                              className={`variant-option ${selectedVariant?.id === variant.id ? 'selected' : ''
                                } ${!variant.in_stock ? 'out-of-stock' : ''}`}
                              onClick={() => handleVariantSelect(variant)}
                              disabled={!variant.in_stock}
                            >
                              <span className="variant-option-name">{variant.name}</span>
                              {!variant.in_stock && (
                                <span className="out-of-stock-badge">Out of Stock</span>
                              )}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedVariant && (
                  <p className="variant-price-display">{formatPrice(selectedVariant.price)}</p>
                )}
              </div>
            )}

            {/* QUANTITY SECTION - ✅ FIXED CLASS NAMES */}
            <div className="quantity-section">
              <label className="quantity-label">Quantity:</label>
              <div className="quantity-controls">
                <button
                  className="quantity-btn minus"
                  onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  type="button"
                >
                  −
                </button>
                <input
                  type="number"
                  className="quantity-input"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val > 0) setQuantity(val);
                  }}
                  min="1"
                  aria-label="Quantity"
                />
                <button
                  className="quantity-btn plus"
                  onClick={() => setQuantity(prev => prev + 1)}
                  aria-label="Increase quantity"
                  type="button"
                >
                  +
                </button>
              </div>
            </div>

            {/* ADD TO CART BUTTON */}
            <button
              className="add-to-cart-main-btn"
              onClick={handleAddToCart}
              disabled={
                product.has_variants &&
                product.variants &&
                product.variants.length > 0 &&
                !selectedVariant
              }
              type="button"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.707 15.293C4.077 15.923 4.523 17 5.414 17H17M17 17C15.895 17 15 17.895 15 19C15 20.105 15.895 21 17 21C18.105 21 19 20.105 19 19C19 17.895 18.105 17 17 17ZM9 19C9 20.105 8.105 21 7 21C5.895 21 5 20.105 5 19C5 17.895 5.895 17 7 17C8.105 17 9 17.895 9 19Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {product.has_variants && (!product.variants || product.variants.length === 0)
                ? 'Contact for Availability'
                : `Add to Cart (${quantity})`
              }
            </button>

            {/* PRODUCT META */}
            {product.sku && <p className="product-sku">SKU: {product.sku}</p>}

            {product.tags && (
              <div className="product-tags">
                {product.tags.split(',').map((tag, index) => (
                  <span key={index} className="tag">{tag.trim()}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};