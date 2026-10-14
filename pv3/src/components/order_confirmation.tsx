// components/OrderConfirmation.tsx
// Fixes vs previous version:
//   ✓ order.payment_status removed — inferred from order.status
//   ✓ order.email → order.customer_email
//   ✓ order.phone → order.customer_phone
//   ✓ order.address/city/zip_code → order.delivery_address
//   ✓ order.subtotal/tax/shipping/total → read from navigation state
//   ✓ order.total → order.total_amount (fallback)
//   ✓ order.payment_method — read from Payment via getPaymentStatus()
//   ✓ item.product_price → item.unit_price
//   ✓ item.item_total → item.subtotal
//   ✓ order.sms_consent/sms_channel — removed ExtendedOrder hack,
//     NotificationPreferences component manages its own state

import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { NotificationPreferences } from "../components/NotificationPreferences";
import PageLayout from "./PageLayout";
import {
  CheckCircle2, Clock, XCircle, Package, Truck,
  Home, Mail, Phone, MapPin, Loader2,
  Smartphone, Copy, Share2, CreditCard
} from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import type { Order, Payment, OrderStatus } from "../lib/api";

// Navigation state shape — passed from Checkout.tsx on navigate()
interface LocationState {
  tracking_token?: string;
  tracking_url?: string;
  pending_payment?: boolean;
  // Breakdown passed from Checkout since Order model only has total_amount
  subtotal?: number;
  tax?: number;
  shipping?: number;
  total?: number;
}

// ── Payment state helpers ────────────────────────────────────────────────────
// Order has no payment_status field. We derive payment state from order.status:
//   pending   → waiting for payment
//   confirmed → payment succeeded
//   cancelled → order was cancelled (payment may have failed)
//   all others (preparing/ready/completed) → payment succeeded

const isPaymentComplete = (status: OrderStatus): boolean =>
  status !== 'pending' && status !== 'cancelled';

const isPaymentFailed = (status: OrderStatus): boolean =>
  status === 'cancelled';

const isPaymentPending = (status: OrderStatus): boolean =>
  status === 'pending';

