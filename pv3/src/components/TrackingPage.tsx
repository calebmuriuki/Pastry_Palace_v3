// components/TrackingPage.tsx
// Changes vs previous version:
//   ✓ P1-1: setInterval now clears itself when status reaches
//           'completed' or 'cancelled' — was polling forever
//   ✓ P1-2: dispatched_at now used for completed step timestamp
//           (was missing from TrackingData, now in api.ts)
//   ✓ All TrackingData field names confirmed against api.ts interface
//   ✓ api.trackOrder() now hits correct URL /track/token/ (fixed in api.ts)
//   Everything else — UI, ETA card, is_overdue, cancelled state,
//   share link, items list — preserved exactly.

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import PageLayout from "./PageLayout";
import {
  Loader2, CheckCircle2, Clock, Package,
  ChefHat, ShoppingBag, Truck, AlertCircle,
  Copy, Share2
} from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import type { OrderStatus, TrackingData } from "../lib/api";

// Status step configuration
interface TimelineStep {
  key: OrderStatus;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const timelineSteps: TimelineStep[] = [
  {
    key: 'pending',
    label: 'Order Placed',
    icon: <ShoppingBag className="w-6 h-6" />,
    description: 'Your order has been received',
  },
  {
    key: 'confirmed',
    label: 'Payment Confirmed',
    icon: <CheckCircle2 className="w-6 h-6" />,
    description: 'Payment verified, order confirmed',
  },
  {
    key: 'preparing',
    label: 'Baking in Progress',
    icon: <ChefHat className="w-6 h-6" />,
    description: 'Your baker is preparing your order',
  },
  {
    key: 'ready',
    label: 'Ready for Pickup',
    icon: <Package className="w-6 h-6" />,
    description: 'Order is ready for collection',
  },
  {
    key: 'completed',
    label: 'Delivered',
    icon: <Truck className="w-6 h-6" />,
    description: 'Order has been delivered',
  },
];

const statusOrder: OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'ready', 'completed',
];

// FIX: define terminal statuses — polling stops here
const TERMINAL_STATUSES = new Set<OrderStatus>(['completed', 'cancelled']);

const TrackingPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate  = useNavigate();

  const [tracking,    setTracking]    = useState<TrackingData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Ref so fetchTracking callback can clear the interval without stale closure
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getCurrentStatusIndex = (status: OrderStatus): number =>
    statusOrder.indexOf(status);

  const isStepCompleted = (stepKey: OrderStatus, current: OrderStatus): boolean =>
    getCurrentStatusIndex(stepKey) <= getCurrentStatusIndex(current);

  const isStepCurrent = (stepKey: OrderStatus, current: OrderStatus): boolean =>
    stepKey === current;

  const getStatusColor = (stepKey: OrderStatus, current: OrderStatus): string => {
    if (isStepCompleted(stepKey, current)) return 'bg-green-500 border-green-500';
    if (isStepCurrent(stepKey, current))   return 'bg-blue-500 border-blue-500 animate-pulse';
    return 'bg-gray-300 border-gray-300';
  };

  const getIconColor = (stepKey: OrderStatus, current: OrderStatus): string =>
    isStepCompleted(stepKey, current) || isStepCurrent(stepKey, current)
      ? 'text-white'
      : 'text-gray-400';

  const getTextColor = (stepKey: OrderStatus, current: OrderStatus): string =>
    isStepCompleted(stepKey, current) || isStepCurrent(stepKey, current)
      ? 'text-gray-900'
      : 'text-gray-400';

  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Not yet';
    return new Date(dateString).toLocaleString('en-KE', {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchTracking = async () => {
    if (!token) return;

    try {
      const data = await api.trackOrder(token);
      setTracking(data);
      setLastUpdated(new Date());
      setError(null);

      // FIX P1-1: Stop polling once terminal status reached.
      // Previous version let the interval run forever even after
      // 'completed' or 'cancelled', hitting the server indefinitely.
      if (TERMINAL_STATUSES.has(data.status) && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch {
      setError("Unable to fetch order status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Polling setup ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetchTracking();

    // Poll every 15 seconds for live updates
    intervalRef.current = setInterval(fetchTracking, 15000);

    // Always clear on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [token]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const copyTrackingLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Tracking link copied! 📋", {
      description: "Share this link to track your order status",
    });
  };

  // ── Loading / error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-16 h-16 animate-spin text-pink-500 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Loading tracking information...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !tracking) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
          <Card className="p-8 max-w-md mx-4 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Not Found</h2>
            <p className="text-gray-600 mb-6">
              {error ?? "We couldn't find this order. Please check your tracking link."}
            </p>
            <Button onClick={() => navigate("/cakes")} className="bg-pink-500 hover:bg-pink-600">
              Continue Shopping
            </Button>
          </Card>
        </div>
      </PageLayout>
    );
  }

  const currentStatusIndex = getCurrentStatusIndex(tracking.status);
  const isCompleted        = tracking.status === 'completed';
  const isCancelled        = tracking.status === 'cancelled';

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-8 mt-20 max-w-4xl">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Track Your Order</h1>
            <p className="text-gray-600">
              Order #{tracking.order_number} • {tracking.customer_name}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {formatDateTime(lastUpdated.toISOString())}
              {/* Live badge — only shown while polling is still active */}
              {!TERMINAL_STATUSES.has(tracking.status) && (
                <span className="ml-2 inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                  Live
                </span>
              )}
            </p>
          </div>

          {/* Share Tracking Link */}
          <Card className="mb-8 p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-blue-800 font-medium">
                  Share this link to track your order
                </span>
              </div>
              <Button
                onClick={copyTrackingLink}
                variant="outline"
                size="sm"
                className="border-blue-300 hover:bg-blue-100"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
            </div>
          </Card>

          {/* Status Timeline */}
          <Card className="p-8 mb-8 border-2 shadow-lg">
            <h2 className="text-xl font-bold mb-6 text-gray-800">Order Status</h2>

            {isCancelled ? (
              <div className="p-6 bg-red-50 rounded-lg border border-red-200 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-red-800 mb-2">Order Cancelled</h3>
                <p className="text-red-700">This order has been cancelled.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-8 top-12 bottom-12 w-0.5 bg-gray-200 hidden md:block" />

                <div className="space-y-8 md:space-y-0 md:flex md:justify-between md:relative">
                  {timelineSteps.map((step, index) => {
                    const stepCompleted = isStepCompleted(step.key, tracking.status);
                    const stepCurrent   = isStepCurrent(step.key, tracking.status);

                    // ── Per-step timestamp ─────────────────────────────────
                    // FIX P1-2: 'completed' step uses dispatched_at
                    // (backend field name — was completed_at which doesn't exist)
                    let stepTimestamp: string | null = null;
                    if (stepCompleted) {
                      switch (step.key) {
                        case 'confirmed': stepTimestamp = tracking.payment_confirmed_at; break;
                        case 'preparing': stepTimestamp = tracking.bake_started_at;     break;
                        case 'ready':     stepTimestamp = tracking.ready_at;            break;
                        case 'completed': stepTimestamp = tracking.dispatched_at;       break;
                        default:          stepTimestamp = null;
                      }
                    }

                    return (
                      <div
                        key={step.key}
                        className="relative flex md:flex-col items-center md:items-center gap-4 md:gap-2"
                      >
                        <div className={`
                          relative z-10 w-16 h-16 rounded-full flex items-center justify-center
                          ${getStatusColor(step.key, tracking.status)}
                          ${stepCurrent ? 'ring-4 ring-blue-200' : ''}
                        `}>
                          <div className={getIconColor(step.key, tracking.status)}>
                            {step.icon}
                          </div>
                        </div>

                        <div className="flex-1 md:text-center">
                          <p className={`font-semibold ${getTextColor(step.key, tracking.status)}`}>
                            {step.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 hidden md:block">
                            {step.description}
                          </p>
                          {stepTimestamp && (
                            <p className={`text-xs mt-1 ${
                              step.key === 'confirmed' ? 'text-green-600'  :
                              step.key === 'preparing' ? 'text-blue-600'   :
                              step.key === 'ready'     ? 'text-purple-600' :
                              'text-gray-500'
                            }`}>
                              {formatDateTime(stepTimestamp)}
                            </p>
                          )}
                        </div>

                        {index < timelineSteps.length - 1 && (
                          <div className={`
                            hidden md:block absolute top-8
                            left-[calc(50%+32px)] w-[calc(100%-64px)] h-0.5
                            ${stepCompleted && !isCancelled ? 'bg-green-500' : 'bg-gray-200'}
                          `} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Progress bar */}
            {!isCancelled && !isCompleted && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Order Progress</span>
                  <span className="text-sm font-medium text-blue-600">
                    {Math.round((currentStatusIndex / (timelineSteps.length - 1)) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${(currentStatusIndex / (timelineSteps.length - 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* ETA Card */}
          {tracking.estimated_ready_at && !isCancelled && (
            <Card className={`p-6 mb-8 border-2 ${
              tracking.is_overdue ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-3">
                {tracking.is_overdue
                  ? <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                  : <Clock className="w-6 h-6 text-blue-500 flex-shrink-0" />
                }
                <div>
                  <h3 className={`font-bold ${
                    tracking.is_overdue ? 'text-red-800' : 'text-blue-800'
                  }`}>
                    {tracking.is_overdue ? 'Order Overdue' : 'Estimated Ready Time'}
                  </h3>
                  <p className={`text-lg font-semibold mt-1 ${
                    tracking.is_overdue ? 'text-red-700' : 'text-blue-700'
                  }`}>
                    {formatDateTime(tracking.estimated_ready_at)}
                  </p>
                  {tracking.is_overdue && (
                    <p className="text-sm text-red-600 mt-2">
                      Please contact the bakery for updates on your order.
                    </p>
                  )}
                  {/* FIX: show dispatched_at when order is completed */}
                  {isCompleted && tracking.dispatched_at && (
                    <p className="text-sm text-green-600 mt-2 font-medium">
                      ✓ Delivered at {formatDateTime(tracking.dispatched_at)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Order Items */}
          <Card className="p-6 border-2 shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Order Items</h2>
            <Separator className="mb-4" />
            <div className="space-y-3">
              {tracking.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="font-semibold text-gray-800">{item.product_name}</p>
                    {item.variant_name && (
                      <p className="text-sm text-gray-500">{item.variant_name}</p>
                    )}
                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-gray-800">
                    KSh {parseFloat(item.unit_price).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-800">Total Amount</span>
              <span className="text-xl font-bold text-pink-600">
                KSh {parseFloat(tracking.total_amount).toFixed(2)}
              </span>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4 justify-center">
            <Button
              onClick={() => navigate("/cakes")}
              className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
            >
              Continue Shopping
            </Button>
            <Button
              onClick={copyTrackingLink}
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Tracking Link
            </Button>
          </div>

        </div>
      </div>
    </PageLayout>
  );
};

export default TrackingPage;