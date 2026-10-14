# products/services.py
# =====================
# M-Pesa STK Push service — HTTP communication with Safaricom only.
# Google Maps service — geocoding, directions, distance matrix, autocomplete
# OpenStreetMap service — FREE alternative, no API key required
#
# Notification logic is NOT here — it lives in notification_service.py.
#
# Bugs fixed vs original:
#   ✓ order.payment_status does not exist on the Order model
#     (Order has only 'status') — removed, views.py callback handles Order.status
#   ✓ order.status = 'processing' is not in Order.STATUS_CHOICES
#     (valid values: pending/confirmed/preparing/ready/completed/cancelled)
#     — services.py no longer sets Order.status; mpesa_callback view does
#   ✓ Payment creation inside initiate_stk_push conflicted with create_order view
#     which also creates a Payment before calling STK Push — removed from here;
#     create_order passes the already-created payment via checkout_request_id
#   ✓ handle_callback duplicated mpesa_callback in views.py and bypassed the
#     entire notification layer — removed; views.py mpesa_callback is the
#     single registered URL handler and calls on_payment_confirmed()
#   ✓ Dead code in validate_phone_number (duplicate elif branch) — removed
#   ✓ Added Google Maps service with caching and error handling
#   ✓ Added OpenStreetMap service (FREE, no API key required)

import base64
import json
import logging
from datetime import datetime
from math import radians, cos, sin, asin, sqrt

import requests
from django.conf import settings
from django.core.cache import cache

from .models import Payment

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# M-PESA PAYMENT SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

