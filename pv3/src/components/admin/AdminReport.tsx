// src/components/admin/AdminReport.tsx
import React, { useState, useEffect, useRef, Fragment } from 'react';
import {
  FileText,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Package,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Printer,
  Search,
  ChevronUp,
  Eye,
  Shield,
  User,
  LogOut
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ============================================
// TYPES
// ============================================

interface ReportSummary {
  total_orders: number;
  total_amount: number;
  total_items: number;
  average_order_value: number;
  successful_payments: number;
  pending_payments: number;
  failed_payments: number;
  success_rate: number;
  date_range: {
    start: string;
    end: string;
  };
}

interface ReportOrderItem {
  id: number;
  product_name: string;
  variant_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

interface ReportOrder {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  status_display: string;
  total_amount: number;
  created_at: string;
  payment_method: string;
  payment_status: string;
  payment_amount: number;
  mpesa_transaction_id: string;
  items_count: number;
  items: ReportOrderItem[];
}

interface ReportPayment {
  order_number: string;
  method: string;
  amount: string;
  status: string;
  transaction_id: string;
  created_at: string;
}

interface ReportData {
  success: boolean;
  data: {
    summary: ReportSummary;
    orders: ReportOrder[];
    order_items: ReportOrderItem[];
    payments: ReportPayment[];
    report_title: string;
    generated_at: string;
    generated_by: string;
  };
}

interface UserRole {
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

interface AdminReportProps {
  className?: string;
}

// ============================================
// API SERVICE
// ============================================

class ReportService {
  private baseUrl = '/api';

  async getUserRole(): Promise<UserRole | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/role/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error(`Failed to fetch user role: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  }

  async getReportData(
    startDate?: string,
    endDate?: string,
    status?: string
  ): Promise<ReportData> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (status && status !== 'all') params.append('status', status);

    const url = `${this.baseUrl}/reports/pdf-data/?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch report data: ${response.status}`);
    }

    return response.json();
  }

  async downloadServerPDF(
    startDate?: string,
    endDate?: string,
    type: string = 'all'
  ): Promise<void> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (type) params.append('type', type);

    const url = `${this.baseUrl}/reports/download/?${params.toString()}`;
    window.open(url, '_blank');
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

const AdminReport: React.FC<AdminReportProps> = ({ className = '' }) => {
  // State
  const [loading, setLoading] = useState(true);
  const [loadingRole, setLoadingRole] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [reportData, setReportData] = useState<ReportData['data'] | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  // ============================================
  // Check User Role on Mount
  // ============================================

  useEffect(() => {
    const checkRole = async () => {
      try {
        const service = new ReportService();
        const role = await service.getUserRole();
        setUserRole(role);
        
        if (!role?.is_admin) {
          setError('Access Denied: You do not have permission to view admin reports.');
          setLoading(false);
          setLoadingRole(false);
          return;
        }
        
        await fetchReport();
      } catch (err) {
        console.error('Error checking role:', err);
        setError('Failed to verify user permissions.');
        setLoading(false);
        setLoadingRole(false);
      }
    };

    checkRole();
  }, []);

  // ============================================
  // Fetch Report Data
  // ============================================

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const service = new ReportService();
      const response = await service.getReportData(
        dateRange.start,
        dateRange.end,
        statusFilter
      );

      if (response.success) {
        setReportData(response.data);
      } else {
        setError('Failed to load report data');
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
      setLoadingRole(false);
    }
  };

  useEffect(() => {
    if (userRole?.is_admin) {
      fetchReport();
    }
  }, [dateRange.start, dateRange.end, statusFilter]);

  // ============================================
  // Format Helpers
  // ============================================

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
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      preparing: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      ready: 'bg-purple-100 text-purple-800 border-purple-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status] || colors.pending;
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || colors.pending;
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  // ============================================
  // PDF Generation
  // ============================================

  const generatePDF = async () => {
    if (!contentRef.current || !reportData) {
      console.error('Content not found or no data');
      return;
    }

    setGeneratingPDF(true);

    try {
      console.log('📄 Generating Admin Report PDF...');

      const canvas = await html2canvas(contentRef.current, {
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

      const fileName = `sales-report-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      console.log('✅ PDF generated successfully!');

    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  // ============================================
  // Print
  // ============================================

  const handlePrint = () => {
    window.print();
  };

  // ============================================
  // Toggle Order Expansion
  // ============================================

  const toggleOrderExpansion = (orderId: number) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  // ============================================
  // Filtered Data
  // ============================================

  const getFilteredData = () => {
    if (!reportData) return null;

    let filteredOrders = reportData.orders;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filteredOrders = filteredOrders.filter(
        (order) =>
          order.order_number.toLowerCase().includes(search) ||
          order.customer_name.toLowerCase().includes(search) ||
          order.customer_email.toLowerCase().includes(search) ||
          order.customer_phone.includes(search)
      );
    }

    return {
      ...reportData,
      orders: filteredOrders,
    };
  };

  const filteredData = getFilteredData();

  // ============================================
  // Loading State
  // ============================================

  if (loadingRole || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent"></div>
          <p className="text-gray-600 text-lg">
            {loadingRole ? 'Checking permissions...' : 'Loading report data...'}
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // Access Denied State
  // ============================================

  if (error && !userRole?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // ============================================
  // Error State
  // ============================================

  if (error || !reportData) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4 text-red-600">
          <AlertCircle className="w-12 h-12" />
          <p className="text-lg">{error || 'Failed to load report'}</p>
          <button
            onClick={fetchReport}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { summary, payments } = reportData;

  // ============================================
  // Render
  // ============================================

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Admin Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Shield className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sales Report</h1>
            <p className="text-sm text-gray-500">
              {userRole?.is_superuser ? 'Super Administrator' : 'Administrator'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="w-4 h-4" />
            <span>{userRole?.username}</span>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <LogOut className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div ref={contentRef} id="admin-report-content">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-600 rounded-lg text-white">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-teal-900">{summary.total_orders}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg text-white">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-purple-900">
                  {formatCurrency(summary.total_amount)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg text-white">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Items Sold</p>
                <p className="text-2xl font-bold text-blue-900">{summary.total_items}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-600 rounded-lg text-white">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-green-900">
                  {summary.success_rate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-xl border border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Successful</p>
                <p className="text-xl font-bold text-green-700">
                  {summary.successful_payments}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-xl font-bold text-yellow-700">
                  {summary.pending_payments}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-xl border border-red-200">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-xl font-bold text-red-700">
                  {summary.failed_payments}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by order #, customer, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <span className="flex items-center text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />

              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>

              <button
                onClick={generatePDF}
                disabled={generatingPDF}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-lg transition flex items-center gap-2"
              >
                {generatingPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Orders ({filteredData?.orders.length || 0})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Order #</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Payment</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData?.orders.map((order) => (
                  <Fragment key={order.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {order.order_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {order.customer_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {order.customer_phone}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full border ${getStatusColor(order.status)}`}>
                          {order.status_display}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getPaymentStatusColor(order.payment_status)}`}>
                          {getPaymentStatusIcon(order.payment_status)}
                          {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleOrderExpansion(order.id)}
                          className="p-1 hover:bg-gray-200 rounded transition"
                        >
                          {expandedOrder === order.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-600" />
                          ) : (
                            <Eye className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {expandedOrder === order.id && (
                      <tr>
                        <td colSpan={7} className="px-4 py-3 bg-gray-50">
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-gray-700">Order Items</p>
                            {order.items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-200">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                                  {item.variant_name && (
                                    <p className="text-xs text-gray-500">Variant: {item.variant_name}</p>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {item.quantity} × {formatCurrency(item.unit_price)}
                                  <span className="ml-2 font-semibold text-gray-900">
                                    {formatCurrency(item.subtotal)}
                                  </span>
                                </div>
                              </div>
                            ))}
                            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                              <p className="text-sm text-gray-600">
                                Payment: {order.payment_method} {order.mpesa_transaction_id && `| Receipt: ${order.mpesa_transaction_id}`}
                              </p>
                              <p className="text-sm font-bold text-teal-700">
                                Total: {formatCurrency(order.total_amount)}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {filteredData?.orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payment Records ({payments.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Order #</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Method</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Transaction ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {payment.order_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      {payment.amount}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getPaymentStatusColor(payment.status.toLowerCase())}`}>
                        {getPaymentStatusIcon(payment.status.toLowerCase())}
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                      {payment.transaction_id !== 'N/A' ? payment.transaction_id : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(payment.created_at)}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No payment records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 py-4 border-t border-gray-200">
          <p>Generated by: {reportData.generated_by}</p>
          <p>Generated at: {formatDate(reportData.generated_at)}</p>
          <p className="mt-1 text-xs text-gray-400">
            © {new Date().getFullYear()} Pastry Palace - All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminReport;