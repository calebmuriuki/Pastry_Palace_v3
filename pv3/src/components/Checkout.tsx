// src/components/Checkout.tsx
// ENHANCED VERSION - with Guest Checkout Support + Address Autocomplete + Map Preview Modal

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../Contexts/CartContext";
import { useAuth } from "../Contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import PageLayout from "./PageLayout";
import CheckoutAuthGuard from "./CheckoutAuthGuard";
import { 
  ArrowLeft, CreditCard, Smartphone, Check, Loader2, Copy, Share2, 
  Calendar, Clock, MessageCircle, Truck, MapPin, X, Navigation 
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "../components/ui/form";
import { api } from "../lib/api";
import type { CreateOrderRequest } from "../lib/api";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { OpenStreetMap } from "./OpenStreetMap";

type PaymentMethod = "card" | "mpesa";

// Enhanced schema with delivery options
const checkoutSchema = z.object({
  firstName:   z.string().min(2, "First name must be at least 2 characters"),
  lastName:    z.string().min(2, "Last name must be at least 2 characters"),
  email:       z.string().email("Invalid email address"),
  phone:       z.string().min(10, "Phone number must be at least 10 digits"),
  address:     z.string().min(5, "Address must be at least 5 characters"),
  city:        z.string().min(2, "City must be at least 2 characters"),
  zipCode:     z.string().min(5, "ZIP code must be at least 5 digits"),
  
  deliveryDate: z.string().optional(),
  deliveryTime: z.string().optional(),
  specialInstructions: z.string().max(500, "Instructions must be less than 500 characters").optional(),
  
  smsConsent:  z.boolean().default(false),
  smsChannel:  z.enum(["sms", "whatsapp"]).default("sms"),
  cardNumber:  z.string().optional(),
  cardExpiry:  z.string().optional(),
  cardCvv:     z.string().optional(),
  mpesaPhone:  z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

interface GuestData {
  email: string;
  phone: string;
  name: string;
  address: string;
  createAccount: boolean;
  password?: string;
}

// Generate next available delivery slots
const getDeliverySlots = () => {
  const slots = [];
  const today = new Date();
  
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    slots.push({
      date: dateStr,
      display: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      times: ['09:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00']
    });
  }
  return slots;
};

const Checkout = () => {
  const { items, getTotalPrice, clearCart } = useCart();
  const { user, isAuthenticated, register, login } = useAuth();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mpesa");
  const [paymentStep, setPaymentStep] = useState<'form' | 'processing' | 'waiting'>('form');
  const [trackingInfo, setTrackingInfo] = useState<{ token: string | null; url: string | null }>({
    token: null, url: null,
  });
  const [deliverySlots] = useState(getDeliverySlots());
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [guestData, setGuestData] = useState<GuestData | null>(null);
  
  // Map Preview Modal State
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [previewLocation, setPreviewLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [addressConfirmed, setAddressConfirmed] = useState(false);

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", phone: "",
      address: "", city: "", zipCode: "",
      deliveryDate: "", deliveryTime: "",
      specialInstructions: "",
      smsConsent: false, smsChannel: "sms",
      cardNumber: "", cardExpiry: "", cardCvv: "", mpesaPhone: "",
    },
  });

  const smsConsent = form.watch("smsConsent");
  const selectedDate = form.watch("deliveryDate");
  const addressValue = form.watch("address");
  const cityValue = form.watch("city");
  const zipValue = form.watch("zipCode");

  // Pre-fill form if user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const userData = user as any;
      form.setValue('firstName', userData.first_name || '');
      form.setValue('lastName', userData.last_name || '');
      form.setValue('email', userData.email || '');
    }
  }, [isAuthenticated, user, form]);

  const availableTimes = selectedDate 
    ? deliverySlots.find(slot => slot.date === selectedDate)?.times || []
    : [];

  useEffect(() => {
    if (items.length === 0 && !isProcessing) navigate("/cakes");
  }, [items.length, navigate, isProcessing]);

  const saveTrackingToken = (token: string, orderNumber: string) => {
    localStorage.setItem(`tracking_${orderNumber}`, token);
    setTrackingInfo({
      token,
      url: `${window.location.origin}/track/${token}`,
    });
  };

  const subtotal = getTotalPrice();
  const tax = subtotal * 0.08;
  const shipping = subtotal > 5000 ? 0 : 250;
  const total = subtotal + tax + shipping;
  const freeDeliveryThreshold = 5000;
  const amountToFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);

  const handleAddressSelect = (address: string, lat: number, lng: number) => {
    console.log("📍 Address selected:", address, "Coordinates:", lat, lng);
    setAddressConfirmed(false);
  };

  // ✅ FIX: Enhanced handlePreviewMap with validation - HANDLES ALL RESPONSE FORMATS
  const handlePreviewMap = async () => {
    if (!addressValue || !cityValue) {
      toast.error("Please enter address and city first");
      return;
    }
    
    const fullAddress = `${addressValue}, ${cityValue}, ${zipValue || '00100'}`;
    setIsGeocoding(true);
    
    try {
      const result = await api.geocodeAddress(fullAddress);
      
      // ✅ LOG THE ACTUAL RESPONSE to debug
      console.log('🔍 Geocoding API Response:', JSON.stringify(result, null, 2));
      console.log('🔍 Response type:', typeof result);
      console.log('🔍 Response keys:', result ? Object.keys(result) : 'null');
      
      // ✅ Extract coordinates from various response formats
      let lat: number | undefined;
      let lng: number | undefined;
      
      if (result && typeof result === 'object') {
        const responseObj = result as any;
        
        // Format 1: { lat, lng, formatted_address } - Expected format
        if ('lat' in responseObj && 'lng' in responseObj) {
          lat = Number(responseObj.lat);
          lng = Number(responseObj.lng);
        }
        // Format 2: { latitude, longitude }
        else if ('latitude' in responseObj && 'longitude' in responseObj) {
          lat = Number(responseObj.latitude);
          lng = Number(responseObj.longitude);
        }
        // Format 3: { data: { lat, lng } }
        else if ('data' in responseObj && responseObj.data && typeof responseObj.data === 'object') {
          const data = responseObj.data;
          if ('lat' in data && 'lng' in data) {
            lat = Number(data.lat);
            lng = Number(data.lng);
          } else if ('latitude' in data && 'longitude' in data) {
            lat = Number(data.latitude);
            lng = Number(data.longitude);
          }
        }
        // Format 4: { coordinates: { lat, lng } }
        else if ('coordinates' in responseObj && responseObj.coordinates && typeof responseObj.coordinates === 'object') {
          const coords = responseObj.coordinates;
          if ('lat' in coords && 'lng' in coords) {
            lat = Number(coords.lat);
            lng = Number(coords.lng);
          } else if ('latitude' in coords && 'longitude' in coords) {
            lat = Number(coords.latitude);
            lng = Number(coords.longitude);
          }
        }
        // Format 5: { results: [{ geometry: { location: { lat, lng } } }] } - Google Maps style
        else if ('results' in responseObj && Array.isArray(responseObj.results) && responseObj.results.length > 0) {
          const firstResult = responseObj.results[0];
          if (firstResult?.geometry?.location) {
            lat = Number(firstResult.geometry.location.lat);
            lng = Number(firstResult.geometry.location.lng);
          }
        }
        // Format 6: Array [lat, lng]
        else if (Array.isArray(responseObj) && responseObj.length >= 2) {
          lat = Number(responseObj[0]);
          lng = Number(responseObj[1]);
        }
        // Format 7: Search for ANY numeric properties that look like coordinates
        else {
          // Try common property names
          const possibleLat = responseObj.lat ?? responseObj.latitude ?? responseObj.Lat ?? 
                              responseObj.Latitude ?? responseObj.y ?? responseObj._lat ?? responseObj.latitud;
          const possibleLng = responseObj.lng ?? responseObj.longitude ?? responseObj.Lng ?? 
                              responseObj.Longitude ?? responseObj.x ?? responseObj._lng ?? 
                              responseObj.lon ?? responseObj.longitud;
          
          if (possibleLat !== undefined && possibleLng !== undefined) {
            lat = Number(possibleLat);
            lng = Number(possibleLng);
          }
        }
      }
      
      // ✅ Validate the extracted coordinates
      const isValidLat = (coord: number | undefined): coord is number => {
        return typeof coord === 'number' && 
               !isNaN(coord) && 
               isFinite(coord) &&
               coord >= -90 && coord <= 90; // Latitude range
      };
      
      const isValidLng = (coord: number | undefined): coord is number => {
        return typeof coord === 'number' && 
               !isNaN(coord) && 
               isFinite(coord) &&
               coord >= -180 && coord <= 180; // Longitude range
      };
      
      if (!isValidLat(lat) || !isValidLng(lng)) {
        console.error('❌ Invalid coordinates extracted:', { lat, lng, rawResult: result });
        throw new Error(`Could not extract valid coordinates from response. Got: lat=${lat}, lng=${lng}`);
      }
      
      console.log('✅ Valid coordinates extracted:', { lat, lng });
      setPreviewLocation({ lat, lng });
      setShowMapPreview(true);
      toast.success("Location found! Verify the map before payment.");
      
    } catch (error) {
      console.error('❌ Geocoding error:', error);
      toast.error(error instanceof Error ? error.message : "Could not locate this address. Please check and try again.");
      // ✅ Reset state on error
      setPreviewLocation(null);
      setShowMapPreview(false);
    } finally {
      setIsGeocoding(false);
    }
  };

  // ✅ Safe close modal handler
  const handleCloseMapModal = () => {
    setShowMapPreview(false);
    // Don't clear previewLocation - keep it for re-opening
  };

  // ✅ Confirm address handler
  const confirmAddress = () => {
    setAddressConfirmed(true);
    setShowMapPreview(false);
    toast.success("Delivery address confirmed! ✓");
  };

  // ── GUEST CHECKOUT HANDLER ──────────────────────────────────────────────

  const handleGuestContinue = async (guestData: GuestData) => {
    console.log("👤 Guest continuing:", guestData);
    setGuestData(guestData);
    
    if (guestData.createAccount && guestData.password) {
      try {
        toast.loading("Creating your account...", { duration: 2000 });
        
        const username = guestData.email.split('@')[0];
        let finalUsername = username;
        let counter = 0;
        
        try {
          await register({
            username: finalUsername,
            email: guestData.email,
            password: guestData.password,
            confirm_password: guestData.password,
            first_name: guestData.name.split(' ')[0] || 'Guest',
            last_name: guestData.name.split(' ').slice(1).join(' ') || 'User',
          });
        } catch (regError: any) {
          if (regError.message?.includes('username')) {
            counter++;
            finalUsername = `${username}${counter}`;
            await register({
              username: finalUsername,
              email: guestData.email,
              password: guestData.password,
              confirm_password: guestData.password,
              first_name: guestData.name.split(' ')[0] || 'Guest',
              last_name: guestData.name.split(' ').slice(1).join(' ') || 'User',
            });
          } else {
            throw regError;
          }
        }
        
        await login(guestData.email, guestData.password);
        toast.success("Account created! You're now logged in.");
        
        const formData = form.getValues();
        await processOrder(formData, guestData);
        
      } catch (error: any) {
        console.error("Account creation failed:", error);
        toast.error("Could not create account. Continuing as guest.");
        const formData = form.getValues();
        await processOrder(formData, guestData);
      }
    } else {
      const formData = form.getValues();
      await processOrder(formData, guestData);
    }
  };

  // ── PROCESS ORDER ──────────────────────────────────────────────────────

  const processOrder = async (formData: CheckoutFormData, guestData?: GuestData) => {
    setIsProcessing(true);
    setPaymentStep('processing');

    try {
      let customerName, customerEmail, customerPhone, deliveryAddress;
      
      if (isAuthenticated && user) {
        customerName = `${formData.firstName || user.first_name || ''} ${formData.lastName || user.last_name || ''}`.trim() || user.username;
        customerEmail = formData.email || user.email;
        customerPhone = formData.phone || '';
        deliveryAddress = `${formData.address || ''}, ${formData.city || ''}, ${formData.zipCode || ''}`.trim();
      } else if (guestData) {
        customerName = guestData.name;
        customerEmail = guestData.email;
        customerPhone = guestData.phone;
        deliveryAddress = guestData.address;
      } else {
        customerName = `${formData.firstName} ${formData.lastName}`.trim();
        customerEmail = formData.email;
        customerPhone = formData.phone;
        deliveryAddress = `${formData.address}, ${formData.city}, ${formData.zipCode}`.trim();
      }

      const orderData: CreateOrderRequest = {
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        delivery_date: formData.deliveryDate || null,
        delivery_time: formData.deliveryTime || null,
        special_instructions: formData.specialInstructions || "",
        payment_method: paymentMethod === 'card' ? 'card' : 'mpesa',
        total_amount: total.toFixed(2),
        sms_consent: formData.smsConsent,
        notif_sms: formData.smsConsent && formData.smsChannel === 'sms',
        notif_whatsapp: formData.smsConsent && formData.smsChannel === 'whatsapp',
        items: items.map(item => ({
          product_id: item.id,
          variant_id: item.variantId ?? null,
          product_name: item.name,
          variant_name: item.variantName ?? '',
          unit_price: item.price,
          quantity: item.quantity,
        })),
        mpesa_phone: paymentMethod === 'mpesa' ? formData.mpesaPhone : undefined,
        ...(paymentMethod === 'card' ? {
          card_number: formData.cardNumber?.replace(/\s/g, ''),
          card_expiry: formData.cardExpiry,
          card_cvv: formData.cardCvv,
        } : {}),
      };

      const response = await api.createOrder(orderData);

      if (!response.success) {
        throw new Error(response.error || response.details || 'Order creation failed');
      }

      if (response.tracking_token) {
        saveTrackingToken(response.tracking_token, response.order_number);
      }

      if (paymentMethod === 'mpesa') {
        setPaymentStep('waiting');

        toast.success("STK Push sent! 📱", {
          description: `Check your phone (${formData.mpesaPhone}) to complete payment of KSh ${total.toFixed(2)}`,
          duration: 8000,
        });

        const pollInterval = setInterval(() => {
          setPollingAttempts(prev => prev + 1);
        }, 3000);

        try {
          const paymentResult = await api.pollMPesaStatus(
            response.checkout_request_id!,
            (status) => {
              console.log("🔄 M-Pesa Status Update:", status);
              if (status.payment_status === 'completed') {
                clearInterval(pollInterval);
                toast.success("Payment confirmed! ✅", { duration: 5000 });
              } else if (status.payment_status === 'failed') {
                clearInterval(pollInterval);
                toast.error("Payment failed", {
                  description: status.ResultDesc || "Please try again",
                  duration: 7000,
                });
              }
            }
          );

          clearInterval(pollInterval);

          if (paymentResult.success) {
            toast.success("Order confirmed! 🎉", { duration: 5000 });
            clearCart();
            navigate(`/order-confirmation/${response.order_id}`, {
              state: {
                tracking_token: response.tracking_token,
                tracking_url: response.tracking_url,
                order_number: response.order_number,
                subtotal, tax, shipping, total,
                payment_method: 'mpesa',
                is_guest: !!guestData && !isAuthenticated,
              },
            });
          }
        } catch (pollError) {
          clearInterval(pollInterval);
          console.warn("⚠️ Polling error:", pollError);
          
          toast.warning("Order created but payment verification pending", { duration: 8000 });
          clearCart();
          navigate(`/order-confirmation/${response.order_id}`, {
            state: {
              tracking_token: response.tracking_token,
              tracking_url: response.tracking_url,
              order_number: response.order_number,
              pending_payment: true,
              subtotal, tax, shipping, total,
              payment_method: 'mpesa',
              is_guest: !!guestData && !isAuthenticated,
            },
          });
        }

      } else {
        toast.loading("Processing card payment...", { duration: 2000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast.success("Order confirmed! 🎉", { duration: 7000 });
        clearCart();
        navigate(`/order-confirmation/${response.order_id}`, {
          state: {
            tracking_token: response.tracking_token,
            tracking_url: response.tracking_url,
            order_number: response.order_number,
            subtotal, tax, shipping, total,
            payment_method: 'card',
            is_guest: !!guestData && !isAuthenticated,
          },
        });
      }

    } catch (error) {
      console.error("❌ Order creation failed:", error);
      
      let errorMessage = "Please try again or contact support.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error("Payment failed", { description: errorMessage, duration: 7000 });
      setPaymentStep('form');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── SUBMIT HANDLER ─────────────────────────────────────────────────────

  const onSubmit = async (formData: CheckoutFormData) => {
    await processOrder(formData);
  };

  // ── MAIN RENDER ──────────────────────────────────────────────────────────

  // If not authenticated and no guest data yet, show AuthGuard
  if (!isAuthenticated && !guestData) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 py-12">
          <div className="container mx-auto px-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/cakes")}
              className="mb-6 hover:bg-pink-100 transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Shopping
            </Button>
            <CheckoutAuthGuard onGuestContinue={handleGuestContinue}>
              <div className="text-center py-8">Loading checkout...</div>
            </CheckoutAuthGuard>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Authenticated or guest - show full checkout
  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-8 mt-20">
          <Button
            variant="ghost"
            onClick={() => navigate("/cakes")}
            className="mb-6 hover:bg-pink-100 transition-all duration-300"
            disabled={isProcessing}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Shopping
          </Button>

          {/* Tracking Banner - uses trackingInfo */}
          {trackingInfo.token && !isProcessing && (
            <Card className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 border-2 shadow-lg">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500 p-2 rounded-full">
                    <Share2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-800 text-sm">Track Your Order</p>
                    <p className="text-xs text-blue-600">Share this link to track status in real-time</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <input 
                    value={trackingInfo.url ?? ''} 
                    readOnly 
                    className="flex-1 bg-white text-xs font-mono border border-blue-200 rounded px-3 py-2" 
                  />
                  <Button
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(trackingInfo.url!);
                      toast.success("Tracking link copied!");
                    }}
                    className="border-blue-300 hover:bg-blue-50"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Free Delivery Progress Bar - uses amountToFreeDelivery */}
          {subtotal < freeDeliveryThreshold && (
            <Card className="mb-6 p-4 bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-pink-700 font-medium">🎉 Add KSh {amountToFreeDelivery.toFixed(2)} more for FREE delivery!</span>
                  <span className="text-pink-600 font-bold">{Math.round((subtotal / freeDeliveryThreshold) * 100)}%</span>
                </div>
                <div className="w-full bg-pink-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-pink-500 to-rose-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (subtotal / freeDeliveryThreshold) * 100)}%` }}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Address Confirmation Banner - uses addressConfirmed */}
          {addressConfirmed && (
            <Card className="mb-6 p-3 bg-green-50 border-green-200 border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700">Delivery address confirmed</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setAddressConfirmed(false)}
                  className="text-green-600 hover:text-green-800"
                >
                  Change
                </Button>
              </div>
            </Card>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="p-8 border-2 shadow-xl bg-white/80 backdrop-blur-sm">
                <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                  Complete Your Order
                </h1>

                {/* Processing/Waiting Indicators - uses paymentStep and pollingAttempts */}
                {paymentStep === 'waiting' && (
                  <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Loader2 className="w-10 h-10 animate-spin text-green-600" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-3 h-3 bg-green-600 rounded-full animate-pulse" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-green-800 text-lg">Waiting for M-Pesa Payment</h3>
                        <p className="text-green-700 text-sm mt-1">Enter your M-Pesa PIN on your phone to complete payment</p>
                        <div className="mt-3">
                          <div className="flex items-center gap-2 text-xs text-green-600">
                            <Clock className="w-3 h-3" />
                            <span>Waiting for confirmation...</span>
                            {pollingAttempts > 0 && (
                              <span className="font-mono">({pollingAttempts * 3}s)</span>
                            )}
                          </div>
                          <div className="mt-2 w-full bg-green-200 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-green-600 h-1.5 rounded-full transition-all duration-1000"
                              style={{ width: `${Math.min(100, (pollingAttempts / 40) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {paymentStep === 'processing' && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-pulse">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <p className="text-blue-700 text-sm">Processing your order...</p>
                    </div>
                  </div>
                )}

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    {/* Contact Information */}
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                        <div className="w-1 h-6 bg-pink-500 rounded-full" />
                        Contact Information
                      </h2>
                      <div className="grid md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="firstName" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-600">First Name</FormLabel>
                            <FormControl>
                              <input 
                                placeholder="John" 
                                {...field} 
                                disabled={isProcessing}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="lastName" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-600">Last Name</FormLabel>
                            <FormControl>
                              <input 
                                placeholder="Doe" 
                                {...field} 
                                disabled={isProcessing}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-600">Email</FormLabel>
                            <FormControl>
                              <input 
                                type="email" 
                                placeholder="john@example.com" 
                                {...field}
                                disabled={isProcessing} 
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-600">Phone</FormLabel>
                            <FormControl>
                              <input 
                                placeholder="0722 123456" 
                                {...field} 
                                disabled={isProcessing}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    <Separator />

                    {/* Delivery Options - uses Calendar, Clock, MessageCircle */}
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                        <div className="w-1 h-6 bg-purple-500 rounded-full" />
                        Delivery Options
                      </h2>
                      <div className="space-y-4 bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-lg border border-purple-200">
                        <div className="grid md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="deliveryDate" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-600 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Delivery Date
                              </FormLabel>
                              <FormControl>
                                <select
                                  {...field}
                                  disabled={isProcessing}
                                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                                >
                                  <option value="">Select delivery date</option>
                                  {deliverySlots.map((slot) => (
                                    <option key={slot.date} value={slot.date}>
                                      {slot.display}
                                    </option>
                                  ))}
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />

                          <FormField control={form.control} name="deliveryTime" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-600 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Delivery Time Slot
                              </FormLabel>
                              <FormControl>
                                <select
                                  {...field}
                                  disabled={isProcessing || !selectedDate}
                                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                >
                                  <option value="">Select time slot</option>
                                  {availableTimes.map((time) => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>

                        <FormField control={form.control} name="specialInstructions" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-600 flex items-center gap-2">
                              <MessageCircle className="w-4 h-4" />
                              Special Instructions (Optional)
                            </FormLabel>
                            <FormControl>
                              <textarea
                                {...field}
                                disabled={isProcessing}
                                rows={3}
                                placeholder="e.g., Leave at reception, ring doorbell, gluten-free requirements, etc."
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                              />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-gray-500">{field.value?.length || 0}/500 characters</p>
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    <Separator />

                    {/* Notification Preferences - uses smsConsent */}
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                        <div className="w-1 h-6 bg-blue-500 rounded-full" />
                        Notification Preferences
                      </h2>
                      <div className="space-y-4 bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-200">
                        <FormField control={form.control} name="smsConsent" render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input 
                                type="checkbox" 
                                checked={field.value}
                                onChange={field.onChange} 
                                disabled={isProcessing}
                                className="w-4 h-4 mt-1 text-blue-600 rounded focus:ring-blue-500" 
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-semibold text-blue-800">
                                Receive order updates via SMS/WhatsApp
                              </FormLabel>
                              <p className="text-xs text-blue-600">
                                Get real-time notifications when your order is confirmed, baking, and ready for delivery
                              </p>
                            </div>
                          </FormItem>
                        )} />
                        
                        {smsConsent && (
                          <div className="ml-7 mt-3 space-y-3">
                            <FormField control={form.control} name="smsChannel" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm text-gray-700">Preferred channel:</FormLabel>
                                <div className="flex gap-4 mt-2">
                                  {(['sms', 'whatsapp'] as const).map(ch => (
                                    <label key={ch} className="flex items-center gap-2 cursor-pointer">
                                      <input 
                                        type="radio" 
                                        value={ch}
                                        checked={field.value === ch}
                                        onChange={field.onChange}
                                        disabled={isProcessing}
                                        className="w-4 h-4 text-blue-600" 
                                      />
                                      <span className="text-sm capitalize">
                                        {ch === 'sms' ? '📱 SMS' : '💬 WhatsApp'}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </FormItem>
                            )} />
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Shipping Address - uses Truck, MapPin, AddressAutocomplete, OpenStreetMap */}
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                        <div className="w-1 h-6 bg-green-500 rounded-full" />
                        Shipping Address
                      </h2>
                      <div className="space-y-4">
                        <FormField control={form.control} name="address" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-600 flex items-center gap-2">
                              <Truck className="w-4 h-4" />
                              Street Address
                            </FormLabel>
                            <div className="flex gap-2">
                              <FormControl className="flex-1">
                                <AddressAutocomplete
                                  value={field.value}
                                  onChange={field.onChange}
                                  onSelect={handleAddressSelect}
                                  placeholder="Start typing your address..."
                                  disabled={isProcessing}
                                  className="border-gray-300 focus:border-green-400 focus:ring-green-400 transition-all"
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handlePreviewMap}
                                disabled={isProcessing || isGeocoding || !addressValue || !cityValue}
                                className="border-green-300 hover:bg-green-50 whitespace-nowrap"
                              >
                                {isGeocoding ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <MapPin className="w-4 h-4" />
                                )}
                                <span className="ml-2 hidden sm:inline">Preview</span>
                              </Button>
                            </div>
                            <FormMessage />
                            <p className="text-xs text-gray-500">
                              Click "Preview" to see your delivery location on the map before payment
                            </p>
                          </FormItem>
                        )} />
                        <div className="grid md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="city" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-600">City</FormLabel>
                              <FormControl>
                                <input 
                                  placeholder="Nairobi" 
                                  {...field} 
                                  disabled={isProcessing}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="zipCode" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-600">ZIP Code</FormLabel>
                              <FormControl>
                                <input 
                                  placeholder="00100" 
                                  {...field} 
                                  disabled={isProcessing}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Payment Method - uses CreditCard, Smartphone, Check */}
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                        <div className="w-1 h-6 bg-orange-500 rounded-full" />
                        Payment Method
                      </h2>
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        {(['card', 'mpesa'] as const).map(method => (
                          <button 
                            key={method} 
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            disabled={isProcessing}
                            className={`relative p-4 rounded-lg border-2 transition-all duration-300 transform hover:scale-105
                              ${paymentMethod === method
                                ? method === 'card' 
                                  ? 'border-pink-500 bg-gradient-to-r from-pink-50 to-rose-50 shadow-lg' 
                                  : 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}
                              ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              {method === 'card'
                                ? <CreditCard className="w-5 h-5" />
                                : <Smartphone className="w-5 h-5" />}
                              <span className="font-semibold">
                                {method === 'card' ? 'Card Payment' : 'M-Pesa'}
                              </span>
                            </div>
                            {paymentMethod === method && (
                              <div className={`absolute top-2 right-2 rounded-full p-1
                                ${method === 'card' ? 'bg-pink-500' : 'bg-green-500'}`}>
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              {method === 'card' ? 'Visa, Mastercard, Amex' : 'STK Push Payment'}
                            </p>
                          </button>
                        ))}
                      </div>

                      {paymentMethod === "card" ? (
                        <div className="space-y-4 bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-lg border border-gray-200">
                          <FormField control={form.control} name="cardNumber" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-600">Card Number</FormLabel>
                              <FormControl>
                                <input 
                                  placeholder="1234 5678 9012 3456" 
                                  maxLength={19}
                                  disabled={isProcessing} 
                                  {...field}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/\s/g, '');
                                    const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
                                    field.onChange(formatted);
                                  }}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="cardExpiry" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Expiry Date</FormLabel>
                                <FormControl>
                                  <input 
                                    placeholder="MM/YY" 
                                    maxLength={5} 
                                    disabled={isProcessing} 
                                    {...field}
                                    onChange={(e) => {
                                      let v = e.target.value.replace(/\D/g, '');
                                      if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
                                      field.onChange(v);
                                    }}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="cardCvv" render={({ field }) => (
                              <FormItem>
                                <FormLabel>CVV</FormLabel>
                                <FormControl>
                                  <input 
                                    placeholder="123" 
                                    maxLength={4} 
                                    type="password"
                                    disabled={isProcessing} 
                                    {...field} 
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                          <FormField control={form.control} name="mpesaPhone" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-600">M-Pesa Phone Number</FormLabel>
                              <FormControl>
                                <input 
                                  placeholder="0722 123456 or 254722123456"
                                  maxLength={15} 
                                  disabled={isProcessing} 
                                  {...field}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500" 
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-gray-500 mt-1">
                                Accepts: 0722123456, 254722123456, or +254722123456
                              </p>
                            </FormItem>
                          )} />
                          <div className="flex items-start gap-2 text-sm text-gray-600 bg-white p-4 rounded border border-green-200">
                            <Smartphone className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-green-700">How STK Push works:</p>
                              <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                                <li>Enter your M-Pesa registered phone number</li>
                                <li>You'll receive a payment prompt on your phone</li>
                                <li>Enter your M-Pesa PIN to complete payment</li>
                                <li>Payment confirmation takes 10-60 seconds</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit Button - uses Loader2 */}
                    <Button 
                      type="submit" 
                      size="lg" 
                      disabled={isProcessing || !addressConfirmed}
                      className={`w-full text-lg font-bold py-6 ${
                        paymentMethod === "card"
                          ? "bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                          : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                      } transition-all duration-300 transform hover:scale-[1.02] ${!addressConfirmed && addressValue ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isProcessing ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {paymentStep === 'waiting' ? 'Waiting for payment...' : 'Processing...'}
                        </span>
                      ) : (
                        `${paymentMethod === "mpesa" ? "Send STK Push" : "Pay Now"} — KSh ${total.toFixed(2)}`
                      )}
                    </Button>
                  </form>
                </Form>
              </Card>
            </div>

            {/* Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="p-6 border-2 sticky top-24 shadow-xl bg-white/80 backdrop-blur-sm">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Order Summary</h2>
                <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                  {items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="flex gap-3 pb-3 border-b border-gray-100">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate text-sm">{item.name}</p>
                        {item.variantName && (
                          <p className="text-xs text-gray-500">{item.variantName}</p>
                        )}
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-bold text-gray-800 text-sm">
                        KSh {(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Subtotal</span>
                    <span className="font-semibold">KSh {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Tax (8%)</span>
                    <span className="font-semibold">KSh {tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Delivery</span>
                    <span className="font-semibold">
                      {shipping === 0
                        ? <span className="text-green-600">FREE</span>
                        : `KSh ${shipping.toFixed(2)}`}
                    </span>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between text-xl font-bold">
                    <span className="text-gray-800">Total</span>
                    <span className="text-pink-600">KSh {total.toFixed(2)}</span>
                  </div>
                </div>
                {subtotal < 5000 && (
                  <div className="mt-4 p-3 bg-pink-50 rounded-lg border border-pink-200">
                    <p className="text-xs text-pink-700 text-center font-medium">
                      🎉 Add KSh {(5000 - subtotal).toFixed(2)} more for free delivery!
                    </p>
                  </div>
                )}
                <div className="mt-6 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-700 text-center">
                    {smsConsent
                      ? "✅ You'll receive real-time SMS/WhatsApp updates"
                      : "💡 Enable SMS notifications to track in real-time"}
                  </p>
                </div>
                <div className="mt-4 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                  <p className="text-xs text-gray-600 text-center">
                    🔒 Secure checkout powered by Stripe & Safaricom M-Pesa
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* MAP PREVIEW MODAL - FIXED with validation */}
      {showMapPreview && previewLocation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-green-50 to-emerald-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                Delivery Location Preview
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCloseMapModal}
                className="hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4">
              <div className="mb-3 text-sm text-gray-600">
                <p className="font-medium">📍 Delivery Address:</p>
                <p className="text-gray-500">{addressValue}, {cityValue}, {zipValue || '00100'}</p>
              </div>
              
              {/* ✅ FIX: Validate coordinates before rendering the map */}
              {previewLocation && 
               !isNaN(previewLocation.lat) && 
               !isNaN(previewLocation.lng) &&
               isFinite(previewLocation.lat) &&
               isFinite(previewLocation.lng) &&
               previewLocation.lat >= -90 && previewLocation.lat <= 90 &&
               previewLocation.lng >= -180 && previewLocation.lng <= 180 ? (
                <OpenStreetMap
                  pickupLocation={previewLocation}
                  destination={previewLocation}
                  isLive={false}
                  height="350px"
                />
              ) : (
                <div className="flex items-center justify-center h-[350px] bg-red-50 rounded-lg border-2 border-red-200">
                  <div className="text-center text-red-600 p-4">
                    <MapPin className="w-12 h-12 mx-auto mb-3 text-red-400" />
                    <p className="font-semibold">Invalid Location Coordinates</p>
                    <p className="text-sm text-red-500 mt-1">Please go back and verify your address</p>
                  </div>
                </div>
              )}
              
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Navigation className="w-4 h-4" />
                  <span>We'll deliver to this exact location</span>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={handleCloseMapModal}
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmAddress}
                className="bg-green-600 hover:bg-green-700"
                disabled={!previewLocation || 
                  isNaN(previewLocation.lat) || 
                  isNaN(previewLocation.lng)}
              >
                <Check className="w-4 h-4 mr-2" />
                Confirm Address
              </Button>
            </div>
          </Card>
        </div>
      )}
    </PageLayout>
  );
};

export default Checkout;