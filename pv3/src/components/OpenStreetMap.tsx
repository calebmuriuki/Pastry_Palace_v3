// components/OpenStreetMap.tsx
// React-Leaflet v4 compatible version

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Phone, MapPin, Navigation } from 'lucide-react';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom markers
const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Location {
  lat: number;
  lng: number;
}

interface DriverInfo {
  name: string;
  phone: string;
  vehicle: string;
  photo?: string;
}

interface OpenStreetMapProps {
  pickupLocation: Location;
  destination: Location;
  driverLocation?: Location | null;
  driverInfo?: DriverInfo | null;
  isLive?: boolean;
  height?: string;
  className?: string;
}

// Component to auto-fit bounds
const FitBounds: React.FC<{ locations: Location[] }> = ({ locations }) => {
  const map = useMap();
  
  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, map]);
  
  return null;
};

// Simple routing component (no external routing machine)
const SimpleRoute: React.FC<{
  origin: Location;
  destination: Location;
  isLive?: boolean;
}> = ({ origin, destination, isLive = false }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !origin || !destination) return;
    
    // Draw a straight line between points (simplified)
    const points: [number, number][] = [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng],
    ];
    
    const polyline = L.polyline(points, {
      color: isLive ? '#3b82f6' : '#9ca3af',
      weight: 4,
      opacity: 0.8,
    }).addTo(map);
    
    return () => {
      map.removeLayer(polyline);
    };
  }, [map, origin, destination, isLive]);
  
  return null;
};

export const OpenStreetMap: React.FC<OpenStreetMapProps> = ({
  pickupLocation,
  destination,
  driverLocation,
  driverInfo,
  isLive = false,
  height = '400px',
  className = '',
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    (pickupLocation.lat + destination.lat) / 2,
    (pickupLocation.lng + destination.lng) / 2,
  ]);

  // Update center for live tracking
  useEffect(() => {
    if (isLive && driverLocation) {
      setMapCenter([driverLocation.lat, driverLocation.lng]);
    } else {
      setMapCenter([
        (pickupLocation.lat + destination.lat) / 2,
        (pickupLocation.lng + destination.lng) / 2,
      ]);
    }
  }, [driverLocation, pickupLocation, destination, isLive]);

  const allLocations = [
    pickupLocation,
    destination,
    ...(driverLocation ? [driverLocation] : [])
  ].filter(Boolean) as Location[];

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-gray-200 shadow-lg ${className}`} style={{ height }}>
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Simple route line */}
        <SimpleRoute origin={pickupLocation} destination={destination} isLive={isLive} />
        
        {/* Pickup Marker */}
        <Marker 
          position={[pickupLocation.lat, pickupLocation.lng]}
          icon={pickupIcon}
        >
          <Popup>
            <div className="p-2 min-w-[140px]">
              <p className="font-bold text-green-600 flex items-center gap-1">
                <MapPin className="w-4 h-4" /> Pickup
              </p>
              <p className="text-sm text-gray-600">Our Bakery</p>
            </div>
          </Popup>
        </Marker>
        
        {/* Destination Marker */}
        <Marker 
          position={[destination.lat, destination.lng]}
          icon={destinationIcon}
        >
          <Popup>
            <div className="p-2 min-w-[140px]">
              <p className="font-bold text-red-600 flex items-center gap-1">
                <MapPin className="w-4 h-4" /> Delivery
              </p>
              <p className="text-sm text-gray-600">Your Address</p>
            </div>
          </Popup>
        </Marker>
        
        {/* Driver Marker */}
        {driverLocation && isLive && (
          <Marker 
            position={[driverLocation.lat, driverLocation.lng]}
            icon={driverIcon}
          >
            <Popup>
              <div className="p-3 min-w-[200px]">
                {driverInfo && (
                  <>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Navigation className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-blue-600">Your Driver</p>
                        <p className="text-sm font-medium">{driverInfo.name}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">🚗 {driverInfo.vehicle}</p>
                    <a 
                      href={`tel:${driverInfo.phone}`} 
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2 pt-2 border-t"
                    >
                      <Phone className="w-3 h-3" /> Call {driverInfo.phone}
                    </a>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        )}
        
        <FitBounds locations={allLocations} />
      </MapContainer>
      
      {/* Live Indicator */}
      {isLive && (
        <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg z-[1000]">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          LIVE TRACKING
        </div>
      )}
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 px-3 py-1.5 rounded-md text-xs text-gray-600 z-[1000] shadow-sm border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Pickup</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Delivery</span>
          </div>
          {isLive && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Driver</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};