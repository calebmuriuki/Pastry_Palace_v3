// src/components/Login.tsx
import React, { useState } from "react";
import PageLayout from "./PageLayout";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Apple, Mail, Lock, Chrome, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../Contexts/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-md mx-auto bg-pink-400 rounded-3xl shadow-xl p-10"
        >
          <h1 className="text-3xl font-bold text-center mb-6">Welcome back</h1>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-start gap-2"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="flex items-center gap-2 bg-white border rounded-full px-4 py-3 shadow-sm">
                <Mail className="w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  name="username"
                  placeholder="Username or Email"
                  value={form.username}
                  onChange={handleChange}
                  className="w-full bg-transparent outline-none"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 bg-white border rounded-full px-4 py-3 shadow-sm">
                <Lock className="w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full bg-transparent outline-none"
                  required
                  disabled={loading}
                />
              </div>
              <div className="text-right mt-1">
                <Link to="/forgot-password" className="text-xs text-gray-600 hover:text-primary transition">
                  Forgot Password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-700 hover:bg-teal-800 disabled:bg-teal-400 disabled:cursor-not-allowed text-white rounded-full py-3 text-center font-medium transition shadow-md flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Log in'
              )}
            </button>

            <p className="text-center text-sm text-gray-600">
              Don't have an account?
              <Link to="/signup" className="ml-1 text-white font-medium hover:text-teal-800">
                Sign up
              </Link>
            </p>

            <button type="button" disabled className="w-full bg-black text-white rounded-full py-3 flex items-center justify-center gap-2 shadow opacity-50 cursor-not-allowed">
              <Apple className="w-5 h-5" />
              Log in with Apple (Coming soon)
            </button>

            <button type="button" disabled className="w-full bg-white border rounded-full py-3 flex items-center justify-center gap-2 shadow opacity-50 cursor-not-allowed">
              <Chrome className="w-5 h-5 text-red-500" />
              Log in with Google (Coming soon)
            </button>
          </form>
        </motion.div>
      </div>
    </PageLayout>
  );
};

export default Login;