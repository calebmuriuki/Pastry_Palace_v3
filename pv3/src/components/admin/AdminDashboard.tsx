// src/components/admin/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Users,
  ShoppingBag,
  TrendingUp,
  CreditCard,
  Package,
  Settings,
  ArrowRight,
  Shield,
  AlertCircle,
  Loader2
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface DashboardStats {
  total_orders: number;
  total_revenue: number;
  total_users: number;
  success_rate: number;
  pending_payments: number;
  failed_payments: number;
  total_items: number;
  recent_orders: RecentOrder[];
}

interface RecentOrder {
  id: number;
  order_number: string;
  customer_name: string;
  status: string;
  total_amount: number;
  created_at: string;
}

// ── API Service ────────────────────────────────────────────────────────────
class DashboardService {
  private baseUrl = '/api';

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Use the report data endpoint to get stats
      const response = await fetch(`${this.baseUrl}/reports/data/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ Send session cookie
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard stats: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch stats');
      }

      const summary = data.data.summary;
      const orders = data.data.orders || [];

      return {
        total_orders: summary.total_orders || 0,
        total_revenue: summary.total_amount || 0,
        total_users: 0, // You'll need a separate endpoint for this
        success_rate: summary.success_rate || 0,
        pending_payments: summary.pending_payments || 0,
        failed_payments: summary.failed_payments || 0,
        total_items: summary.total_items || 0,
        recent_orders: orders.slice(0, 5).map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          status: order.status,
          total_amount: order.total_amount,
          created_at: order.created_at,
        })),
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }
}

// ── Main Component ──────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // ── Fetch Dashboard Data ──────────────────────────────────────────────
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const service = new DashboardService();
        const data = await service.getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // ── Format Helpers ─────────────────────────────────────────────────────
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-indigo-100 text-indigo-800',
      ready: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || colors.pending;
  };

  // ── Loading State ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-teal-600 animate-spin" />
          <p className="text-gray-600 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────
  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error || 'Failed to load dashboard data'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Stat Cards ──────────────────────────────────────────────────────────
  const statCards = [
    {
      title: 'Total Orders',
      value: stats.total_orders,
      icon: ShoppingBag,
      bgColor: 'bg-teal-50',
      textColor: 'text-teal-700',
    },
    {
      title: 'Revenue',
      value: formatCurrency(stats.total_revenue),
      icon: TrendingUp,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
    },
    {
      title: 'Total Users',
      value: stats.total_users || 'N/A',
      icon: Users,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
    },
    {
      title: 'Success Rate',
      value: `${stats.success_rate.toFixed(1)}%`,
      icon: CreditCard,
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
    },
  ];

  const quickActions = [
    {
      title: 'View Sales Report',
      description: 'Generate and download comprehensive sales reports',
      icon: FileText,
      path: '/admin/reports',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Manage Orders',
      description: 'View and update order statuses',
      icon: Package,
      path: '/admin/orders',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Manage Products',
      description: 'Add, edit, or remove products',
      icon: ShoppingBag,
      path: '/admin/products',
      color: 'bg-teal-50 text-teal-600',
    },
    {
      title: 'System Settings',
      description: 'Configure your store settings',
      icon: Settings,
      path: '/admin/settings',
      color: 'bg-gray-50 text-gray-600',
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back! Here's what's happening today.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-teal-100 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-teal-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Admin Access</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.textColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-50 p-4 rounded-xl border border-green-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm text-gray-600">Successful Payments</p>
                <p className="text-xl font-bold text-green-700">
                  {stats.total_orders - stats.pending_payments - stats.failed_payments}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div>
                <p className="text-sm text-gray-600">Pending Payments</p>
                <p className="text-xl font-bold text-yellow-700">
                  {stats.pending_payments}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-xl border border-red-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div>
                <p className="text-sm text-gray-600">Failed Payments</p>
                <p className="text-xl font-bold text-red-700">
                  {stats.failed_payments}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link
                  key={index}
                  to={action.path}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all hover:border-teal-300 group"
                >
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg ${action.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-teal-600 transition-colors" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-3">{action.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Orders</h2>
          {stats.recent_orders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent orders</p>
          ) : (
            <div className="space-y-4">
              {stats.recent_orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${
                      order.status === 'completed' ? 'bg-green-500' :
                      order.status === 'cancelled' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {order.order_number}
                      </p>
                      <p className="text-xs text-gray-500">
                        {order.customer_name} • {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;