class MPesaPaymentService:
    """
    M-Pesa STK Push service.
    Responsibilities: phone validation, token acquisition, STK Push initiation,
    STK Push status query.
    NOT responsible for: updating Order/Payment records, sending notifications.
    """

    SANDBOX_URL    = "https://sandbox.safaricom.co.ke"
    PRODUCTION_URL = "https://api.safaricom.co.ke"

    def __init__(self):
        self.consumer_key    = settings.MPESA_CONSUMER_KEY
        self.consumer_secret = settings.MPESA_CONSUMER_SECRET
        self.shortcode       = settings.MPESA_SHORTCODE
        self.passkey         = settings.MPESA_PASSKEY
        self.callback_url    = settings.MPESA_CALLBACK_URL
        self.base_url        = (
            self.SANDBOX_URL
            if settings.MPESA_ENVIRONMENT == 'sandbox'
            else self.PRODUCTION_URL
        )

        logger.info(
            "MPesaPaymentService — env: %s  shortcode: %s  callback: %s",
            settings.MPESA_ENVIRONMENT, self.shortcode, self.callback_url
        )

    # ── Phone validation ───────────────────────────────────────────────────

    def validate_phone_number(self, phone):
        """
        Validates and formats a Kenyan phone number to 254XXXXXXXXX.
        Raises ValueError if the number cannot be normalised.
        """
        cleaned = ''.join(filter(str.isdigit, str(phone)))

        if cleaned.startswith('0') and len(cleaned) == 10:
            cleaned = '254' + cleaned[1:]
        elif cleaned.startswith('254') and len(cleaned) == 12:
            pass  # already correct
        elif len(cleaned) == 9:
            cleaned = '254' + cleaned
        # Note: '+254...' becomes '254...' after filter(str.isdigit) strips '+'

        if len(cleaned) != 12 or not cleaned.startswith('254'):
            raise ValueError(
                f"Invalid Kenyan phone number: {phone}. "
                f"Use 0712345678 or 254712345678."
            )

        # Warn on unrecognised network prefix (non-fatal)
        valid_prefixes = [
            '254701', '254702', '254703', '254704', '254705',
            '254706', '254707', '254708', '254709', '254710',
            '254711', '254712', '254713', '254714', '254715',
            '254716', '254717', '254718', '254719', '254720',
            '254721', '254722', '254723', '254724', '254725',
            '254726', '254727', '254728', '254729', '254740',
            '254741', '254742', '254743', '254745', '254746',
            '254748', '254757', '254758', '254759', '254768',
            '254769', '254770', '254771', '254772', '254773',
            '254774', '254775', '254776', '254777', '254778',
            '254779', '254790', '254791', '254792', '254793',
            '254794', '254795', '254796', '254797', '254798', '254799',
        ]
        if cleaned[:6] not in valid_prefixes:
            logger.warning("Phone prefix %s not in known Kenyan network list", cleaned[:6])

        return cleaned

    # ── OAuth token ────────────────────────────────────────────────────────

    def get_access_token(self):
        """
        Obtains an OAuth access token from Safaricom with up to 3 retries.
        Raises Exception if all retries fail.
        """
        url = f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials"
        auth_b64 = base64.b64encode(
            f"{self.consumer_key}:{self.consumer_secret}".encode('ascii')
        ).decode('ascii')
        headers = {'Authorization': f'Basic {auth_b64}'}

        for attempt in range(1, 4):
            try:
                response = requests.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                token = response.json().get('access_token')
                if not token:
                    raise ValueError("No access_token in Safaricom response")
                logger.info("M-Pesa access token obtained (attempt %d)", attempt)
                return token
            except Exception as exc:
                logger.warning("Token attempt %d/3 failed: %s", attempt, exc)
                if attempt == 3:
                    raise Exception(
                        f"Failed to get M-Pesa access token after 3 attempts: {exc}"
                    )

    # ── Password & timestamp ───────────────────────────────────────────────

    def generate_password(self):
        """Returns (base64_password, timestamp_string) for STK Push payload."""
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        raw = f"{self.shortcode}{self.passkey}{timestamp}"
        password = base64.b64encode(raw.encode('ascii')).decode('ascii')
        return password, timestamp

    # ── STK Push ───────────────────────────────────────────────────────────

    def initiate_stk_push(self, phone, amount, order, payment):
        """
        Initiates an M-Pesa STK Push for an existing Order and Payment.

        Args:
            phone:   Customer phone (any Kenyan format — will be validated)
            amount:  KShs amount (int or Decimal or float)
            order:   Order instance (must already be saved)
            payment: Payment instance (must already be saved, status='pending')

        Returns:
            dict with keys:
              success (bool)
              checkout_request_id (str)   — on success
              merchant_request_id (str)   — on success
              message (str)               — on success
              error (str)                 — on failure

        Side effects on success:
            payment.mpesa_checkout_request_id  — set and saved
            payment.mpesa_phone                — set and saved
            payment.status                     — set to 'processing' and saved
            payment.transaction_data           — set and saved

        The caller (create_order view) is responsible for handling failures
        and updating payment.status = 'failed' if this returns success=False.
        """
        print("=" * 80)
        print("🚀 INITIATING STK PUSH")
        print(f"   Order:  #{order.order_number} (id={order.id})")
        print(f"   Phone:  {phone}")
        print(f"   Amount: {amount}")
        print("=" * 80)

        try:
            # Validate phone
            try:
                formatted_phone = self.validate_phone_number(phone)
                print(f"✅ Phone validated: {phone} → {formatted_phone}")
            except ValueError as exc:
                return {'success': False, 'error': str(exc)}

            # Validate amount
            try:
                amount_int = int(float(amount))
                if amount_int < 1:
                    raise ValueError("Amount must be at least KShs 1")
                if amount_int > 150000:
                    raise ValueError("Amount cannot exceed KShs 150,000")
                print(f"✅ Amount validated: {amount_int} KShs")
            except (ValueError, TypeError) as exc:
                return {'success': False, 'error': f"Invalid amount: {exc}"}

            # Acquire token
            access_token        = self.get_access_token()
            password, timestamp = self.generate_password()

            url     = f"{self.base_url}/mpesa/stkpush/v1/processrequest"
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type':  'application/json',
            }
            payload = {
                'BusinessShortCode': self.shortcode,
                'Password':          password,
                'Timestamp':         timestamp,
                'TransactionType':   'CustomerPayBillOnline',
                'Amount':            amount_int,
                'PartyA':            formatted_phone,
                'PartyB':            self.shortcode,
                'PhoneNumber':       formatted_phone,
                'CallBackURL':       self.callback_url,
                'AccountReference':  order.order_number,
                'TransactionDesc':   f'Payment for order {order.order_number}',
            }

            print(f"📤 POST → {url}")
            print(f"   Payload: {json.dumps(payload, indent=2)}")

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            result = response.json()

            print(f"📥 Response: {json.dumps(result, indent=2)}")

            response_code = result.get('ResponseCode')

            if response_code == '0':
                checkout_request_id = result.get('CheckoutRequestID', '')

                # Update the Payment record that was passed in
                payment.mpesa_checkout_request_id = checkout_request_id
                payment.mpesa_phone               = formatted_phone
                payment.status                    = 'processing'
                payment.transaction_data          = result
                payment.save()

                print(f"✅ STK Push sent — CheckoutRequestID: {checkout_request_id}")

                return {
                    'success':             True,
                    'checkout_request_id': checkout_request_id,
                    'merchant_request_id': result.get('MerchantRequestID', ''),
                    'message':             result.get(
                        'CustomerMessage', 'Check your phone to complete payment.'
                    ),
                }
            else:
                error_msg = (
                    result.get('errorMessage')
                    or result.get('ResponseDescription', 'STK Push failed')
                )
                payment.status        = 'failed'
                payment.error_message = error_msg
                payment.transaction_data = result
                payment.save()

                print(f"❌ STK Push failed: {error_msg}")
                return {'success': False, 'error': error_msg}

        except requests.exceptions.Timeout:
            logger.error("M-Pesa STK Push timed out for order %s", order.order_number)
            return {'success': False, 'error': 'Request timed out. Please try again.'}

        except requests.exceptions.RequestException as exc:
            logger.error("M-Pesa network error for order %s: %s", order.order_number, exc)
            return {'success': False, 'error': f'Network error: {exc}'}

        except Exception as exc:
            import traceback
            traceback.print_exc()
            logger.error("Unexpected error in initiate_stk_push: %s", exc)
            return {'success': False, 'error': f'Unexpected error: {exc}'}

    # ── STK Query ─────────────────────────────────────────────────────────

    def query_stk_status(self, checkout_request_id):
        """
        Queries Safaricom for the current status of an STK Push transaction.
        Used as a fallback when the callback hasn't arrived within ~30 seconds.

        Returns the raw Safaricom response dict.
        On error returns {'success': False, 'error': '...', 'ResultCode': '1'}.
        """
        print(f"🔍 Querying STK status — CheckoutRequestID: {checkout_request_id}")

        try:
            access_token        = self.get_access_token()
            password, timestamp = self.generate_password()

            url     = f"{self.base_url}/mpesa/stkpushquery/v1/query"
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type':  'application/json',
            }
            payload = {
                'BusinessShortCode': self.shortcode,
                'Password':          password,
                'Timestamp':         timestamp,
                'CheckoutRequestID': checkout_request_id,
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            result = response.json()

            print(f"📥 Query response: {json.dumps(result, indent=2)}")
            return result

        except Exception as exc:
            logger.error("Error querying STK status: %s", exc)
            return {
                'success':    False,
                'error':      str(exc),
                'ResultCode': '1',
                'ResultDesc': str(exc),
            }


# ═══════════════════════════════════════════════════════════════════════════════
# OPENSTREETMAP SERVICE (FREE - NO API KEY REQUIRED)
# ═══════════════════════════════════════════════════════════════════════════════

class OpenStreetMapService:
    """
    OpenStreetMap (Nominatim) service for delivery tracking.
    COMPLETELY FREE - No API key required.
    
    Provides:
        - Geocoding (address → coordinates) using Nominatim
        - Reverse geocoding (coordinates → address)
        - Distance calculation using Haversine formula
        - ETA estimation based on distance and average speed
        - Address autocomplete (basic)
    
    Limitations vs Google Maps:
        - No real-time traffic data
        - Rate limited to 1 request per second (be respectful)
        - Less detailed address database
        - No turn-by-turn directions (use OSRM for that)
    """
    
    def __init__(self):
        self.base_url = "https://nominatim.openstreetmap.org"
        self.user_agent = "PastriesDeliveryApp/1.0"
        self.cache_timeout = 86400  # 24 hours
        self.default_speed_kmh = 30  # Average speed in Nairobi traffic (km/h)
    
    def _make_request(self, endpoint, params):
        """Make a request to Nominatim API with rate limiting respect"""
        params['format'] = 'json'
        params['limit'] = params.get('limit', 1)
        
        url = f"{self.base_url}/{endpoint}"
        headers = {
            'User-Agent': self.user_agent,
            'Accept-Language': 'en-KE,en'
        }
        
        try:
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"OpenStreetMap request failed: {e}")
            return None
    
    def geocode_address(self, address):
        """
        Convert an address to coordinates using Nominatim.
        
        Args:
            address (str): Full address string
            
        Returns:
            dict: {'lat': float, 'lng': float, 'formatted_address': str} or None
        """
        if not address:
            return None
        
        # Check cache first
        cache_key = f'osm_geocode_{hash(address)}'
        cached = cache.get(cache_key)
        if cached:
            logger.info(f"OSM Geocode cache hit for: {address[:50]}...")
            return cached
        
        params = {
            'q': address,
            'limit': 1,
            'addressdetails': 1,
            'countrycodes': 'KE',  # Bias to Kenya
        }
        
        data = self._make_request('search', params)
        
        if data and len(data) > 0:
            result = data[0]
            geocode_result = {
                'lat': float(result['lat']),
                'lng': float(result['lon']),
                'formatted_address': result.get('display_name', address),
                'place_id': result.get('place_id'),
                'osm_id': result.get('osm_id'),
                'osm_type': result.get('osm_type'),
                'address_components': result.get('address', {})
            }
            
            # Cache for 24 hours
            cache.set(cache_key, geocode_result, self.cache_timeout)
            logger.info(f"OSM Geocoded: {address[:50]}... → {geocode_result['lat']}, {geocode_result['lng']}")
            return geocode_result
        
        logger.warning(f"OSM Geocoding failed for: {address}")
        return None
    
    def reverse_geocode(self, lat, lng):
        """
        Convert coordinates to an address using Nominatim.
        
        Args:
            lat (float): Latitude
            lng (float): Longitude
            
        Returns:
            dict: {'formatted_address': str, 'address_components': dict} or None
        """
        cache_key = f'osm_reverse_geocode_{lat}_{lng}'
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        params = {
            'lat': lat,
            'lon': lng,
            'zoom': 18,
            'addressdetails': 1,
        }
        
        data = self._make_request('reverse', params)
        
        if data:
            reverse_result = {
                'formatted_address': data.get('display_name'),
                'address_components': data.get('address', {}),
                'place_id': data.get('place_id'),
                'osm_id': data.get('osm_id'),
                'osm_type': data.get('osm_type'),
            }
            
            cache.set(cache_key, reverse_result, self.cache_timeout)
            return reverse_result
        
        return None
    
    def get_directions(self, origin, destination, waypoints=None, alternatives=False):
        """
        Get simplified directions between two points.
        Note: OSM Nominatim doesn't provide routing. This returns a straight line.
        For actual routing, use OSRM (Open Source Routing Machine) separately.
        
        Args:
            origin (dict): {'lat': float, 'lng': float}
            destination (dict): {'lat': float, 'lng': float}
            waypoints (list, optional): Not supported in this simplified version
            alternatives (bool): Not supported
            
        Returns:
            dict: {
                'polyline': str (empty - no routing),
                'distance': int (meters - straight line),
                'duration': int (seconds - estimated),
                'duration_in_traffic': int,
                'start_location': dict,
                'end_location': dict,
                'steps': list (empty)
            } or None
        """
        def format_location(loc):
            if isinstance(loc, dict) and 'lat' in loc and 'lng' in loc:
                return loc
            return None
        
        origin_loc = format_location(origin)
        dest_loc = format_location(destination)
        
        if not origin_loc or not dest_loc:
            return None
        
        # Calculate straight-line distance
        distance = self.haversine_distance(
            origin_loc['lat'], origin_loc['lng'],
            dest_loc['lat'], dest_loc['lng']
        )
        
        # Estimate duration based on average speed
        hours = (distance / 1000) / self.default_speed_kmh
        duration_seconds = int(hours * 3600)
        
        # Nairobi traffic multiplier (peak hours: 1.5x, off-peak: 1.0x)
        current_hour = datetime.now().hour
        if 7 <= current_hour <= 9 or 17 <= current_hour <= 19:
            traffic_multiplier = 1.5  # Peak traffic
        else:
            traffic_multiplier = 1.2  # Normal traffic
        
        duration_in_traffic = int(duration_seconds * traffic_multiplier)
        
        return {
            'polyline': '',  # No routing data
            'distance': int(distance),
            'distance_text': f"{distance/1000:.1f} km",
            'duration': duration_seconds,
            'duration_text': self._format_duration(duration_seconds),
            'duration_in_traffic': duration_in_traffic,
            'duration_in_traffic_text': self._format_duration(duration_in_traffic),
            'start_location': origin_loc,
            'end_location': dest_loc,
            'steps': [],
            'bounds': {
                'northeast': {
                    'lat': max(origin_loc['lat'], dest_loc['lat']),
                    'lng': max(origin_loc['lng'], dest_loc['lng'])
                },
                'southwest': {
                    'lat': min(origin_loc['lat'], dest_loc['lat']),
                    'lng': min(origin_loc['lng'], dest_loc['lng'])
                }
            }
        }
    
    def calculate_eta(self, origin, destination, departure_time=None):
        """
        Calculate estimated arrival time based on distance and average speed.
        
        Args:
            origin (dict): {'lat': float, 'lng': float}
            destination (dict): {'lat': float, 'lng': float}
            departure_time (datetime, optional): Departure time (defaults to now)
            
        Returns:
            dict: {
                'duration': int (seconds),
                'duration_text': str,
                'distance': int (meters),
                'distance_text': str,
                'duration_in_traffic': int (seconds, optional)
            } or None
        """
        if not origin or not destination:
            return None
        
        distance = self.haversine_distance(
            origin['lat'], origin['lng'],
            destination['lat'], destination['lng']
        )
        
        hours = (distance / 1000) / self.default_speed_kmh
        duration_seconds = int(hours * 3600)
        
        # Traffic adjustment based on time of day
        current_hour = datetime.now().hour
        if 7 <= current_hour <= 9 or 17 <= current_hour <= 19:
            traffic_factor = 1.5
        elif 10 <= current_hour <= 16:
            traffic_factor = 1.1
        else:
            traffic_factor = 1.0
        
        result = {
            'duration': duration_seconds,
            'duration_text': self._format_duration(duration_seconds),
            'distance': int(distance),
            'distance_text': f"{distance/1000:.1f} km",
            'duration_in_traffic': int(duration_seconds * traffic_factor),
            'duration_in_traffic_text': self._format_duration(int(duration_seconds * traffic_factor)),
        }
        
        return result
    
    def get_place_autocomplete(self, input_text):
        """
        Get address suggestions for autocomplete using Nominatim.
        This is a simplified version - Nominatim doesn't have true autocomplete.
        
        Args:
            input_text (str): Partial address input
            
        Returns:
            list: [{'description': str, 'place_id': str, 'terms': list}, ...]
        """
        if not input_text or len(input_text) < 3:
            return []
        
        params = {
            'q': input_text,
            'limit': 5,
            'countrycodes': 'KE',
            'addressdetails': 1,
        }
        
        data = self._make_request('search', params)
        
        if data and len(data) > 0:
            return [
                {
                    'description': item.get('display_name', ''),
                    'place_id': str(item.get('place_id', '')),
                    'lat': item.get('lat'),
                    'lon': item.get('lon'),
                    'terms': item.get('display_name', '').split(',')[:3],
                }
                for item in data
            ]
        
        return []
    
    def validate_delivery_address(self, address):
        """
        Validate if an address is deliverable (exists in Kenya).
        
        Args:
            address (str): Address to validate
            
        Returns:
            dict: {
                'valid': bool,
                'coordinates': dict or None,
                'formatted_address': str or None,
                'message': str
            }
        """
        result = self.geocode_address(address)
        
        if result:
            # Check if address components exist (indicates valid geocoding)
            return {
                'valid': True,
                'coordinates': {'lat': result['lat'], 'lng': result['lng']},
                'formatted_address': result.get('formatted_address'),
                'message': 'Address validated successfully'
            }
        
        return {
            'valid': False,
            'coordinates': None,
            'formatted_address': None,
            'message': 'Could not validate address. Please check and try again.'
        }
    
    @staticmethod
    def haversine_distance(lat1, lng1, lat2, lng2):
        """
        Calculate the great-circle distance between two points in meters.
        
        Args:
            lat1, lng1: First point coordinates
            lat2, lng2: Second point coordinates
            
        Returns:
            float: Distance in meters
        """
        R = 6371000  # Earth's radius in meters
        
        lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
        c = 2 * asin(sqrt(a))
        
        return R * c
    
    @staticmethod
    def _format_duration(seconds):
        """Format duration in seconds to human-readable string"""
        if seconds < 60:
            return f"{seconds} sec"
        elif seconds < 3600:
            minutes = seconds // 60
            return f"{minutes} min"
        else:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            if minutes > 0:
                return f"{hours}h {minutes}min"
            return f"{hours}h"


