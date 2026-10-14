// src/components/Navigation.tsx
import { useState } from "react"; // ← Remove useEffect import
import { Search, ShoppingCart, Shield, LayoutDashboard } from "lucide-react";
import { Button } from "../components/ui/button";
import { Link } from "react-router-dom";
import { useCart } from "../Contexts/CartContext";
import { useAuth } from "../Contexts/AuthContext";  
import CartSidebar from "../CartSidebar";
import ProfileDropdown from "./ProfileDropdown";    

interface NavigationProps {
  cartCount?: number;
}

const Navigation = ({ cartCount: propCartCount }: NavigationProps) => {
  const [cartOpen, setCartOpen] = useState(false);
  // ✅ Remove loadingRole state - not needed since AuthContext handles it
  const { getTotalItems } = useCart();
  const { isAuthenticated, isAdmin } = useAuth(); // ← Get isAdmin from AuthContext
  
  const displayCartCount = propCartCount !== undefined ? propCartCount : getTotalItems();

  // ✅ No need for loadingRole - AuthContext manages loading state
  const showAdminLinks = isAdmin; // ← Simplified

  return (
    <nav className="flex items-center justify-between px-8 py-6">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-2xl">🎂</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xl font-bold text-foreground">Pastry</span>
          <span className="text-xl font-bold text-white">Palace.</span>
        </div>
      </Link>

      {/* Navigation Links */}
      <div className="hidden md:flex items-center gap-8">
        <Link to="/" className="text-foreground font-semibold hover:text-white transition-colors">
          Home
        </Link>
        <Link to="/cakes" className="text-foreground font-semibold hover:text-white transition-colors">
          Cakes
        </Link>
        <Link to="/about" className="text-foreground font-semibold hover:text-white transition-colors">
          About
        </Link>
        <Link to="/contact" className="text-foreground font-semibold hover:text-white transition-colors">
          Contact
        </Link>
        
        {/* Admin Links - Now visible when isAdmin is true */}
        {showAdminLinks && (
          <>
            <Link 
              to="/admin/dashboard" 
              className="bg-teal-500 text-white font-bold px-4 py-2 rounded-full flex items-center gap-2 hover:bg-teal-600 transition"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link 
              to="/admin/reports" 
              className="bg-purple-500 text-white font-bold px-4 py-2 rounded-full flex items-center gap-2 hover:bg-purple-600 transition"
            >
              <Shield className="w-4 h-4" />
              Reports
              <span className="bg-green-400 text-green-900 text-xs px-2 py-0.5 rounded-full">95%</span>
            </Link>
          </>
        )}
        
        {/* Profile Links */}
        {!isAuthenticated ? (
          <>
            <Link to="/signup" className="text-foreground font-semibold hover:text-white transition-colors">
              Signup
            </Link>
            <Link to="/login" className="text-foreground font-semibold hover:text-white transition-colors">
              Login
            </Link>
          </>
        ) : (
          <ProfileDropdown />
        )}
      </div>

      {/* Right Side Icons */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Search className="h-5 w-5" />
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5" />
          </Button>
          {displayCartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {displayCartCount}
            </span>
          )}
        </div>
      </div>

      <CartSidebar open={cartOpen} onOpenChange={setCartOpen} />
    </nav>
  );
};

export default Navigation;