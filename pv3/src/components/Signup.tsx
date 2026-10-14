// src/components/Signup.tsx
import React, { useState, useEffect } from "react";
import PageLayout from "./PageLayout";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Apple, Mail, Lock, User, Chrome, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../Contexts/AuthContext";
import { api } from "../lib/api";

const Signup = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    first_name: "",
    last_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [csrfReady, setCsrfReady] = useState(false);

  // Initialize CSRF token
  useEffect(() => {
    const initCsrf = async () => {
      try {
        await api.initCsrf();
        setCsrfReady(true);
      } catch (error) {
        console.error('❌ CSRF initialization failed:', error);
        setTimeout(() => {
          api.initCsrf().then(() => setCsrfReady(true)).catch(console.error);
        }, 2000);
      }
    };
    initCsrf();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }

    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      });
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto bg-green-100 rounded-3xl shadow-xl p-10 text-center"
          >
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-green-700 mb-2">Registration Successful!</h2>
            <p className="text-gray-600 mb-4">Your account has been created. Redirecting to login...</p>
            <div className="w-full bg-green-200 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, ease: 'linear' }}
                className="h-full bg-green-600 rounded-full"
              />
            </div>
          </motion.div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-md mx-auto bg-pink-400 rounded-3xl shadow-xl p-10"
        >
          <h1 className="text-3xl font-bold text-center mb-6">Create account</h1>

          {!csrfReady && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded-xl mb-4 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Initializing secure connection...
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-start gap-2"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm whitespace-pre-wrap">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="flex items-center gap-2 bg-white border rounded-full px-4 py-3 shadow-sm">
                <User className="w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={form.username}
                  onChange={handleChange}
                  className="w-full bg-transparent outline-none"
                  required
                  disabled={loading || !csrfReady}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 bg-white border rounded-full px-4 py-3 shadow-sm">
                <Mail className="w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full bg-transparent outline-none"
                  required
                  disabled={loading || !csrfReady}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 bg-white border rounded-full px-4 py-3 shadow-sm">
                <Lock className="w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  name="password"
                  placeholder="Password (min 8 characters)"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full bg-transparent outline-none"
                  required
                  disabled={loading || !csrfReady}
                  minLength={8}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 bg-white border rounded-full px-4 py-3 shadow-sm">
                <Lock className="w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  name="confirm_password"
                  placeholder="Confirm Password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  className="w-full bg-transparent outline-none"
                  required
                  disabled={loading || !csrfReady}
                />
              </div>
              <p className="text-sm text-black-500"> Make sure your password isn't numeric only and make it original </p>
            </div>

            <button
              type="submit"
              disabled={loading || !csrfReady}
              className="w-full bg-teal-700 hover:bg-teal-800 disabled:bg-teal-400 disabled:cursor-not-allowed text-white rounded-full py-3 text-center font-medium transition shadow-md flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : !csrfReady ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                'Sign up'
              )}
            </button>

            <p className="text-center text-sm text-gray-600">
              Already have an account?
              <Link to="/login" className="ml-1 text-white font-medium hover:text-teal-800">
                Log in
              </Link>
            </p>

            <button type="button" disabled className="w-full bg-black text-white rounded-full py-3 flex items-center justify-center gap-2 shadow opacity-50 cursor-not-allowed">
              <Apple className="w-5 h-5" />
              Sign up with Apple (Coming soon)
            </button>

            <button type="button" disabled className="w-full bg-white border rounded-full py-3 flex items-center justify-center gap-2 shadow opacity-50 cursor-not-allowed">
              <Chrome className="w-5 h-5 text-red-500" />
              Sign up with Google (Coming soon)
            </button>
          </form>
        </motion.div>
      </div>
    </PageLayout>
  );
};

export default Signup;