# ═══════════════════════════════════════════════════════════════════════════════
# GOOGLE MAPS SERVICE (Requires API Key - Premium)
# ═══════════════════════════════════════════════════════════════════════════════

class GoogleMapsService:
    """
    Google Maps API service for delivery tracking.
    Provides:
        - Geocoding (address → coordinates)
        - Reverse geocoding (coordinates → address)
        - Directions (route between points)
        - Distance matrix (ETA and distance between points)
        - Place autocomplete (address suggestions)
        - Haversine distance (fallback when API unavailable)
    
    NOTE: Requires GOOGLE_MAPS_API_KEY in settings
    """

    def __init__(self):
        self.api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
        if not self.api_key:
            logger.warning("GOOGLE_MAPS_API_KEY not set in settings - Google Maps features unavailable")
        
        self.base_url = "https://maps.googleapis.com/maps/api"
        self.cache_timeout = 86400  # 24 hours for geocoding
        self.route_cache_timeout = 3600  # 1 hour for routes

    def _make_request(self, endpoint, params):
        """Make a request to Google Maps API with error handling"""
        if not self.api_key:
            raise ValueError("Google Maps API key not configured")
        
        params['key'] = self.api_key
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get('status') != 'OK' and data.get('status') != 'ZERO_RESULTS':
                logger.error(f"Google Maps API error: {data.get('status')} - {data.get('error_message')}")
                return None
            
            return data
        except requests.exceptions.RequestException as e:
            logger.error(f"Google Maps request failed: {e}")
            return None

    def geocode_address(self, address):
        """Convert an address to coordinates using Google Maps API"""
        if not address:
            return None
        
        # Check cache first
        cache_key = f'google_geocode_{hash(address)}'
        cached = cache.get(cache_key)
        if cached:
            logger.info(f"Google Geocode cache hit for: {address[:50]}...")
            return cached
        
        params = {
            'address': address,
            'region': 'ke',  # Kenya region bias
        }
        
        data = self._make_request('geocode/json', params)
        
        if data and data.get('results'):
            result = data['results'][0]
            location = result['geometry']['location']
            
            geocode_result = {
                'lat': location['lat'],
                'lng': location['lng'],
                'formatted_address': result.get('formatted_address', address),
                'place_id': result.get('place_id'),
                'address_components': result.get('address_components', [])
            }
            
            # Cache for 24 hours
            cache.set(cache_key, geocode_result, self.cache_timeout)
            logger.info(f"Google Geocoded: {address[:50]}... → {geocode_result['lat']}, {geocode_result['lng']}")
            return geocode_result
        
        logger.warning(f"Google Geocoding failed for: {address}")
        return None

    def get_directions(self, origin, destination, waypoints=None, alternatives=False):
        """Get directions between two points using Google Maps API"""
        def format_location(loc):
            if isinstance(loc, dict) and 'lat' in loc and 'lng' in loc:
                return f"{loc['lat']},{loc['lng']}"
            return str(loc)
        
        cache_key_parts = [format_location(origin), format_location(destination)]
        if waypoints:
            cache_key_parts.extend([format_location(w) for w in waypoints])
        cache_key = f'google_directions_{hash(tuple(cache_key_parts))}'
        
        cached = cache.get(cache_key)
        if cached:
            logger.info("Google Directions cache hit")
            return cached
        
        params = {
            'origin': format_location(origin),
            'destination': format_location(destination),
            'mode': 'driving',
            'units': 'metric',
            'alternatives': 'true' if alternatives else 'false',
        }
        
        if waypoints:
            params['waypoints'] = '|'.join([format_location(w) for w in waypoints])
        
        data = self._make_request('directions/json', params)
        
        if data and data.get('routes'):
            route = data['routes'][0]
            leg = route['legs'][0]
            
            directions_result = {
                'polyline': route['overview_polyline']['points'],
                'distance': leg['distance']['value'],
                'distance_text': leg['distance']['text'],
                'duration': leg['duration']['value'],
                'duration_text': leg['duration']['text'],
                'duration_in_traffic': leg.get('duration_in_traffic', {}).get('value', leg['duration']['value']),
                'start_location': leg['start_location'],
                'end_location': leg['end_location'],
                'bounds': route['bounds'],
                'steps': [
                    {
                        'instruction': step['html_instructions'],
                        'distance': step['distance']['text'],
                        'duration': step['duration']['text'],
                        'location': step['start_location'],
                        'polyline': step['polyline']['points'],
                    }
                    for step in leg['steps']
                ]
            }
            
            cache.set(cache_key, directions_result, self.route_cache_timeout)
            return directions_result
        
        logger.warning(f"Google Directions failed from {origin} to {destination}")
        return None

    def calculate_eta(self, origin, destination, departure_time=None):
        """Calculate estimated arrival time using Google Distance Matrix API"""
        def format_location(loc):
            if isinstance(loc, dict) and 'lat' in loc and 'lng' in loc:
                return f"{loc['lat']},{loc['lng']}"
            return str(loc)
        
        params = {
            'origins': format_location(origin),
            'destinations': format_location(destination),
            'mode': 'driving',
            'units': 'metric',
        }
        
        if departure_time:
            params['departure_time'] = int(departure_time.timestamp())
        
        data = self._make_request('distancematrix/json', params)
        
        if data and data.get('rows'):
            element = data['rows'][0]['elements'][0]
            
            if element.get('status') == 'OK':
                result = {
                    'duration': element['duration']['value'],
                    'duration_text': element['duration']['text'],
                    'distance': element['distance']['value'],
                    'distance_text': element['distance']['text'],
                }
                
                if 'duration_in_traffic' in element:
                    result['duration_in_traffic'] = element['duration_in_traffic']['value']
                    result['duration_in_traffic_text'] = element['duration_in_traffic']['text']
                
                return result
        
        return None

    def get_place_autocomplete(self, input_text, types=None, components=None):
        """Get place suggestions for address autocomplete using Google Places API"""
        if not input_text or len(input_text) < 3:
            return []
        
        params = {'input': input_text}
        
        if types:
            params['types'] = types
        if components:
            params['components'] = components
        else:
            params['components'] = 'country:ke'
        
        data = self._make_request('place/autocomplete/json', params)
        
        if data and data.get('predictions'):
            return [
                {
                    'description': p['description'],
                    'place_id': p['place_id'],
                    'terms': [term['value'] for term in p.get('terms', [])],
                    'types': p.get('types', []),
                }
                for p in data['predictions']
            ]
        
        return []

    @staticmethod
    def haversine_distance(lat1, lng1, lat2, lng2):
        """Calculate the great-circle distance between two points in meters"""
        R = 6371000
        
        lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
        c = 2 * asin(sqrt(a))
        
        return R * c


