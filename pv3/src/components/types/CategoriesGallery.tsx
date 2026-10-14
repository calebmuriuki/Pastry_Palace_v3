// types/index.ts
export interface Category {
    id: number;
    name: string;
    display_name: string;
    slug: string;
    menu_count: number;
    image: string;
    category_type: string;
    description?: string;
}

export interface ProductSize {
    id: number;
    weight: string;
    serves: number;
    price: number;
    is_active: boolean;
    display_order: number;
}

export interface Product {
    id: number;
    name: string;
    description: string;
    base_price: number;
    image: string;
    category: Category;
    category_name: string;
    cake_type: string;
    in_stock: boolean;
    featured: boolean;
    sku: string;
    sizes: ProductSize[];
    created_at: string;
}

export interface CartItem {
    product_id: number;
    size_id?: number;
    quantity: number;
    cake_type: string;
    product?: Product; // For frontend convenience
    selected_size?: ProductSize;
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