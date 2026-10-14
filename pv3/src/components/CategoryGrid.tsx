// CategoryGrid.tsx - FINAL TYPE-SAFE DEBUGGED VERSION
import React from 'react';
import type { Category } from '../components/types';
import './CategoryGrid.css';

interface CategoryGridProps {
    categories: Category[];
    onCategoryClick: (categorySlug: string) => void;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({
    categories,
    onCategoryClick
}) => {
    // 🔍 DEBUG 1: Test image accessibility BEFORE rendering
    React.useEffect(() => {
        console.group('🔍 IMAGE ACCESSIBILITY PRE-TEST');

        categories.forEach(cat => {
            const imageUrl = cat.image_url; // This is string | null

            if (imageUrl) { // TypeScript knows imageUrl is string here
                console.log(`📊 ${cat.name}:`, {
                    image_url: imageUrl,
                    is_full_url: imageUrl.startsWith('http'),
                    is_localhost: imageUrl.includes('localhost:8000'),
                    length: imageUrl.length
                });

                // Pre-test image loading
                const testImg = new Image();
                testImg.onload = () => {
                    console.log(`✅ ${cat.name}: Image is accessible at ${imageUrl}`);
                };
                testImg.onerror = () => {
                    console.error(`❌ ${cat.name}: Cannot access image at ${imageUrl}`);
                };
                testImg.src = imageUrl;
            } else {
                console.warn(`⚠️ ${cat.name}: No image_url provided (null/undefined)`);
            }
        });

        console.groupEnd();
    }, [categories]);

    // 🔍 DEBUG 2: Individual image handlers
    const handleImageError = (
        e: React.SyntheticEvent<HTMLImageElement>,
        categoryName: string,
        imageUrl: string // Changed to string, not string | null
    ) => {
        console.error(`❌ IMAGE ERROR for ${categoryName}:`, {
            attempted_url: imageUrl,
            element_src: e.currentTarget.src,
            current_time: new Date().toISOString(),
            is_same_url: e.currentTarget.src === imageUrl
        });

        e.currentTarget.onerror = null; // Prevent infinite loop
        e.currentTarget.src = '/placeholder.svg';
    };

    const handleImageLoad = (categoryName: string, imageUrl: string) => {
        console.log(`✅ IMAGE LOADED for ${categoryName}:`, {
            url: imageUrl,
            loaded_at: new Date().toISOString()
        });
    };

    // Helper to safely get image URL
    const getSafeImageUrl = (imageUrl: string | null): string => {
        // If we have a valid image URL from API, use it
        if (imageUrl && imageUrl.trim() !== '') {
            return imageUrl;
        }
        // Otherwise use placeholder
        return '/placeholder.svg';
    };

    if (categories.length === 0) {
        return (
            <div className="no-categories">
                <p>No categories available</p>
            </div>
        );
    }

    return (
        <div className="category-grid">
            {categories.map((category) => {
                // 🔍 DEBUG 3: Get safe image URL
                const safeImageUrl = getSafeImageUrl(category.image_url);

                console.log(`🎯 Rendering ${category.name}:`, {
                    original_image_url: category.image_url,
                    safe_image_url: safeImageUrl,
                    is_placeholder: safeImageUrl === '/placeholder.svg'
                });

                return (
                    <div
                        key={category.id}
                        className="category-card"
                        onClick={() => onCategoryClick(category.slug)}
                    >
                        <div className="category-image-container">
                            {/* ✅ FIXED: Use safeImageUrl which is always string */}
                            <img
                                src={safeImageUrl}
                                alt={category.name}
                                className="category-image"
                                onError={(e) => handleImageError(e, category.name, safeImageUrl)}
                                onLoad={() => handleImageLoad(category.name, safeImageUrl)}
                                loading="lazy"
                            />
                            <div className="category-overlay">
                                <h3 className="category-name">{category.name}</h3>
                                <span className="category-count">
                                    {category.product_count} items
                                </span>
                            </div>
                        </div>
                        <div className="category-content">
                            <h3 className="category-title">{category.name}</h3>
                            <p className="category-description">
                                {category.description || 'Explore our delicious selection'}
                            </p>
                            <button className="category-button">Browse Items</button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default CategoryGrid;