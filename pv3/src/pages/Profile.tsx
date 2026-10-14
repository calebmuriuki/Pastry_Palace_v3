// src/pages/Profile.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../Contexts/AuthContext';
import PageLayout from '../components/PageLayout';
import ProductImage from '../components/productImage';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Award, 
  Save, 
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Clock,
  Package,
  CreditCard,
  TrendingUp,
  Search,
  Eye,
  AlertCircle,
  Printer,
  FileText,
  Loader2,
  Shield,
  LayoutDashboard,
  Users,
  Settings as SettingsIcon
} from 'lucide-react';
import type { Purchase } from '../components/types/purchase';
import { purchaseService } from '../services/PurchaseService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Link } from 'react-router-dom';

interface UserRoleResponse {
  is_authenticated: boolean;
  is_admin: boolean;
  is_superuser: boolean;
  is_staff: boolean;
  username: string;
  email: string;
  user_id: number;
  first_name: string;
  last_name: string;
}

const Profile: React.FC = () => {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
  const [form, setForm] = useState({
    phone_number: profile?.phone_number || '',
    delivery_address: profile?.delivery_address || '',
    preferred_contact_method: profile?.preferred_contact_method || 'email',
    birthday: profile?.birthday || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Admin role state
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  // Purchase History States
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    lastOrderDate: null as string | null,
  });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Check admin role
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setLoadingRole(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoadingRole(false);
          return;
        }

        const response = await fetch('/api/products/auth/role/', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data: UserRoleResponse = await response.json();
          setIsAdmin(data.is_admin || false);
          setIsSuperuser(data.is_superuser || false);
        } else {
          setIsAdmin(false);
          setIsSuperuser(false);
        }
      } catch (error) {
        setIsAdmin(false);
        setIsSuperuser(false);
      } finally {
        setLoadingRole(false);
      }
    };

    checkAdminRole();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({
        phone_number: form.phone_number || '',
        delivery_address: form.delivery_address,
        preferred_contact_method: form.preferred_contact_method,
        birthday: form.birthday || null,
      });
      await refreshProfile();
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const fetchPurchaseHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const userId = String(user.id);
      const [historyData, statsData] = await Promise.all([
        purchaseService.getUserPurchases(userId),
        purchaseService.getPurchaseStats(userId),
      ]);
      
      setPurchases(historyData.purchases || []);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching purchase history:', err);
      setError('Failed to load purchase history. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && user) {
      fetchPurchaseHistory();
    }
  }, [activeTab, user]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: Purchase['status']) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      processing: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      refunded: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return colors[status] || colors.pending;
  };

  const getPaymentStatusColor = (status: Purchase['payment_status']) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || colors.pending;
  };

  const toggleExpanded = (purchaseId: string) => {
    setExpandedPurchase(expandedPurchase === purchaseId ? null : purchaseId);
  };

  const generatePDF = async () => {
    const element = document.getElementById('purchase-history-content');
    if (!element) {
      alert('Unable to generate PDF. Please try again.');
      return;
    }

    setIsGeneratingPDF(true);
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        onclone: (clonedDoc: Document) => {
          const images = clonedDoc.querySelectorAll('img');
          return Promise.all(
            Array.from(images).map((img: HTMLImageElement) => {
              if (img.complete) return Promise.resolve();
              return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              });
            })
          );
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `purchase-history-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const filteredPurchases = purchases
    .filter((purchase) => {
      if (filterStatus !== 'all' && purchase.status !== filterStatus) return false;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          purchase.order_number?.toLowerCase().includes(searchLower) ||
          purchase.items?.some(item => 
            item.product_name?.toLowerCase().includes(searchLower)
          )
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'desc' 
          ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        return sortOrder === 'desc' 
          ? b.total_amount - a.total_amount
          : a.total_amount - b.total_amount;
      }
    });

  if (!user || !profile) {
    return (
      <PageLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Please log in to view your profile.</p>
        </div>
      </PageLayout>
    );
  }

  const isAdminUser = isAdmin && !loadingRole;

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-xl p-6 md:p-8"
          >
            {/* Header with Admin Badge */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">My Profile</h1>
                {isAdminUser && (
                  <span className="bg-teal-100 text-teal-700 text-sm font-semibold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-teal-200">
                    <Shield className="w-4 h-4" />
                    {isSuperuser ? 'Super Admin' : 'Admin'}
                  </span>
                )}
              </div>
              
              <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'profile'
                      ? 'bg-white text-teal-700 shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Profile</span>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'history'
                      ? 'bg-white text-teal-700 shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span className="hidden sm:inline">Purchase History</span>
                </button>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div className={`p-4 rounded-xl mb-6 ${
                message.type === 'success' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message.text}
              </div>
            )}

            {/* Profile Tab Content */}
            {activeTab === 'profile' && (
              <>
                {/* Admin Quick Links */}
                {isAdminUser && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-teal-50 to-purple-50 rounded-xl border border-teal-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-5 h-5 text-teal-600" />
                      <h3 className="font-semibold text-gray-900">Admin Quick Links</h3>
                      <span className="text-xs text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">Admin Access</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Link
                        to="/admin/dashboard"
                        className="flex items-center gap-2 p-3 bg-white rounded-lg hover:shadow-md transition border border-gray-200 hover:border-teal-300"
                      >
                        <LayoutDashboard className="w-4 h-4 text-teal-600" />
                        <span className="text-sm font-medium text-gray-700">Dashboard</span>
                      </Link>
                      <Link
                        to="/admin/reports"
                        className="flex items-center gap-2 p-3 bg-white rounded-lg hover:shadow-md transition border border-gray-200 hover:border-purple-300"
                      >
                        <FileText className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">Sales Reports</span>
                      </Link>
                      <Link
                        to="/admin/users"
                        className="flex items-center gap-2 p-3 bg-white rounded-lg hover:shadow-md transition border border-gray-200 hover:border-blue-300"
                      >
                        <Users className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">Users</span>
                      </Link>
                      <Link
                        to="/admin/settings"
                        className="flex items-center gap-2 p-3 bg-white rounded-lg hover:shadow-md transition border border-gray-200 hover:border-gray-400"
                      >
                        <SettingsIcon className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Settings</span>
                      </Link>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* User Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <User className="w-5 h-5 text-teal-600" />
                      <div>
                        <p className="text-sm text-gray-500">Full Name</p>
                        <p className="font-medium">{profile.full_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <Mail className="w-5 h-5 text-teal-600" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <Phone className="w-5 h-5 text-teal-600" />
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium">{profile.phone_number || 'Not set'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <MapPin className="w-5 h-5 text-teal-600" />
                      <div>
                        <p className="text-sm text-gray-500">Delivery Address</p>
                        <p className="font-medium">{profile.delivery_address || 'Not set'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <Calendar className="w-5 h-5 text-teal-600" />
                      <div>
                        <p className="text-sm text-gray-500">Member Since</p>
                        <p className="font-medium">
                          {new Date(profile.created_at).toLocaleDateString('en-KE', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-teal-50 rounded-xl border border-teal-100">
                      <Award className="w-5 h-5 text-teal-600" />
                      <div>
                        <p className="text-sm text-gray-500">Loyalty Points</p>
                        <p className="font-medium text-teal-700">
                          {profile.loyalty_points} points
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Edit Form */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">
                      {isEditing ? 'Edit Profile' : 'Profile Details'}
                    </h2>
                    
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            name="phone_number"
                            value={form.phone_number}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            placeholder="+254712345678"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Delivery Address
                          </label>
                          <textarea
                            name="delivery_address"
                            value={form.delivery_address}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            rows={3}
                            placeholder="123 Main St, Nairobi"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Preferred Contact Method
                          </label>
                          <select
                            name="preferred_contact_method"
                            value={form.preferred_contact_method}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option value="email">Email</option>
                            <option value="phone">Phone</option>
                            <option value="sms">SMS</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Birthday
                          </label>
                          <input
                            type="date"
                            name="birthday"
                            value={form.birthday}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 bg-teal-700 hover:bg-teal-800 disabled:bg-teal-400 text-white py-2 rounded-lg font-medium transition flex items-center justify-center gap-2"
                          >
                            {saving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                Save Changes
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(false);
                              setForm({
                                phone_number: profile?.phone_number || '',
                                delivery_address: profile?.delivery_address || '',
                                preferred_contact_method: profile?.preferred_contact_method || 'email',
                                birthday: profile?.birthday || '',
                              });
                            }}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 text-gray-600">
                        <p>
                          <span className="font-medium">Phone:</span>{' '}
                          {profile.phone_number || 'Not set'}
                        </p>
                        <p>
                          <span className="font-medium">Address:</span>{' '}
                          {profile.delivery_address || 'Not set'}
                        </p>
                        <p>
                          <span className="font-medium">Contact Method:</span>{' '}
                          {profile.preferred_contact_method}
                        </p>
                        <p>
                          <span className="font-medium">Birthday:</span>{' '}
                          {profile.birthday ? new Date(profile.birthday).toLocaleDateString() : 'Not set'}
                        </p>
                        <p>
                          <span className="font-medium">Email Verified:</span>{' '}
                          {profile.email_verified ? '✅ Yes' : '❌ No'}
                        </p>
                        {isAdminUser && (
                          <div className="mt-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
                            <p className="text-sm text-teal-700 flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              You have admin privileges. Access admin tools from the Quick Links above.
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => setIsEditing(true)}
                          className="w-full mt-4 bg-teal-700 hover:bg-teal-800 text-white py-2 rounded-lg font-medium transition"
                        >
                          Edit Profile
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Purchase History Tab Content */}
            {activeTab === 'history' && (
              <motion.div
                id="purchase-history-content"
                ref={contentRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent"></div>
                      <p className="text-gray-600">Loading your purchase history...</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3 text-red-600">
                      <AlertCircle className="w-12 h-12" />
                      <p>{error}</p>
                      <button
                        onClick={fetchPurchaseHistory}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}

                {!loading && !error && (
                  <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-teal-600 rounded-lg text-white">
                            <ShoppingBag className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Total Orders</p>
                            <p className="text-2xl font-bold text-teal-900">{stats.totalOrders}</p>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-600 rounded-lg text-white">
                            <TrendingUp className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Total Spent</p>
                            <p className="text-2xl font-bold text-purple-900">{formatCurrency(stats.totalSpent)}</p>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-600 rounded-lg text-white">
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Average Order</p>
                            <p className="text-2xl font-bold text-blue-900">{formatCurrency(stats.averageOrderValue)}</p>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-600 rounded-lg text-white">
                            <Clock className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Last Order</p>
                            <p className="text-sm font-medium text-green-900">
                              {stats.lastOrderDate ? formatDate(stats.lastOrderDate) : 'No orders yet'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Filters */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search by order number or product..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>

                        <div className="flex gap-2 flex-wrap items-center">
                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="refunded">Refunded</option>
                          </select>

                          <select
                            value={`${sortBy}-${sortOrder}`}
                            onChange={(e) => {
                              const [newSortBy, newSortOrder] = e.target.value.split('-');
                              setSortBy(newSortBy as 'date' | 'amount');
                              setSortOrder(newSortOrder as 'asc' | 'desc');
                            }}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option value="date-desc">Newest First</option>
                            <option value="date-asc">Oldest First</option>
                            <option value="amount-desc">Highest Amount</option>
                            <option value="amount-asc">Lowest Amount</option>
                          </select>

                          <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                          >
                            <Printer className="w-4 h-4" />
                            <span>Print</span>
                          </button>

                          <button
                            onClick={generatePDF}
                            disabled={isGeneratingPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-lg transition"
                          >
                            {isGeneratingPDF ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Generating...</span>
                              </>
                            ) : (
                              <>
                                <FileText className="w-4 h-4" />
                                <span>PDF</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Purchase List */}
                    <div className="space-y-4">
                      {filteredPurchases.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl">
                          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold text-gray-600 mb-2">
                            {searchTerm || filterStatus !== 'all' ? 'No matching orders found' : 'No purchases yet'}
                          </h3>
                          <p className="text-gray-500">
                            {searchTerm || filterStatus !== 'all' 
                              ? 'Try adjusting your search or filters'
                              : 'Start shopping to see your purchase history here'}
                          </p>
                        </div>
                      ) : (
                        <AnimatePresence>
                          {filteredPurchases.map((purchase) => (
                            <motion.div
                              key={purchase.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                            >
                              <div 
                                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => toggleExpanded(purchase.id)}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                  <div className="flex items-center gap-4">
                                    <div className="p-2 bg-teal-50 rounded-lg">
                                      <ShoppingBag className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">{purchase.order_number || 'Order'}</p>
                                      <p className="text-sm text-gray-500 flex items-center gap-2">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(purchase.created_at)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <p className="text-lg font-bold text-teal-700">
                                        {formatCurrency(purchase.total_amount)}
                                      </p>
                                      <span className={`inline-block px-2 py-1 text-xs rounded-full border ${getStatusColor(purchase.status)}`}>
                                        {purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                                      </span>
                                    </div>
                                    <div className="text-gray-400">
                                      {expandedPurchase === purchase.id ? (
                                        <ChevronUp className="w-5 h-5" />
                                      ) : (
                                        <ChevronDown className="w-5 h-5" />
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <Package className="w-3 h-3" />
                                    {purchase.items?.length || 0} items
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <CreditCard className="w-3 h-3" />
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${getPaymentStatusColor(purchase.payment_status)}`}>
                                      {purchase.payment_status}
                                    </span>
                                  </span>
                                </div>
                              </div>

                              <AnimatePresence>
                                {expandedPurchase === purchase.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="border-t border-gray-200"
                                  >
                                    <div className="p-4 bg-gray-50">
                                      <div className="space-y-4">
                                        <div>
                                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Items</h4>
                                          <div className="space-y-2">
                                            {purchase.items?.map((item) => (
                                              <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                  <ProductImage 
                                                    src={item.image_url} 
                                                    alt={item.product_name}
                                                    className="w-12 h-12 object-cover rounded-lg"
                                                  />
                                                  <div>
                                                    <p className="font-medium text-gray-900">{item.product_name}</p>
                                                    <p className="text-sm text-gray-500">
                                                      Qty: {item.quantity} × {formatCurrency(item.price || item.unit_price || 0)}
                                                    </p>
                                                  </div>
                                                </div>
                                                <p className="font-medium text-gray-900">
                                                  {formatCurrency(item.total)}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Order Details</h4>
                                            <div className="bg-white p-3 rounded-lg space-y-1 text-sm">
                                              <p><span className="text-gray-600">Order ID:</span> {purchase.id}</p>
                                              <p><span className="text-gray-600">Date:</span> {formatDate(purchase.created_at)}</p>
                                              <p><span className="text-gray-600">Status:</span> {purchase.status}</p>
                                              <p><span className="text-gray-600">Payment:</span> {purchase.payment_method} ({purchase.payment_status})</p>
                                            </div>
                                          </div>
                                          <div>
                                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Delivery Address</h4>
                                            <div className="bg-white p-3 rounded-lg text-sm">
                                              <p className="whitespace-pre-line">{purchase.delivery_address || 'No address provided'}</p>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="bg-white p-3 rounded-lg flex justify-between items-center">
                                          <div>
                                            <p className="text-sm text-gray-600">Total Amount</p>
                                            <p className="text-xl font-bold text-teal-700">
                                              {formatCurrency(purchase.total_amount)}
                                            </p>
                                          </div>
                                          <button className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition flex items-center gap-2 text-sm">
                                            <Eye className="w-4 h-4" />
                                            View Details
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Profile;