// src/App.tsx
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./Contexts/CartContext";
import { AuthProvider } from "./Contexts/AuthContext";
import { useAuth } from "./Contexts/AuthContext";
import { useState, useEffect } from "react";
import { Shield } from "lucide-react";

// Pages
import Index from "./pages/Index";
import Cakes from "./components/Cakes";
import About from "./components/About";
import Contact from "./components/Contact";
import NotFound from "./pages/NotFound";
import Checkout from "./components/Checkout";
import Login from "./components/Login";
import Signup from "./components/Signup";
import OrderConfirmation from "./components/order_confirmation";
import OrderTracking from "./components/OrderTracking";
import Profile from "./pages/Profile";

// Admin Components
import AdminReport from "./components/admin/AdminReport";
import AdminDashboard from "./components/admin/AdminDashboard";

const queryClient = new QueryClient();

// ── Protected Route Component ──────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// ── Admin Route Component - FIXED ──────────────────────────────────────────
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      console.log('🔍 AdminRoute: Checking admin status...');
      
      if (!isAuthenticated) {
        console.log('❌ AdminRoute: Not authenticated');
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      try {
        // ✅ FIX: Use credentials: 'include' instead of Authorization header
        // Django session auth uses cookies, not JWT tokens
        console.log('🔍 AdminRoute: Fetching role with session cookie...');
        
        const response = await fetch('/api/auth/role/', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // ✅ CRITICAL: Send session cookie
        });

        console.log(`🔍 AdminRoute: Response status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log('✅ AdminRoute: Role data:', data);
          setIsAdmin(data.is_admin || false);
        } else {
          console.log('❌ AdminRoute: Failed to fetch role, status:', response.status);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('❌ AdminRoute: Error checking admin:', error);
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    };

    checkAdmin();
  }, [isAuthenticated]);

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page. This area is restricted to administrators only.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ── App Component ──────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* ── Public Routes ────────────────────────────────────────── */}
              <Route path="/" element={<Index />} />
              <Route path="/cakes" element={<Cakes />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              
              {/* ── Auth Routes ──────────────────────────────────────────── */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              
              {/* ── Order Routes ─────────────────────────────────────────── */}
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-confirmation/:order_id" element={<OrderConfirmation />} />
              <Route path="/tracking/:orderId" element={<OrderTracking />} />
              <Route path="/track/:token" element={<OrderTracking />} />
              
              {/* ── Protected Routes (Require Authentication) ────────────── */}
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/orders" 
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 py-12">
                      <div className="max-w-4xl mx-auto px-4">
                        <h1 className="text-3xl font-bold">My Orders</h1>
                        <p className="text-gray-600 mt-4">Your orders will appear here.</p>
                      </div>
                    </div>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/wishlist" 
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 py-12">
                      <div className="max-w-4xl mx-auto px-4">
                        <h1 className="text-3xl font-bold">My Wishlist</h1>
                        <p className="text-gray-600 mt-4">Your wishlist items will appear here.</p>
                      </div>
                    </div>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 py-12">
                      <div className="max-w-4xl mx-auto px-4">
                        <h1 className="text-3xl font-bold">Settings</h1>
                        <p className="text-gray-600 mt-4">Account settings will appear here.</p>
                      </div>
                    </div>
                  </ProtectedRoute>
                } 
              />
              
              {/* ── Admin Routes (Require Admin) ─────────────────────────── */}
              <Route 
                path="/admin/dashboard" 
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                } 
              />
              <Route 
                path="/admin/reports" 
                element={
                  <AdminRoute>
                    <AdminReport />
                  </AdminRoute>
                } 
              />
              
              {/* ── 404 ───────────────────────────────────────────────────── */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;