// components/OrderTimeline.tsx
import { CheckCircle2, Package, ChefHat, ShoppingBag, Truck, AlertCircle } from "lucide-react";
import type { OrderStatus } from "../lib/api";

export interface TimelineStep {
    key: OrderStatus;
    label: string;
    icon: React.ReactNode;
    description: string;
    timestamp?: string | null;
}

interface OrderTimelineProps {
    currentStatus: OrderStatus;
    steps?: TimelineStep[];
    timestamps?: {
        payment_confirmed_at?: string | null;
        bake_started_at?: string | null;
        ready_at?: string | null;
        completed_at?: string | null;
    };
    showProgress?: boolean;
    className?: string;
}

const defaultSteps: TimelineStep[] = [
    {
        key: 'pending',
        label: 'Order Placed',
        icon: <ShoppingBag className="w-5 h-5" />,
        description: 'Your order has been received'
    },
    {
        key: 'confirmed',
        label: 'Payment Confirmed',
        icon: <CheckCircle2 className="w-5 h-5" />,
        description: 'Payment verified, order confirmed'
    },
    {
        key: 'preparing',
        label: 'Baking in Progress',
        icon: <ChefHat className="w-5 h-5" />,
        description: 'Your baker is preparing your order'
    },
    {
        key: 'ready',
        label: 'Ready for Pickup',
        icon: <Package className="w-5 h-5" />,
        description: 'Order is ready for collection'
    },
    {
        key: 'completed',
        label: 'Delivered',
        icon: <Truck className="w-5 h-5" />,
        description: 'Order has been delivered'
    }
];

const statusOrder: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];

const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-KE', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const OrderTimeline = ({
    currentStatus,
    steps = defaultSteps,
    timestamps = {},
    showProgress = true,
    className = ''
}: OrderTimelineProps) => {
    const getCurrentStatusIndex = (status: OrderStatus): number => {
        return statusOrder.indexOf(status);
    };

    const isStepCompleted = (stepKey: OrderStatus): boolean => {
        return getCurrentStatusIndex(stepKey) <= getCurrentStatusIndex(currentStatus);
    };

    const isStepCurrent = (stepKey: OrderStatus): boolean => {
        return stepKey === currentStatus;
    };

    const getStepTimestamp = (stepKey: OrderStatus): string | null => {
        switch (stepKey) {
            case 'confirmed':
                return timestamps.payment_confirmed_at || null;
            case 'preparing':
                return timestamps.bake_started_at || null;
            case 'ready':
                return timestamps.ready_at || null;
            case 'completed':
                return timestamps.completed_at || null;
            default:
                return null;
        }
    };

    const currentStatusIndex = getCurrentStatusIndex(currentStatus);
    const isCancelled = currentStatus === 'cancelled';
    const isCompleted = currentStatus === 'completed';

    if (isCancelled) {
        return (
            <div className={`p-6 bg-red-50 rounded-lg border border-red-200 text-center ${className}`}>
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-red-800 mb-2">Order Cancelled</h3>
                <p className="text-red-700">This order has been cancelled.</p>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-200 hidden md:block" />

                {/* Timeline Steps */}
                <div className="space-y-6 md:space-y-0 md:flex md:justify-between md:relative">
                    {steps.map((step, index) => {
                        const completed = isStepCompleted(step.key);
                        const current = isStepCurrent(step.key);
                        const timestamp = getStepTimestamp(step.key);

                        return (
                            <div key={step.key} className="relative flex md:flex-col items-center md:items-center gap-3 md:gap-2">
                                {/* Status Circle */}
                                <div className={`
                  relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all
                  ${completed ? 'bg-green-500' : current ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}
                  ${current ? 'ring-4 ring-blue-200' : ''}
                `}>
                                    <div className="text-white">
                                        {step.icon}
                                    </div>
                                </div>

                                {/* Status Label */}
                                <div className="flex-1 md:text-center">
                                    <p className={`font-semibold text-sm ${completed || current ? 'text-gray-900' : 'text-gray-400'}`}>
                                        {step.label}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1 hidden md:block">
                                        {step.description}
                                    </p>

                                    {/* Timestamp */}
                                    {timestamp && completed && (
                                        <p className="text-xs text-green-600 mt-1">
                                            {formatDateTime(timestamp)}
                                        </p>
                                    )}
                                </div>

                                {/* Connector Line */}
                                {index < steps.length - 1 && (
                                    <div className={`
                    hidden md:block absolute top-6 left-[calc(50%+24px)] w-[calc(100%-48px)] h-0.5
                    ${completed ? 'bg-green-500' : 'bg-gray-200'}
                  `} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Progress Bar */}
            {showProgress && !isCompleted && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-gray-700">Order Progress</span>
                        <span className="text-xs font-medium text-blue-600">
                            {Math.round((currentStatusIndex / (steps.length - 1)) * 100)}%
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                            className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${(currentStatusIndex / (steps.length - 1)) * 100}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderTimeline;