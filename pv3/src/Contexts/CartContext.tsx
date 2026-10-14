// CartContext.tsx - FIXED WITH BACKEND SYNC
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// ✅ Helper: Get CSRF token
const getCSRFToken = (): string => {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
};

export interface CartItem {
  id: number;              // This is the product_id
  cartItemId?: number;     // ✅ NEW: Backend cart_item.id for DELETE operations
  name: string;
  price: number;
  image: string;
  quantity: number;
  variantId?: number;
  variantName?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity">, quantity: number) => void;
  removeFromCart: (id: number, variantId?: number) => void;
  updateQuantity: (id: number, quantity: number, variantId?: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  syncWithBackend: () => Promise<void>; // ✅ NEW: Sync function
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  // ✅ NEW: Sync cart with backend (call this on app load)
  const syncWithBackend = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/cart/`, {
        credentials: 'include',
      });

      if (response.ok) {
        const backendCart = await response.json();
        console.log('📦 Backend cart:', backendCart);

        // Transform backend cart items to frontend format
        const syncedItems: CartItem[] = backendCart.items?.map((item: any) => ({
          id: item.product.id,
          cartItemId: item.id, // ✅ Store backend cart_item.id
          name: item.variant
            ? `${item.product.name} - ${item.variant.name}`
            : item.product.name,
          price: item.variant
            ? parseFloat(item.variant.price)
            : parseFloat(item.product.base_price),
          image: item.product.image_url || '/placeholder-product.jpg',
          quantity: item.quantity,
          variantId: item.variant?.id,
          variantName: item.variant?.name,
        })) || [];

        setItems(syncedItems);
        console.log('✅ Cart synced with backend:', syncedItems.length, 'items');
      }
    } catch (error) {
      console.error('❌ Failed to sync cart:', error);
    }
  };

  const addToCart = (item: Omit<CartItem, "quantity">, quantity: number) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find(
        (i) => i.id === item.id && i.variantId === item.variantId
      );

      if (existingItem) {
        return prevItems.map((i) =>
          i.id === item.id && i.variantId === item.variantId
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }

      return [...prevItems, { ...item, quantity }];
    });
  };

  // ✅ FIXED: Remove from cart with backend sync
  const removeFromCart = async (id: number, variantId?: number) => {
    console.log('🗑️ Removing from cart:', { id, variantId });

    // Find the item to get its cartItemId
    const itemToRemove = items.find(
      (item) => item.id === id && item.variantId === variantId
    );

    if (!itemToRemove) {
      console.error('❌ Item not found in cart');
      return;
    }

    // ✅ CRITICAL: Check if we have backend cart_item_id
    if (!itemToRemove.cartItemId) {
      console.warn('⚠️ No cartItemId found, removing from frontend only');
      setItems((prevItems) =>
        prevItems.filter((item) => !(item.id === id && item.variantId === variantId))
      );
      return;
    }

    try {
      // 1. Delete from backend first
      const csrfToken = getCSRFToken();
      const response = await fetch(
        `${API_BASE_URL}/cart/remove/${itemToRemove.cartItemId}/`,
        {
          method: 'DELETE',
          headers: {
            'X-CSRFToken': csrfToken,
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Backend delete failed: ${response.status}`);
      }

      console.log('✅ Backend delete successful');

      // 2. Update frontend state
      setItems((prevItems) =>
        prevItems.filter((item) => !(item.id === id && item.variantId === variantId))
      );

      console.log('✅ Item removed from cart');

    } catch (error) {
      console.error('❌ Failed to remove item:', error);
      // Optionally: Show error toast to user
    }
  };

  // ✅ FIXED: Update quantity with backend sync
  const updateQuantity = async (id: number, quantity: number, variantId?: number) => {
    if (quantity <= 0) {
      removeFromCart(id, variantId);
      return;
    }

    // Find the item
    const itemToUpdate = items.find(
      (item) => item.id === id && item.variantId === variantId
    );

    if (!itemToUpdate?.cartItemId) {
      console.warn('⚠️ No cartItemId found, updating frontend only');
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id && item.variantId === variantId
            ? { ...item, quantity }
            : item
        )
      );
      return;
    }

    try {
      // 1. Update backend first
      const csrfToken = getCSRFToken();
      const response = await fetch(
        `${API_BASE_URL}/cart/update/${itemToUpdate.cartItemId}/`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({ quantity }),
        }
      );

      if (!response.ok) {
        throw new Error(`Backend update failed: ${response.status}`);
      }

      // 2. Update frontend state
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id && item.variantId === variantId
            ? { ...item, quantity }
            : item
        )
      );

      console.log('✅ Quantity updated');

    } catch (error) {
      console.error('❌ Failed to update quantity:', error);
    }
  };

  // ✅ FIXED: Clear cart with backend sync
  const clearCart = async () => {
    try {
      const csrfToken = getCSRFToken();
      const response = await fetch(`${API_BASE_URL}/cart/clear/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to clear cart on backend');
      }

      setItems([]);
      console.log('✅ Cart cleared');

    } catch (error) {
      console.error('❌ Failed to clear cart:', error);
      // Still clear frontend even if backend fails
      setItems([]);
    }
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalItems,
        getTotalPrice,
        syncWithBackend,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};