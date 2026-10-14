// hooks/useDeliveryTracking.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { DeliveryTracking } from '../lib/api';
import { api } from '../lib/api';

export interface TrackingState {
  tracking: DeliveryTracking | null;
  loading: boolean;
  error: string | null;
  isLive: boolean;
  progressPercentage: number;
  formattedETA: string;
  distanceRemaining: string;
  durationRemaining: string;
  statusColor: string;
}

interface UseDeliveryTrackingOptions {
  orderId: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    confirmed: 'text-blue-600 bg-blue-50 border-blue-200',
    preparing: 'text-purple-600 bg-purple-50 border-purple-200',
    ready: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    out_for_delivery: 'text-green-600 bg-green-50 border-green-200',
    completed: 'text-gray-600 bg-gray-50 border-gray-200',
    cancelled: 'text-red-600 bg-red-50 border-red-200',
  };
  return colors[status] || 'text-gray-600 bg-gray-50 border-gray-200';
};

const formatETA = (etaString: string | null | undefined): string => {
  if (!etaString) return 'Calculating...';
  const eta = new Date(etaString);
  const now = new Date();
  const diffSeconds = Math.floor((eta.getTime() - now.getTime()) / 1000);
  if (diffSeconds <= 0) return 'Arriving soon';
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes} min`;
  return `${diffSeconds} sec`;
};

const formatDistance = (meters: number): string => {
  if (meters <= 0) return 'Arriving';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return 'Arriving';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds} sec`;
};

const calculateProgress = (tracking: DeliveryTracking | null): number => {
  if (!tracking || tracking.total_distance === 0) return 0;
  const completed = tracking.total_distance - tracking.distance_remaining;
  return Math.min(100, Math.max(0, (completed / tracking.total_distance) * 100));
};

export const useDeliveryTracking = ({
  orderId,
  autoRefresh = true,
  refreshInterval = 5000,
  
}: UseDeliveryTrackingOptions): TrackingState & { refetch: () => Promise<void> } => {
  const [tracking, setTracking] = useState<DeliveryTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progressPercentage = calculateProgress(tracking);
  const formattedETA = formatETA(tracking?.estimated_arrival);
  const distanceRemaining = formatDistance(tracking?.distance_remaining || 0);
  const durationRemaining = formatDuration(tracking?.duration_remaining || 0);
  const statusColor = getStatusColor(tracking?.order_status || 'pending');

  const fetchTracking = useCallback(async () => {
    if (!orderId || orderId === 0) return;
    
    try {
      // Convert orderId to string for API call (since getDeliveryTracking expects string token)
      const trackingToken = orderId.toString();
      const data = await api.getDeliveryTracking(trackingToken as any);
      if (!data) {
        setLoading(false);
        return;
      }
      setTracking(data);
      setIsLive(data.is_live_tracking);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch delivery tracking:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tracking data');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchTracking();
    
    if (autoRefresh) {
      intervalRef.current = setTimeout(() => {
        fetchTracking();
      }, refreshInterval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchTracking, autoRefresh, refreshInterval]);

  return {
    tracking,
    loading,
    error,
    isLive,
    progressPercentage,
    formattedETA,
    distanceRemaining,
    durationRemaining,
    statusColor,
    refetch: fetchTracking,
  };
};