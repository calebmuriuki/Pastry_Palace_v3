// components/OrderTracking.tsx
import { useParams, useNavigate } from 'react-router-dom';
import PageLayout from './PageLayout';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Loader2, MapPin, ArrowLeft } from 'lucide-react';
import { OpenStreetMap } from './OpenStreetMap';
import { useDeliveryTracking } from '../hooks/useDeliveryTracking';
import { toast } from 'sonner';

const OrderTracking = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const id = orderId ? parseInt(orderId) : 0;
  
  const {
    tracking,
    loading,
    error,
    isLive,
    progressPercentage,
    formattedETA,
    distanceRemaining,
    statusColor,
  } = useDeliveryTracking({
    orderId: id,
    autoRefresh: true,
  });

  const copyTrackingLink = () => {
    const link = `${window.location.origin}/track/${tracking?.order_number}`;
    navigator.clipboard.writeText(link);
    toast.success('Tracking link copied!');
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-pink-500" />
        </div>
      </PageLayout>
    );
  }

  if (error || !tracking) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Tracking Unavailable</h2>
            <p className="text-gray-600 mb-6">
              {error || 'Tracking information will appear once available'}
            </p>
            <Button onClick={() => navigate('/cakes')} className="bg-pink-500 hover:bg-pink-600">
              Continue Shopping
            </Button>
          </Card>
        </div>
      </PageLayout>
    );
  }

  // Ensure both lat and lng exist before creating driverLocation
  const hasDriverLocation = tracking.current_latitude !== null && tracking.current_latitude !== undefined &&
                            tracking.current_longitude !== null && tracking.current_longitude !== undefined;

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-8 mt-20 max-w-5xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/cakes')}
            className="mb-6 hover:bg-pink-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Shopping
          </Button>

          {/* Header */}
          <Card className={`p-6 mb-6 border-2 ${statusColor}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Track Your Order</h1>
                <p className="text-gray-500">Order #{tracking.order_number}</p>
              </div>
              <div className={`px-4 py-2 rounded-full text-sm font-semibold bg-white/50`}>
                {tracking.order_status.replace('_', ' ').toUpperCase()}
              </div>
            </div>
          </Card>

          {/* Map - Fixed driverLocation type */}
          <Card className="p-4 mb-6 overflow-hidden">
            <OpenStreetMap
              pickupLocation={{
                lat: tracking.pickup_latitude,
                lng: tracking.pickup_longitude,
              }}
              destination={{
                lat: tracking.destination_latitude,
                lng: tracking.destination_longitude,
              }}
              driverLocation={hasDriverLocation ? {
                lat: tracking.current_latitude!,
                lng: tracking.current_longitude!,
              } : null}
              driverInfo={tracking.driver_name ? {
                name: tracking.driver_name,
                phone: tracking.driver_phone || '',
                vehicle: tracking.vehicle_number || '',
              } : null}
              isLive={isLive}
            />
          </Card>

          {/* Info Cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <p className="text-sm text-gray-500">Progress</p>
              <p className="text-2xl font-bold text-pink-600">{Math.round(progressPercentage)}%</p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-pink-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-500">Estimated Arrival</p>
              <p className="text-2xl font-bold text-pink-600">{formattedETA}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-500">Distance Remaining</p>
              <p className="text-2xl font-bold text-pink-600">{distanceRemaining}</p>
            </Card>
          </div>

          {/* Share Button */}
          <div className="flex justify-center">
            <Button
              onClick={copyTrackingLink}
              variant="outline"
              className="border-pink-300 text-pink-600 hover:bg-pink-50"
            >
              Share Tracking Link
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default OrderTracking;