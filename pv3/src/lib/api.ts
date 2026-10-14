// src/lib/api.ts
// ============================================
// COMPLETE REWRITE - FIXED LOGIN & AUTH
// ============================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  base_price: string;
  display_price: string | number;
  image_url: string | null;
  category: number;
  category_slug: string;
  category_name: string;
  is_active: boolean;
  is_featured: boolean;
  has_variants: boolean;
  variant_count: number;
  created_at: string;
}

export interface ProductDetail extends Product {
  image_thumbnail_url: string | null;
  image_medium_url: string | null;
  image_large_url: string | null;
  formatted_price: string;
  sku: string | null;
  tags: string;
  variants: ProductVariant[];
  updated_at: string;
}

export interface ProductVariant {
  id: number;
  product: number;
  name: string;
  size_value: number;
  size_unit: string;
  serves: number;
  price: string;
  formatted_price: string;
  is_active: boolean;
  is_default: boolean;
  stock_quantity: number;
  display_order: number;
  in_stock: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  product_count: number;
  created_at: string;
}

export interface CartItem {
  id: number;
  product: number;
  product_name: string;
  product_slug: string;
  variant: number | null;
  variant_name: string | null;
  quantity: number;
  product_price: string | number;
  total_price: string | number;
  image_url: string | null;
}

export interface Cart {
  id: number;
  session_key: string | null;
  user: number | null;
  items: CartItem[];
  total_items: number;
  total_amount: string | number;
  created_at: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface OrderItem {
  id: number;
  product: number | null;
  product_name: string;
  variant: number | null;
  variant_name: string | null;
  quantity: number;
  unit_price: string;
  subtotal: string | number;
}

export interface Order {
  id: number;
  order_number: string;
  user: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string;
  delivery_date: string | null;
  delivery_time: string | null;
  special_instructions: string;
  status: OrderStatus;
  total_amount: string;
  tracking_token: string | null;
  tracking_url: string | null;
  estimated_ready_at: string | null;
  payment_confirmed_at: string | null;
  bake_started_at: string | null;
  ready_at: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  order: number;
  order_number: string;
  payment_method: 'stripe' | 'mpesa' | 'cash';
  amount: string;
  status: PaymentStatus;
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  mpesa_checkout_request_id?: string;
  mpesa_transaction_id?: string;
  mpesa_phone?: string;
  transaction_data?: Record<string, unknown>;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface TrackingData {
  order_number: string;
  status: OrderStatus;
  status_display: string;
  customer_name: string;
  total_amount: string;
  payment_confirmed_at: string | null;
  bake_started_at: string | null;
  estimated_ready_at: string | null;
  ready_at: string | null;
  dispatched_at: string | null;
  is_overdue: boolean;
  items: Array<{
    product_name: string;
    variant_name: string;
    quantity: number;
    unit_price: string;
  }>;
}

export interface CreateOrderRequest {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string;
  delivery_date?: string | null;
  delivery_time?: string | null;
  special_instructions?: string;
  payment_method: 'mpesa' | 'card' | 'cash';
  total_amount: string;
  sms_consent: boolean;
  notif_sms: boolean;
  notif_whatsapp: boolean;
  items: Array<{
    product_id: number;
    variant_id: number | null;
    product_name: string;
    variant_name: string;
    unit_price: number;
    quantity: number;
  }>;
  mpesa_phone?: string;
  card_number?: string;
  card_expiry?: string;
  card_cvv?: string;
}

export interface CreateOrderResponse {
  success: boolean;
  order_id: number;
  order_number: string;
  message?: string;
  checkout_request_id?: string;
  merchant_request_id?: string;
  tracking_token?: string;
  tracking_url?: string;
  error?: string;
  errors?: Record<string, string>;
  details?: string;
  response_code?: string;
  debug?: Record<string, unknown>;
}

export interface MPesaStatusResponse {
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  order_id: number;
  order_number: string;
  tracking_token?: string;
  tracking_url?: string;
  amount?: string;
  receipt?: string | null;
  ResultCode?: string;
  ResultDesc?: string;
  CheckoutRequestID?: string;
  [key: string]: unknown;
}

export interface PollMPesaResult {
  success: boolean;
  data?: MPesaStatusResponse;
  error?: string;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  sms_consent: boolean;
  sms_channel?: 'sms' | 'whatsapp';
}

// ============================================
// AUTHENTICATION TYPES - FIXED
// ============================================

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export interface UserProfile {
  username: string;
  email: string;
  full_name: string;
  phone_number: string;
  delivery_address: string;
  email_verified: boolean;
  loyalty_points: number;
  birthday: string | null;
  preferred_contact_method: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// DELIVERY TRACKING TYPES
// ============================================

export interface DeliveryTracking {
  order_number: string;
  order_status: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  current_latitude: number | null;
  current_longitude: number | null;
  route_polyline: string;
  total_distance: number;
  total_duration: number;
  distance_remaining: number;
  duration_remaining: number;
  driver_name: string | null;
  driver_phone: string | null;
  driver_photo: string | null;
  vehicle_number: string | null;
  is_live_tracking: boolean;
  last_location_update: string | null;
  estimated_arrival: string | null;
  current_activity: string;
}

export interface DriverLocationUpdate {
  driver_id: number;
  latitude: number;
  longitude: number;
}

export interface AddressAutocompleteResult {
  description: string;
  place_id: string;
  terms: string[];
  types: string[];
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id?: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const formatKenyanPhone = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '254' + cleaned.slice(1);
  } else if (cleaned.length === 9) {
    cleaned = '254' + cleaned;
  }
  if (cleaned.length !== 12 || !cleaned.startsWith('254')) {
    throw new Error('Invalid Kenyan phone number. Use format: 0722123456 or 254722123456');
  }
  return cleaned;
};

export const getCsrfToken = (): string => {
  const name = 'csrftoken';
  if (!document.cookie) {
    console.warn('⚠️ No cookies found');
    return '';
  }
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(name + '=')) {
      const token = decodeURIComponent(trimmed.slice(name.length + 1));
      console.log('✅ CSRF Token found:', token.substring(0, 10) + '...');
      return token;
    }
  }
  console.warn('⚠️ CSRF token not found in cookies');
  return '';
};

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// API CLIENT - COMPLETE REWRITE
// ============================================

