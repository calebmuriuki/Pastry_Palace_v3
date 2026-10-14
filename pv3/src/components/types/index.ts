// types/index.ts - UPDATED TO MATCH DJANGO API

// Add this interface for API response handling
export interface ApiResponse<T = any> {
  count?: number;                    // For paginated responses
  next?: string | null;              // Next page URL
  previous?: string | null;          // Previous page URL
  results?: T[];                     // Array of items for paginated responses
  data?: T[];                        // Alternative field name for data
  [key: string]: any;                // Allow other dynamic properties
}

export interface Category {
  id: number;
  name: string;                    // From API: Category.name
  slug: string;                    // From API: Category.slug
  image_url: string | null;            // From API: Category.image (may be relative URL)
  description: string;             // From API: Category.description
  product_count: number;              // From API: Category.menu_count
  display_order: number;           // From API: Category.display_order
  is_active: boolean;              // From API: Category.is_active
  created_at: string;              // From API: Category.created_at
  updated_at: string;
  display_name?: string;
  category_type?: string;          // From API: Category.updated_at
}

export interface ProductSize {      // Keep for compatibility if needed
  id: number;
  weight: string;
  serves: number;
  price: number;
  is_active: boolean;
  display_order: number;
}

export interface ProductVariant {    // MATCHING DJANGO ProductVariant model
  id: number;
  product: number;                 // product ID (not product_id)
  name: string;                    // variant name, e.g., "1kg (serves 10)"
  size_value: number;              // e.g., 1.00
  size_unit: string;               // e.g., "kg"
  serves: number;                  // number of servings
  price: string;                   // Decimal as string, e.g., "45.00"
  is_active: boolean;
  is_default: boolean;
  stock_quantity: number;
  display_order: number;
  in_stock: boolean;               // Computed property
}

// types.ts - Update your Product interface
export interface Product {
  id: number;
  category: number;
  category_name: string;
  category_slug?: string;
  name: string;
  slug: string;
  description: string;

  // Original image (for backward compatibility)
  image_url: string | null;

  // ✅ NEW: Optimized image fields
  image_thumbnail_url
  ?: string | null;  // 300x200px for lists
  image_medium_url
  ?: string | null;     // 600x400px for detail pages
  image_large_url
  ?: string | null;      // 900x600px for high-res
  image_original_url
  ?: string | null;   // 1200x800px max (if needed)

  base_price: string;
  display_price: string;
  is_active: boolean;
  is_featured: boolean;
  has_variants: boolean;
  sku: string | null;
  tags: string | null;
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;

  // Legacy properties
  cake_type?: string;
  featured?: boolean;
  sizes?: ProductSize[];
  in_stock?: boolean;
}

export interface CartItem {
  product_id: number;
  variant_id?: number;             // Match Django field name
  quantity: number;
  cake_type?: string;              // Optional legacy
  product?: Product;               // For frontend convenience
  variant?: ProductVariant;        // Match Django model
}

export interface OrderData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zip_code: string;
  payment_method: 'card' | 'mpesa';
  mpesa_phone?: string;
  items: CartItem[];
}

// Optional: You can also add more specific response types
export interface PaginatedResponse<T> extends ApiResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SingleResponse<T> {
  data: T;
  [key: string]: any;
}