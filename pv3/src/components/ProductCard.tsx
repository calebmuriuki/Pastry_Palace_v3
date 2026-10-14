// ProductCard.tsx - FINAL OPTIMIZED VERSION WITH IMAGE 2 DESIGN
import { useState } from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "./ui/button";

interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  //image_url: string;
  image_url: string | null;
  slug: string;                     // ✅ ADD: Product slug for proper API call
  onAddToCart: (id: number, quantity: number) => void;
  onProductClick?: (slug: string) => void;  // ✅ FIX: Should pass slug, not id
  hasVariants?: boolean;
  variantCount?: number;
}

const ProductCard = ({
  id,
  name,
  price,
  image_url,
  slug,                              // ✅ ADD: Destructure slug
  onAddToCart,
  onProductClick,
  hasVariants = false,
  variantCount = 0
}: ProductCardProps) => {
  const [quantity, setQuantity] = useState(1);
  const [imageError, setImageError] = useState(false);

  const handleIncrement = () => {
    if (quantity < 10) setQuantity(quantity + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If product has variants, open detail modal instead of direct add
    if (hasVariants && onProductClick && slug) {
      console.log('🔍 Opening product detail for slug:', slug);
      onProductClick(slug);  // ✅ FIX: Pass slug instead of id
    } else {
      onAddToCart(id, quantity);
    }
  };

  const handleCardClick = () => {
    if (onProductClick && slug) {
      console.log('🔍 Card clicked, opening detail for slug:', slug);
      onProductClick(slug);  // ✅ FIX: Pass slug instead of id
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!imageError) {
      setImageError(true);
      e.currentTarget.src = '/placeholder-product.svg';
    }
  };

  return (
    <div
      className="bg-white rounded-3xl shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer overflow-hidden group"
      onClick={handleCardClick}
      role="article"
      aria-label={`${name} product card`}
    >
      {/* Image Container - Optimized for Image 2 design */}
      <div className="w-full h-[240px] overflow-hidden bg-gradient-to-br from-pink-50 to-purple-50 relative">
        <img
          src={image_url || '/placeholder-product.svg'}
          alt={name || 'Product Image'}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          onError={handleImageError}
          loading="lazy"
        />

        {/* Variant Badge - Top Right Corner */}
        {hasVariants && variantCount > 0 && (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-pink-600 to-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
            {variantCount} {variantCount === 1 ? 'size' : 'sizes'}
          </div>
        )}

        {/* Hover Overlay Effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Content Container - Matching Image 2 Pink Theme */}
      <div className="p-5">
        {/* Title */}
        <h3 className="text-lg font-bold mb-2 text-gray-900 line-clamp-2 min-h-[3.5rem] group-hover:text-pink-600 transition-colors">
          {name}
        </h3>

        {/* Price Display - Enhanced with "From" for variants */}
        <div className="mb-4">
          <p className="text-2xl font-extrabold text-pink-600">
            {hasVariants && <span className="text-sm font-medium text-gray-500 mr-1">From</span>}
            Ksh{price.toLocaleString('en-KE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </p>
        </div>

        {/* Conditional: Quantity Controls OR Select Button */}
        {!hasVariants ? (
          <>
            {/* Quantity Controls - Pink Theme Matching Image 2 */}
            <div className="flex items-center justify-center gap-3 mb-4 bg-pink-50 rounded-2xl py-3 px-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDecrement();
                }}
                disabled={quantity <= 1}
                className="w-10 h-10 rounded-full bg-white hover:bg-pink-100 flex items-center justify-center border-2 border-pink-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95"
                type="button"
                aria-label="Decrease quantity"
              >
                <Minus className="w-5 h-5 text-pink-600" strokeWidth={3} />
              </button>

              <div className="flex items-center justify-center min-w-[3rem]">
                <span className="text-2xl font-bold text-gray-900">
                  {quantity}
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleIncrement();
                }}
                disabled={quantity >= 10}
                className="w-10 h-10 rounded-full bg-white hover:bg-pink-100 flex items-center justify-center border-2 border-pink-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95"
                type="button"
                aria-label="Increase quantity"
              >
                <Plus className="w-5 h-5 text-pink-600" strokeWidth={3} />
              </button>
            </div>

            {/* Add to Cart Button - Matching Image 2 Style */}
            <Button
              onClick={handleAddToCart}
              className="w-full h-12 bg-gradient-to-r from-pink-500 via-pink-600 to-pink-500 hover:from-pink-600 hover:via-pink-700 hover:to-pink-600 text-white rounded-2xl font-bold text-base shadow-lg hover:shadow-xl transition-all active:scale-95 border-0"
              type="button"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Add to Cart
            </Button>
          </>
        ) : (
          <>
            {/* Info Badge for Variant Products */}
            <div className="text-center mb-4 py-3 px-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl border-2 border-pink-100">
              <p className="text-sm text-pink-700 font-semibold flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-pink-600">
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Multiple sizes available
              </p>
            </div>

            {/* Select Options Button - Matching Image 2 Style */}
            <Button
              onClick={handleAddToCart}
              className="w-full h-12 bg-gradient-to-r from-pink-500 via-pink-600 to-pink-500 hover:from-pink-600 hover:via-pink-700 hover:to-pink-600 text-white rounded-2xl font-bold text-base shadow-lg hover:shadow-xl transition-all active:scale-95 border-0"
              type="button"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Select Options
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProductCard;