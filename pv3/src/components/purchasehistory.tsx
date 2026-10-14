// src/components/PurchaseHistory.tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  Clock, 
  Package, 
  CreditCard,
  TrendingUp,
  Search,
  Eye,
  AlertCircle,
  Printer,
  FileText,
  Loader2
} from 'lucide-react';
import type { Purchase } from '../components/types/purchase';
import { purchaseService } from '../services/PurchaseService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ⚠️ NO CSS IMPORT - Everything is inline or using Tailwind classes

interface PurchaseHistoryProps {
  userId: string;
}

const PurchaseHistory: React.FC<PurchaseHistoryProps> = ({ userId }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchPurchaseHistory();
  }, [userId]);

  const fetchPurchaseHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
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

  const handlePrint = () => {
    window.print();
  };

  const generatePDF = async () => {
    if (!contentRef.current) {
      console.error('Content not found');
      return;
    }

    setIsGeneratingPDF(true);
    
    try {
      console.log('📄 Generating PDF...');
      
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

      const fileName = `purchase-history-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      console.log('✅ PDF generated successfully!');
      
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Filter and sort purchases
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

  // Loading State
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent"></div>
          <p className="text-gray-600">Loading your purchase history...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
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
    );
  }

  return (
    <div id="purchase-history-content" ref={contentRef} className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-600 rounded-lg text-white">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-teal-900">{stats.totalOrders}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg text-white">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Spent</p>
              <p className="text-2xl font-bold text-purple-900">{formatCurrency(stats.totalSpent)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Order</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(stats.averageOrderValue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
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
        </div>
      </div>

      {/* ⭐ FILTERS SECTION - WITH VISIBLE BUTTONS ⭐ */}
      <div 
        className="bg-white rounded-xl border border-gray-200 p-4"
        style={{ 
          display: 'block', 
          visibility: 'visible', 
          opacity: 1,
          border: '2px solid blue' // Temporary debug border
        }}
      >
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

          {/* ⭐ BUTTON CONTAINER - With explicit styles ⭐ */}
          <div 
            className="flex gap-2 flex-wrap items-center"
            style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '8px', 
              alignItems: 'center',
              padding: '4px',
              border: '2px solid red' // Temporary debug border
            }}
          >
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

            {/* ⭐ PRINT BUTTON - With explicit styles ⭐ */}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center gap-2"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                border: '2px solid green',
                cursor: 'pointer',
                color: '#374151',
                fontWeight: '500',
                fontSize: '14px',
                visibility: 'visible',
                opacity: 1
              }}
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>

            {/* ⭐ PDF BUTTON - With explicit styles ⭐ */}
            <button
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              className="px-4 py-2 text-white rounded-lg transition flex items-center gap-2"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: isGeneratingPDF ? '#2dd4bf' : '#0d9488',
                borderRadius: '8px',
                border: '2px solid orange',
                cursor: isGeneratingPDF ? 'not-allowed' : 'pointer',
                color: 'white',
                fontWeight: '500',
                fontSize: '14px',
                visibility: 'visible',
                opacity: isGeneratingPDF ? 0.5 : 1
              }}
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

            {/* ⭐ TEST BUTTON ⭐ */}
            <button
              onClick={() => alert('✅ Test button works!')}
              className="px-4 py-2 bg-red-500 text-white rounded-lg"
              style={{
                display: 'inline-flex',
                padding: '8px 16px',
                backgroundColor: '#ef4444',
                borderRadius: '8px',
                border: '2px solid purple',
                cursor: 'pointer',
                color: 'white',
                fontWeight: '500',
                fontSize: '14px',
                visibility: 'visible',
                opacity: 1
              }}
            >
              Test
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

                {/* Expanded Details */}
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
                                    {item.image_url && (
                                      <img 
                                        src={item.image_url} 
                                        alt={item.product_name}
                                        className="w-12 h-12 object-cover rounded-lg"
                                      />
                                    )}
                                    <div>
                                      <p className="font-medium text-gray-900">{item.product_name}</p>
                                      <p className="text-sm text-gray-500">
                                        Qty: {item.quantity} × {formatCurrency(item.price)}
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
    </div>
  );
};

export default PurchaseHistory;