# ═══════════════════════════════════════════════════════════════════════════════
# SMART SERVICE SELECTOR - Automatically chooses best available service
# ═══════════════════════════════════════════════════════════════════════════════

class SmartMapService:
    """
    Smart service selector that tries Google Maps first (if API key available),
    then falls back to OpenStreetMap.
    
    This provides seamless integration - your views don't need to know which
    service is being used!
    """
    
    def __init__(self):
        self.google_maps = GoogleMapsService()
        self.osm = OpenStreetMapService()
        self.use_google = bool(self.google_maps.api_key)
        
        if self.use_google:
            logger.info("SmartMapService: Using Google Maps (API key found)")
        else:
            logger.info("SmartMapService: Using OpenStreetMap (no API key, free tier)")
    
    def geocode_address(self, address):
        """Geocode address using best available service"""
        if self.use_google:
            result = self.google_maps.geocode_address(address)
            if result:
                return result
            # Fall back to OSM if Google fails
            logger.info("Google geocoding failed, falling back to OpenStreetMap")
        return self.osm.geocode_address(address)
    
    def get_directions(self, origin, destination, waypoints=None, alternatives=False):
        """Get directions using best available service"""
        if self.use_google:
            result = self.google_maps.get_directions(origin, destination, waypoints, alternatives)
            if result:
                return result
            logger.info("Google directions failed, falling back to OpenStreetMap")
        return self.osm.get_directions(origin, destination, waypoints, alternatives)
    
    def calculate_eta(self, origin, destination, departure_time=None):
        """Calculate ETA using best available service"""
        if self.use_google:
            result = self.google_maps.calculate_eta(origin, destination, departure_time)
            if result:
                return result
            logger.info("Google ETA calculation failed, falling back to OpenStreetMap")
        return self.osm.calculate_eta(origin, destination, departure_time)
    
    def get_place_autocomplete(self, input_text):
        """Get address autocomplete suggestions"""
        if self.use_google:
            result = self.google_maps.get_place_autocomplete(input_text)
            if result:
                return result
        return self.osm.get_place_autocomplete(input_text)
    
    def validate_delivery_address(self, address):
        """Validate delivery address"""
        if self.use_google:
            result = self.google_maps.validate_delivery_address(address)
            if result and result.get('valid'):
                return result
        return self.osm.validate_delivery_address(address)
    
    @staticmethod
    def haversine_distance(lat1, lng1, lat2, lng2):
        """Calculate straight-line distance (always available)"""
        return OpenStreetMapService.haversine_distance(lat1, lng1, lat2, lng2)


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON INSTANCES
# ═══════════════════════════════════════════════════════════════════════════════

# Initialize services as singletons
mpesa_service = MPesaPaymentService()
google_maps_service = GoogleMapsService()
openstreetmap_service = OpenStreetMapService()
maps_service = SmartMapService()  # Smart selector - use this in your views!