class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    console.log('🚀 API Client initialized with baseURL:', baseURL);
  }

  // ✅ FIXED: Removed unused 'retryCount' parameter
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const isCsrfEndpoint = endpoint === '/csrf-token/';

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add CSRF token for non-GET requests (except CSRF endpoint)
    if (options.method && options.method !== 'GET' && !isCsrfEndpoint) {
      const csrf = getCsrfToken();
      if (csrf) {
        headers['X-CSRFToken'] = csrf;
      } else {
        console.warn('⚠️ No CSRF token available for request to:', endpoint);
      }
    }

    // Log the request
    console.log(`📡 ${options.method || 'GET'} ${url}`);
    if (options.body) {
      console.log('📦 Request body:', options.body);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // ✅ CRITICAL: Include cookies
      });

      console.log(`📥 Response status: ${response.status}`);

      // Parse response
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        console.log('📦 Response data:', data);
      } else {
        const text = await response.text();
        console.warn('⚠️ Non-JSON response:', text.substring(0, 200));
        throw new Error(`Unexpected response format: ${response.status}`);
      }

      // Handle errors
      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        
        if (data.detail) errorMessage = data.detail;
        else if (data.error) errorMessage = data.error;
        else if (data.message) errorMessage = data.message;
        else if (data.errors) {
          const messages = Object.values(data.errors).flat();
          errorMessage = messages.join(' ');
        }

        console.error('❌ API Error:', { status: response.status, message: errorMessage, data });
        throw new Error(errorMessage);
      }

      return data as T;
    } catch (error) {
      console.error('❌ Request error:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CSRF TOKEN
  // ═══════════════════════════════════════════════════════════════════════════

  async initCsrf(): Promise<{ csrfToken: string; sessionKey: string }> {
    console.log('🔑 Fetching CSRF token...');
    const url = `${this.baseURL}/csrf-token/`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ CSRF token fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch CSRF token:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION ENDPOINTS - FIXED
  // ═══════════════════════════════════════════════════════════════════════════

  async register(data: RegisterData): Promise<AuthResponse> {
    console.log('📝 Registering user:', data.username);
    return this.request<AuthResponse>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginData): Promise<AuthResponse> {
    console.log('🔐 Attempting login for:', data.username);
    console.log('📍 Endpoint:', `${this.baseURL}/auth/login/`);
    
    try {
      const response = await this.request<AuthResponse>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      console.log('✅ Login successful:', response);
      
      // Store user in localStorage
      if (response.success && response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
        console.log('💾 User stored in localStorage');
      }
      
      return response;
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
  }

  async logout(): Promise<{ success: boolean; message: string }> {
    console.log('🔓 Logging out...');
    localStorage.removeItem('user');
    return this.request('/auth/logout/', { method: 'POST' });
  }

  async getProfile(): Promise<UserProfile> {
    console.log('👤 Fetching profile...');
    return this.request<UserProfile>('/profile/');
  }

  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    console.log('✏️ Updating profile...');
    return this.request<UserProfile>('/profile/update/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  getCurrentUser(): AuthResponse['user'] | null {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        return JSON.parse(userData);
      }
      return null;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════

  async getProducts(categorySlug?: string): Promise<Product[]> {
    const query = categorySlug ? `?category=${categorySlug}` : '';
    return this.request<Product[]>(`/products/${query}`);
  }

  async getProduct(slug: string): Promise<ProductDetail> {
    return this.request<ProductDetail>(`/products/${slug}/`);
  }

  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories/');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CART
  // ═══════════════════════════════════════════════════════════════════════════

  async getCart(): Promise<Cart> {
    return this.request<Cart>('/cart/');
  }

  async addToCart(
    productId: number,
    quantity: number,
    variantId?: number
  ): Promise<{ success: boolean; cart: Cart }> {
    return this.request('/cart/add/', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        variant_id: variantId ?? null,
        quantity,
      }),
    });
  }

  async updateCartItem(
    itemId: number,
    quantity: number
  ): Promise<{ success: boolean; cart: Cart }> {
    return this.request(`/cart/update/${itemId}/`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
  }

  async removeCartItem(itemId: number): Promise<{ success: boolean; cart: Cart }> {
    return this.request(`/cart/remove/${itemId}/`, { method: 'DELETE' });
  }

  async clearCart(): Promise<{ success: boolean; cart: Cart }> {
    return this.request('/cart/clear/', { method: 'POST' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDERS
  // ═══════════════════════════════════════════════════════════════════════════

  async createOrder(orderData: CreateOrderRequest): Promise<CreateOrderResponse> {
    if (orderData.mpesa_phone) {
      orderData.mpesa_phone = formatKenyanPhone(orderData.mpesa_phone);
    }
    if (orderData.customer_phone) {
      try {
        orderData.customer_phone = formatKenyanPhone(orderData.customer_phone);
      } catch {
        // non-fatal
      }
    }
    return this.request<CreateOrderResponse>('/create-order/', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getOrder(orderId: number): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}/`);
  }

  async getUserOrders(): Promise<Order[]> {
    return this.request<Order[]>('/orders/');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  async trackOrder(token: string): Promise<TrackingData> {
    return this.request<TrackingData>(`/track/${token}/`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  async getPaymentStatus(orderId: number): Promise<Payment> {
    return this.request<Payment>(`/payments/status/${orderId}/`);
  }

  async queryMPesaStatus(checkoutRequestId: string): Promise<MPesaStatusResponse> {
    return this.request<MPesaStatusResponse>(
      `/payments/mpesa/query/?checkout_request_id=${encodeURIComponent(checkoutRequestId)}`
    );
  }

  async pollMPesaStatus(
    checkoutRequestId: string,
    onStatusUpdate: (status: MPesaStatusResponse) => void,
    maxAttempts = 40,
    intervalMs = 3000
  ): Promise<PollMPesaResult> {
    let attempts = 0;
    await delay(2000);

    const poll = async (): Promise<PollMPesaResult> => {
      attempts++;
      console.log(`Polling M-Pesa status (${attempts}/${maxAttempts})...`);

      try {
        const status = await this.queryMPesaStatus(checkoutRequestId);
        onStatusUpdate(status);

        if (status.payment_status === 'completed') {
          return { success: true, data: status };
        }
        if (status.payment_status === 'failed') {
          return { success: false, error: status.ResultDesc || 'Payment failed' };
        }

        const rc = status.ResultCode;
        if (rc === '0') return { success: true, data: status };
        if (rc === '1032' || rc === '1037' || rc === '1031') {
          return { success: false, error: status.ResultDesc || 'Payment cancelled or timed out' };
        }

        if (attempts < maxAttempts) {
          const wait = Math.min(intervalMs * Math.pow(1.2, attempts - 1), 10000);
          await delay(wait);
          return poll();
        }

        return {
          success: false,
          error: 'Payment verification timed out. Check your email for confirmation.',
        };
      } catch (error) {
        if (attempts < maxAttempts) {
          const wait = Math.min(intervalMs * Math.pow(1.5, attempts - 1), 15000);
          await delay(wait);
          return poll();
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Network error',
        };
      }
    };

    return poll();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async updateNotificationPreferences(
    orderId: number,
    preferences: NotificationPreferences
  ): Promise<{ success: boolean; message?: string }> {
    return this.request(`/orders/${orderId}/notifications/`, {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BAKER ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  async updateOrderStatus(
    orderId: number,
    status: OrderStatus,
    note?: string
  ): Promise<Order> {
    return this.request(`/baker/orders/${orderId}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    });
  }

  async getPendingOrders(): Promise<Order[]> {
    return this.request<Order[]>('/baker/orders/pending/');
  }

  async getAllOrders(): Promise<Order[]> {
    return this.request<Order[]>('/baker/orders/');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELIVERY TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  async getDeliveryTracking(trackingToken: string): Promise<DeliveryTracking | null> {
    try {
      return await this.request<DeliveryTracking>(`/delivery/tracking/${trackingToken}/`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      console.error('❌ Delivery tracking error:', error);
      throw error;
    }
  }

  async geocodeAddress(address: string): Promise<GeocodeResult> {
    return this.request<GeocodeResult>(`/geocode/?address=${encodeURIComponent(address)}`);
  }

  async addressAutocomplete(input: string): Promise<AddressAutocompleteResult[]> {
    if (input.length < 3) return [];
    try {
      return await this.request<AddressAutocompleteResult[]>(
        `/address-autocomplete/?input=${encodeURIComponent(input)}`
      );
    } catch (error) {
      console.error('❌ Autocomplete error:', error);
      return [];
    }
  }

  async updateDriverLocation(update: DriverLocationUpdate): Promise<{ success: boolean; message: string }> {
    return this.request('/delivery/driver/location/', {
      method: 'POST',
      body: JSON.stringify(update),
    });
  }

  async assignDriverToOrder(orderId: number, driverId: number): Promise<{ success: boolean; message: string }> {
    return this.request(`/delivery/assign/${orderId}/`, {
      method: 'POST',
      body: JSON.stringify({ driver_id: driverId }),
    });
  }

  async updateDeliveryStatus(
    orderId: number,
    status: 'picked_up' | 'in_transit' | 'delivered',
    location?: { latitude: number; longitude: number }
  ): Promise<{ success: boolean; message: string }> {
    const body: any = { status };
    if (location) {
      body.latitude = location.latitude;
      body.longitude = location.longitude;
    }
    return this.request(`/delivery/status/${orderId}/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================

export const api = new APIClient(API_BASE_URL);
export default api;