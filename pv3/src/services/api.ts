import type { Category, Product } from '../components/types';

// FIXED API SERVICE - Extracted from BakeryShop.tsx

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const BASE_URL = API_BASE_URL.replace('/api', ''); // For absolute image URLs

// Helper function to normalize image URLs
export const normalizeImageUrl = (imageUrl: string | null | undefined): string => {
    if (!imageUrl) return '/placeholder-product.jpg';

    // If it's already an absolute URL (starts with http:// or https://), return as-is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }

    // If it's a relative URL starting with /, prepend BASE_URL
    if (imageUrl.startsWith('/')) {
        return `${BASE_URL}${imageUrl}`;
    }

    // Otherwise, assume it needs the full base URL + /media/ prefix
    return `${BASE_URL}/media/${imageUrl}`;
};

export const api = {
    async getCategories(): Promise<Category[]> {
        try {
            console.log('🔍 Fetching categories from:', `${API_BASE_URL}/categories/`);
            const response = await fetch(`${API_BASE_URL}/categories/`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Categories HTTP error:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: Failed to fetch categories`);
            }

            const responseData = await response.json();
            console.log('📦 Raw API response:', responseData);

            // Extract categories from DRF paginated response
            let categoriesArray: any[];

            if (responseData && typeof responseData === 'object') {
                if (Array.isArray(responseData.results)) {
                    categoriesArray = responseData.results;
                    console.log(`✅ Found ${responseData.count} categories in paginated results`);
                } else if (Array.isArray(responseData)) {
                    categoriesArray = responseData;
                    console.log(`✅ Found ${responseData.length} categories in direct array`);
                } else if (responseData.data && Array.isArray(responseData.data)) {
                    categoriesArray = responseData.data;
                    console.log(`✅ Found ${responseData.data.length} categories in data field`);
                } else {
                    const arrayKeys = Object.keys(responseData).filter(key => Array.isArray(responseData[key]));
                    if (arrayKeys.length > 0) {
                        categoriesArray = responseData[arrayKeys[0]];
                        console.log(`⚠️ Using array from key "${arrayKeys[0]}":`, categoriesArray.length);
                    } else {
                        console.error('❌ No array found in response:', responseData);
                        throw new Error('API response does not contain categories array');
                    }
                }
            } else {
                console.error('❌ Invalid response format:', responseData);
                throw new Error('Invalid API response format');
            }

            if (!Array.isArray(categoriesArray)) {
                console.error('❌ categoriesArray is not an array:', categoriesArray);
                throw new Error('Categories data is not an array');
            }

            console.log(`✅ Processing ${categoriesArray.length} categories`);

            const transformedCategories = categoriesArray.map((cat: any): Category => {
                const imageUrl = normalizeImageUrl(cat.image);
                // console.log('Category image URL:', cat.name, '→', imageUrl);

                return {
                    id: cat.id,
                    name: cat.name,
                    display_name: cat.name,
                    slug: cat.slug,
                    image_url: imageUrl,
                    category_type: 'default',
                    description: cat.description || '',
                    product_count: cat.menu_count || 0,
                    display_order: cat.display_order || 0,
                    is_active: cat.is_active !== false,
                    created_at: cat.created_at || new Date().toISOString(),
                    updated_at: cat.updated_at || cat.created_at || new Date().toISOString(),
                };
            });

            console.log(`✅ Successfully transformed ${transformedCategories.length} categories`);

            return transformedCategories;

        } catch (error) {
            console.error('❌ Categories API error:', error);
            if (error instanceof Error) {
                throw new Error(`Failed to fetch categories: ${error.message}`);
            }
            throw new Error('Unknown error fetching categories');
        }
    },

    async getProducts(categorySlug?: string): Promise<Product[]> {
        try {
            const url = categorySlug
                ? `${API_BASE_URL}/products/?category=${categorySlug}`
                : `${API_BASE_URL}/products/`;

            console.log('🔍 Fetching products from:', url);
            const response = await fetch(url);

            if (!response.ok) throw new Error(`Failed to fetch products: ${response.status}`);

            const data = await response.json();
            const productsArray = data.results || data || [];

            console.log(`📦 Fetched ${productsArray.length} products`);

            // Transform products with normalized image URLs
            const transformedProducts = productsArray.map((prod: any) => {
                const imageUrl = normalizeImageUrl(prod.image);
                // console.log('Product image URL:', prod.name, '→', imageUrl);

                return {
                    ...prod,
                    image: imageUrl,
                    base_price: typeof prod.base_price === 'string'
                        ? parseFloat(prod.base_price)
                        : (prod.base_price || 0),
                    // Ensure variants are handled if present, or defaults
                    variants: prod.variants || [],
                    has_variants: prod.has_variants || (prod.variants && prod.variants.length > 0) || false,
                };
            });

            return transformedProducts;

        } catch (error) {
            console.error('❌ Products API error:', error);
            throw error;
        }
    },

    async getProduct(slug: string): Promise<Product> {
        try {
            const response = await fetch(`${API_BASE_URL}/products/${slug}/`);
            if (!response.ok) throw new Error(`Failed to fetch product: ${response.status}`);

            const prod = await response.json();
            const imageUrl = normalizeImageUrl(prod.image);

            return {
                ...prod,
                image: imageUrl,
                base_price: typeof prod.base_price === 'string'
                    ? parseFloat(prod.base_price)
                    : (prod.base_price || 0),
                variants: prod.variants || [],
                has_variants: prod.has_variants || (prod.variants && prod.variants.length > 0) || false,
            };
        } catch (error) {
            console.error('❌ Product API error:', error);
            throw error;
        }
    },

    async addToCart(productId: number, quantity: number, variantId?: number) {
        try {
            const response = await fetch(`${API_BASE_URL}/cart/add/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    product_id: productId,
                    variant_id: variantId,
                    quantity: quantity,
                }),
            });
            if (!response.ok) throw new Error('Failed to add to cart');
            return response.json();
        } catch (error) {
            console.error('Add to cart error:', error);
            throw error;
        }
    },
};

export default api;
