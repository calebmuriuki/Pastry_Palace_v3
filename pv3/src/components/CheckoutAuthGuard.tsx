// src/components/CheckoutAuthGuard.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Contexts/AuthContext';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react'; 

interface CheckoutAuthGuardProps {
  children: React.ReactNode;
  onGuestContinue: (guestData: GuestData) => void;
}

interface GuestData {
  email: string;
  phone: string;
  name: string;
  address: string;
  createAccount: boolean;
  password?: string;
}

const CheckoutAuthGuard: React.FC<CheckoutAuthGuardProps> = ({ children, onGuestContinue }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestData, setGuestData] = useState<GuestData>({
    email: '',
    phone: '',
    name: '',
    address: '',
    createAccount: false,
    password: '',
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700"></div>
      </div>
    );
  }

  // If authenticated, render children
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Show guest checkout form
  if (showGuestForm) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl p-8"
      >
        <h2 className="text-2xl font-bold mb-6">Guest Checkout</h2>
        <p className="text-gray-600 mb-6">
          Continue as a guest or create an account for faster checkout next time.
        </p>

        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={guestData.name}
              onChange={(e) => setGuestData({ ...guestData, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={guestData.email}
              onChange={(e) => setGuestData({ ...guestData, email: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              value={guestData.phone}
              onChange={(e) => setGuestData({ ...guestData, phone: e.target.value })}
              placeholder="0712345678"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Address *
            </label>
            <textarea
              value={guestData.address}
              onChange={(e) => setGuestData({ ...guestData, address: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              rows={3}
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createAccount"
              checked={guestData.createAccount}
              onChange={(e) => setGuestData({ ...guestData, createAccount: e.target.checked })}
              className="w-4 h-4 text-teal-600"
            />
            <label htmlFor="createAccount" className="text-sm text-gray-700">
              Create an account (save my details for next time)
            </label>
          </div>

          {guestData.createAccount && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                value={guestData.password}
                onChange={(e) => setGuestData({ ...guestData, password: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="Create a password"
                required={guestData.createAccount}
                minLength={8}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => onGuestContinue(guestData)}
            className="w-full bg-teal-700 hover:bg-teal-800 text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            Continue to Payment
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowGuestForm(false)}
              className="text-teal-700 hover:underline text-sm"
            >
              Already have an account? Log in
            </button>
          </div>
        </form>
      </motion.div>
    );
  }

  // Show login/signup prompt
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto bg-white rounded-3xl shadow-xl p-8 text-center"
    >
      <div className="text-6xl mb-4">🔒</div>
      <h2 className="text-2xl font-bold mb-2">Secure Checkout</h2>
      <p className="text-gray-600 mb-6">
        Sign in to your account or continue as a guest to place your order.
      </p>

      <div className="space-y-3">
        <button
          onClick={() => navigate('/login')}
          className="w-full bg-teal-700 hover:bg-teal-800 text-white py-3 rounded-lg font-medium transition"
        >
          Log In
        </button>

        <button
          onClick={() => navigate('/signup')}
          className="w-full bg-white border-2 border-teal-700 text-teal-700 hover:bg-teal-50 py-3 rounded-lg font-medium transition"
        >
          Create Account
        </button>

        <button
          onClick={() => setShowGuestForm(true)}
          className="w-full text-gray-500 hover:text-gray-700 py-2 text-sm transition"
        >
          Continue as Guest →
        </button>
      </div>
    </motion.div>
  );
};

export default CheckoutAuthGuard;