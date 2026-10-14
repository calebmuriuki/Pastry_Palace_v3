import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "./Contexts/CartContext";
import { Button } from "./components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./components/ui/sheet";
import { useNavigate } from "react-router-dom";

interface CartSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CartSidebar = ({ open, onOpenChange }: CartSidebarProps) => {
  const { items, removeFromCart, updateQuantity, clearCart, getTotalPrice } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (items.length === 0) {
      return;
    }
    navigate("/checkout");
    onOpenChange(false);
  };

  // ✅ FIXED: Handle remove with proper parameters
  const handleRemoveItem = async (productId: number, variantId?: number) => {
    console.log('🗑️ CartSidebar: Removing item', { productId, variantId });
    await removeFromCart(productId, variantId);
  };

  // ✅ FIXED: Handle quantity update with proper parameters
  const handleUpdateQuantity = async (productId: number, newQuantity: number, variantId?: number) => {
    console.log('📝 CartSidebar: Updating quantity', { productId, newQuantity, variantId });
    await updateQuantity(productId, newQuantity, variantId);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          {/* ✅ FIXED: Removed duplicate close button */}
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Shopping Cart
          </SheetTitle>

          <SheetDescription>
            {items.length === 0
              ? "Your cart is empty"
              : `${items.length} item${items.length > 1 ? "s" : ""} in your cart`}
          </SheetDescription>
        </SheetHeader>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto py-6 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <ShoppingBag className="w-16 h-16 text-muted-foreground" />
              <p className="text-muted-foreground">No items in your cart yet</p>
            </div>
          ) : (
            items.map((item) => {
              // ✅ Create unique key combining product ID and variant ID
              const uniqueKey = item.variantId
                ? `${item.id}-${item.variantId}`
                : `${item.id}`;

              return (
                <div
                  key={uniqueKey}
                  className="flex gap-4 p-4 bg-secondary rounded-2xl border-2 border-border"
                >
                  <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-background">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-foreground">{item.name}</h4>
                      {/* ✅ FIXED: Pass both product ID and variant ID */}
                      <button
                        onClick={() => handleRemoveItem(item.id, item.variantId)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-primary font-bold">Ksh {item.price.toFixed(2)}</p>

                    {/* ✅ Show variant name if exists */}
                    {item.variantName && (
                      <p className="text-sm text-muted-foreground">
                        Size: {item.variantName}
                      </p>
                    )}

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1, item.variantId)}
                        className="w-7 h-7 flex items-center justify-center rounded-full border-2 border-foreground/20 hover:border-primary hover:text-primary transition-colors"
                        aria-label="Decrease quantity"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <span className="text-lg font-bold text-foreground w-8 text-center">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1, item.variantId)}
                        className="w-7 h-7 flex items-center justify-center rounded-full border-2 border-foreground/20 hover:border-primary hover:text-primary transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <span className="ml-auto text-foreground font-bold">
                        Ksh {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Summary */}
        {items.length > 0 && (
          <div className="border-t-2 border-border pt-6 space-y-4">
            <div className="flex justify-between items-center text-xl font-bold">
              <span className="text-foreground">Total:</span>
              <span className="text-primary">Ksh {getTotalPrice().toFixed(2)}</span>
            </div>

            <div className="space-y-2">
              <Button onClick={handleCheckout} className="w-full" size="lg">
                Proceed to Checkout
              </Button>
              <Button
                onClick={clearCart}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Clear Cart
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartSidebar;