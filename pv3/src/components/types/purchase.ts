// src/types/purchase.ts
export interface PurchaseItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  unit_price?:number;
  total: number;
  image_url?: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  order_number: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  delivery_address: string;
  items: PurchaseItem[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseHistoryResponse {
  purchases: Purchase[];
  total_spent: number;
  total_orders: number;
}