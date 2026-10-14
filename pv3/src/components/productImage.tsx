// src/components/ProductImage.tsx
import React, { useState, useEffect } from 'react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

const ProductImage: React.FC<ProductImageProps> = ({ 
  src, 
  alt, 
  className = 'w-12 h-12 object-cover rounded-lg' 
}) => {
  const [hasError, setHasError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setImageUrl(null);
      setHasError(false);
      return;
    }

    // ✅ Convert relative URL to absolute URL
    let fullUrl = src;
    if (src.startsWith('/')) {
      // Use the backend API URL from environment variables
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      fullUrl = `${apiUrl}${src}`;
    }
    
    console.log('🖼️ ProductImage - Loading:', fullUrl);
    setImageUrl(fullUrl);
    setHasError(false);
  }, [src]);

  // Show fallback if no image URL or error
  if (!imageUrl || hasError) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center text-2xl`}>
        🍰
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => {
        console.log('❌ Image failed to load:', imageUrl);
        setHasError(true);
      }}
      onLoad={() => console.log('✅ Image loaded:', imageUrl)}
    />
  );
};

export default ProductImage;