const OrderConfirmation = () => {
  const { order_id } = useParams<{ order_id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingInfo, setTrackingInfo] = useState<{
    token: string | null;
    url: string | null;
  }>({ token: null, url: null });

  // Read breakdown from navigation state (set by Checkout.tsx)
  // Falls back to 0 if user navigated directly to this URL
  const state = (location.state ?? {}) as LocationState;
  const navSubtotal = state.subtotal ?? 0;
  const navTax = state.tax ?? 0;
  const navShipping = state.shipping ?? 0;
  const navTotal = state.total ?? 0;

  // ── Tracking token ─────────────────────────────────────────────────────────
  useEffect(() => {
    const s = location.state as LocationState;
    if (s?.tracking_token) {
      setTrackingInfo({
        token: s.tracking_token,
        url: s.tracking_url
          || `${window.location.origin}/track/${s.tracking_token}`,
      });
    } else {
      // Fallback: check localStorage (Checkout.tsx saves it there too)
      const stored = localStorage.getItem(`tracking_${order_id}`);
      if (stored) {
        setTrackingInfo({
          token: stored,
          url: `${window.location.origin}/track/${stored}`,
        });
      }
    }
  }, [location, order_id]);

  // ── Load order ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchOrder = async () => {
      if (!order_id) {
        setError("Order ID not found");
        setLoading(false);
        return;
      }

      try {
        const [orderData, paymentData] = await Promise.allSettled([
          api.getOrder(parseInt(order_id)),
          api.getPaymentStatus(parseInt(order_id)),
        ]);

        if (orderData.status === 'fulfilled') {
          const o = orderData.value;
          setOrder(o);

          if (isPaymentComplete(o.status)) {
            toast.success("Payment confirmed! 🎉", {
              description: `Order #${o.order_number} is confirmed.`,
              duration: 5000,
            });
          } else if (isPaymentFailed(o.status)) {
            toast.error("Payment failed", {
              description: "Please try again or contact support.",
              duration: 5000,
            });
          }
        } else {
          setError("Failed to load order details");
        }

        if (paymentData.status === 'fulfilled') {
          setPayment(paymentData.value);
        }
      } catch (err) {
        setError("Failed to load order details");
        toast.error("Could not load order", {
          description: "Please check your email for confirmation.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [order_id]);

  // ── Status banner helpers ──────────────────────────────────────────────────
  const getStatusIcon = () => {
    if (!order) return <Clock className="w-20 h-20 text-yellow-500" />;
    if (isPaymentComplete(order.status))
      return <CheckCircle2 className="w-20 h-20 text-green-500" />;
    if (isPaymentFailed(order.status))
      return <XCircle className="w-20 h-20 text-red-500" />;
    return <Clock className="w-20 h-20 text-yellow-500" />;
  };

  const getStatusMessage = () => {
    if (!order) return null;

    if (isPaymentComplete(order.status)) {
      return {
        title: "Order Confirmed! 🎉",
        description: "Your payment has been received and your order is being prepared.",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        textColor: "text-green-800",
      };
    }
    if (isPaymentFailed(order.status)) {
      return {
        title: "Order Cancelled",
        description: "This order was cancelled. If you paid, a refund will be processed within 3–5 business days.",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        textColor: "text-red-800",
      };
    }
    return {
      title: "Awaiting Payment",
      description: payment?.payment_method === 'mpesa'
        ? "Complete the M-Pesa prompt on your phone to finalise payment."
        : "Your payment is being processed.",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      textColor: "text-yellow-800",
    };
  };

  const getOrderStatusDisplay = (status: OrderStatus): string => ({
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }[status] ?? status);

  const copyTrackingLink = () => {
    if (trackingInfo.url) {
      navigator.clipboard.writeText(trackingInfo.url);
      toast.success("Tracking link copied! 📋");
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-16 h-16 animate-spin text-pink-500 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Loading your order...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !order) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
          <Card className="p-8 max-w-md mx-4 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Not Found</h2>
            <p className="text-gray-600 mb-6">{error ?? "We couldn't find this order."}</p>
            <Button onClick={() => navigate("/cakes")} className="bg-pink-500 hover:bg-pink-600">
              Continue Shopping
            </Button>
          </Card>
        </div>
      </PageLayout>
    );
  }

  const statusInfo = getStatusMessage();

  // Fall back to order.total_amount if checkout state wasn't passed
  // (e.g. page was refreshed or navigated to directly)
  const displayTotal = navTotal || parseFloat(order.total_amount) || 0;
  const displaySubtotal = navSubtotal || displayTotal;
  const displayTax = navTax;
  const displayShipping = navShipping;

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-8 mt-20 max-w-4xl">

          {/* Status Banner */}
          <Card className={`p-8 mb-8 border-2 ${statusInfo?.borderColor} ${statusInfo?.bgColor} shadow-xl`}>
            <div className="flex flex-col items-center text-center">
              {getStatusIcon()}
              <h1 className={`text-3xl font-bold mt-4 mb-2 ${statusInfo?.textColor}`}>
                {statusInfo?.title}
              </h1>
              <p className="text-gray-700 text-lg mb-4">{statusInfo?.description}</p>
              <div className="flex items-center gap-2 text-gray-600">
                <span className="font-semibold">Order Number:</span>
                <span className="text-2xl font-bold text-pink-600">{order.order_number}</span>
              </div>
            </div>
          </Card>

          {/* Tracking Link Banner */}
          {trackingInfo.token && (
            <Card className="mb-8 p-6 bg-blue-50 border-blue-200 border-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Share2 className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-blue-800 text-lg">Track Your Order</h3>
                    <p className="text-sm text-blue-700">Share this link to track your order status in real-time</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    value={trackingInfo.url ?? ''}
                    readOnly
                    className="bg-white text-sm font-mono flex-1 sm:w-80"
                  />
                  <Button onClick={copyTrackingLink} variant="outline" className="border-blue-300 hover:bg-blue-100">
                    <Copy className="w-4 h-4 mr-2" />Copy
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left — Order Details */}
            <div className="lg:col-span-2 space-y-6">

              {/* Order Items */}
              <Card className="p-6 border-2 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-pink-500" />
                  <h2 className="text-xl font-bold text-gray-800">Order Items</h2>
                </div>
                <Separator className="mb-4" />
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-start pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{item.product_name}</p>
                        {item.variant_name && (
                          <p className="text-sm text-gray-500">{item.variant_name}</p>
                        )}
                        {/* FIX: was item.product_price → item.unit_price */}
                        <p className="text-sm text-gray-500">
                          Qty: {item.quantity} × KSh {parseFloat(item.unit_price).toFixed(2)}
                        </p>
                      </div>
                      {/* FIX: was item.item_total → item.subtotal */}
                      <p className="font-bold text-gray-800">
                        KSh {parseFloat(String(item.subtotal)).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Delivery Information */}
              <Card className="p-6 border-2 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="w-5 h-5 text-pink-500" />
                  <h2 className="text-xl font-bold text-gray-800">Delivery Information</h2>
                </div>
                <Separator className="mb-4" />
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-700">Delivery Address</p>
                      {/* FIX: was order.address/city/zip_code → order.delivery_address */}
                      <p className="text-gray-600">{order.delivery_address || '—'}</p>
                    </div>
                  </div>
                  {order.delivery_date && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-700">Delivery Date &amp; Time</p>
                        <p className="text-gray-600">
                          {order.delivery_date}
                          {order.delivery_time ? ` at ${order.delivery_time}` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-700">Email</p>
                      {/* FIX: was order.email → order.customer_email */}
                      <p className="text-gray-600">{order.customer_email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-700">Phone</p>
                      {/* FIX: was order.phone → order.customer_phone */}
                      <p className="text-gray-600">{order.customer_phone}</p>
                    </div>
                  </div>
                  {order.special_instructions && (
                    <div className="flex items-start gap-3">
                      <Package className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-700">Special Instructions</p>
                        <p className="text-gray-600">{order.special_instructions}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Payment Information */}
              <Card className="p-6 border-2 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  {payment?.payment_method === 'mpesa'
                    ? <Smartphone className="w-5 h-5 text-green-500" />
                    : <CreditCard className="w-5 h-5 text-pink-500" />
                  }
                  <h2 className="text-xl font-bold text-gray-800">Payment Details</h2>
                </div>
                <Separator className="mb-4" />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-semibold text-gray-800 uppercase">
                      {payment?.payment_method === 'mpesa' ? 'M-Pesa' : payment?.payment_method ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Status:</span>
                    {/* FIX: was order.payment_status → derived from order.status */}
                    <span className={`font-semibold uppercase ${isPaymentComplete(order.status) ? 'text-green-600' :
                        isPaymentFailed(order.status) ? 'text-red-600' :
                          'text-yellow-600'
                      }`}>
                      {isPaymentComplete(order.status) ? 'Completed' :
                        isPaymentFailed(order.status) ? 'Cancelled' :
                          'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Status:</span>
                    <span className={`font-semibold uppercase ${order.status === 'completed' ? 'text-green-600' :
                        order.status === 'cancelled' ? 'text-red-600' :
                          order.status === 'ready' ? 'text-purple-600' :
                            'text-blue-600'
                      }`}>
                      {getOrderStatusDisplay(order.status)}
                    </span>
                  </div>
                  {payment?.mpesa_transaction_id && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">M-Pesa Receipt:</span>
                      <span className="font-semibold text-gray-800 font-mono text-sm">
                        {payment.mpesa_transaction_id}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Notification Preferences */}
              <div className="mt-6">
                <NotificationPreferences
                  orderId={order.id}
                  initialPreferences={{
                    email: true,
                    sms: false,
                    whatsapp: false,
                    sms_consent: false,
                    sms_channel: 'sms',
                  }}
                  onUpdate={(prefs) => {
                    toast.success("Notification preferences updated", {
                      description: prefs.sms_consent
                        ? `Updates via ${prefs.sms_channel?.toUpperCase()}`
                        : "Email updates only",
                      duration: 3000,
                    });
                  }}
                />
              </div>
            </div>

            {/* Right — Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="p-6 border-2 sticky top-24 shadow-lg">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Order Summary</h2>
                <Separator className="mb-4" />

                <div className="space-y-3">
                  {/* Show breakdown if we have it from nav state, else just total */}
                  {navSubtotal > 0 ? (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span className="font-semibold">KSh {displaySubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Tax (8%)</span>
                        <span className="font-semibold">KSh {displayTax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Delivery</span>
                        <span className="font-semibold">
                          {displayShipping === 0
                            ? <span className="text-green-600">FREE</span>
                            : `KSh ${displayShipping.toFixed(2)}`
                          }
                        </span>
                      </div>
                      <Separator className="my-3" />
                    </>
                  ) : null}

                  <div className="flex justify-between text-xl font-bold">
                    <span className="text-gray-800">Total</span>
                    {/* FIX: was order.total → order.total_amount */}
                    <span className="text-pink-600">
                      KSh {displayTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <Button
                    onClick={() => navigate("/cakes")}
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Continue Shopping
                  </Button>

                  {trackingInfo.token && (
                    <Button
                      onClick={() => navigate(`/track/${trackingInfo.token}`)}
                      variant="outline"
                      className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Track Order Status
                    </Button>
                  )}

                  {isPaymentPending(order.status) && payment?.payment_method === 'mpesa' && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800 text-center">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Waiting for M-Pesa payment...
                      </p>
                      <p className="text-xs text-yellow-600 text-center mt-2">
                        Check your phone for the STK Push prompt
                      </p>
                    </div>
                  )}

                  {isPaymentFailed(order.status) && (
                    <Button
                      onClick={() => navigate("/checkout")}
                      variant="outline"
                      className="w-full border-2 border-red-500 text-red-600 hover:bg-red-50"
                    >
                      Retry Payment
                    </Button>
                  )}
                </div>

                <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-gray-600 text-center">
                    📧 A confirmation email has been sent to{' '}
                    <strong>{order.customer_email}</strong>
                  </p>
                  {trackingInfo.token && (
                    <p className="text-xs text-gray-600 text-center mt-2">
                      🔗 Share your tracking link for real-time updates
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default OrderConfirmation;