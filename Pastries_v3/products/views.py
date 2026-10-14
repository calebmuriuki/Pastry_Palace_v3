# products/views.py - COMPLETE WORKING VERSION

# ============================================
# IMPORTS
# ============================================

from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.db.models import Q, Sum, Count, Avg, Max
from datetime import datetime, timedelta
import json
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.conf import settings
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.models import User

# Models
from .models import (
    Category, Product, ProductVariant,
    Cart, CartItem,
    Order, OrderItem, Payment,
    DeliveryTracking, DeliveryDriver, DeliveryAssignment, UserProfile,
)

# Serializers
from .serializers import (
    RegisterSerializer, LoginSerializer,
    CategorySerializer, ProductListSerializer, ProductDetailSerializer,
    CartSerializer, AddToCartSerializer,
    OrderSerializer, PaymentSerializer,
    DeliveryTrackingSerializer,
    UpdateProfileSerializer, UserProfileSerializer,
    PurchaseHistorySerializer, PurchaseStatsSerializer,
)

# Services
from .services import maps_service

# M-Pesa imports
import requests
import base64

# Notification imports (optional)
try:
    from .models import OrderNotificationProfile, OrderStatusLog, CategoryPrepConfig
    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    NOTIFICATIONS_AVAILABLE = False

try:
    from .notification_service import (
        create_notification_profile,
        on_payment_confirmed,
        send_notification,
    )
except ImportError:
    def create_notification_profile(order): return None
    def on_payment_confirmed(order, payment): pass
    def send_notification(order, profile, event_type): pass


# ============================================
# CSRF TOKEN ENDPOINT
# ============================================

@ensure_csrf_cookie
def get_csrf_token(request):
    """Return CSRF token for client"""
    if not request.session.session_key:
        request.session.create()
        request.session.save()

    csrf_token = get_token(request)
    return JsonResponse({
        'csrfToken': csrf_token,
        'sessionKey': request.session.session_key,
        'message': 'CSRF token generated successfully'
    })


# ============================================
# VIEWSETS
# ============================================

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.filter(is_active=True)
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.filter(is_active=True).select_related('category')
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProductDetailSerializer
        return ProductListSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def get_queryset(self):
        queryset = self.queryset
        category_slug = self.request.query_params.get('category')
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(description__icontains=search) |
                Q(tags__icontains=search)
            )
        return queryset


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Order.objects.filter(user=self.request.user)
        return Order.objects.none()


# ============================================
# USER ROLE ENDPOINT
# ============================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_role(request):
    """Get the current user's role and permissions."""
    user = request.user
    return Response({
        'is_authenticated': True,
        'is_admin': user.is_superuser or user.is_staff,
        'is_superuser': user.is_superuser,
        'is_staff': user.is_staff,
        'username': user.username,
        'email': user.email,
        'user_id': user.id,
        'first_name': user.first_name,
        'last_name': user.last_name,
    })


# ============================================
# PROFILE ENDPOINTS
# ============================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_profile(request):
    try:
        profile = request.user.profile
        serializer = UserProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=request.user)
        serializer = UserProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    try:
        profile = request.user.profile
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=request.user)
    
    serializer = UpdateProfileSerializer(
        profile, 
        data=request.data, 
        partial=request.method == 'PATCH',
        context={'request': request}
    )
    
    if serializer.is_valid():
        serializer.save()
        profile_serializer = UserProfileSerializer(profile, context={'request': request})
        return Response({
            'success': True,
            'message': 'Profile updated successfully',
            'profile': profile_serializer.data
        })
    
    return Response({
        'success': False,
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_authenticated': True,
    })


# ============================================
# AUTHENTICATION VIEWS
# ============================================

@method_decorator(ensure_csrf_cookie, name='dispatch')
class RegisterView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        if not request.session.session_key:
            request.session.create()
            request.session.save()
        
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        Cart.objects.get_or_create(user=user)
        
        return Response({
            'success': True,
            'message': 'User registered successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
            }
        }, status=status.HTTP_201_CREATED)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']
        login(request, user)
        
        return Response({
            'success': True,
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
            }
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        logout(request)
        return Response({
            'success': True,
            'message': 'Logout successful'
        })


# ============================================
# CART ENDPOINTS
# ============================================

@api_view(['GET'])
def get_cart(request):
    if request.user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=request.user)
    else:
        session_key = request.session.session_key
        if not session_key:
            request.session.create()
            session_key = request.session.session_key
        cart, _ = Cart.objects.get_or_create(session_key=session_key)
    return Response(CartSerializer(cart).data)


@api_view(['POST'])
@csrf_exempt
def add_to_cart(request):
    if not request.session.session_key:
        request.session.create()
        request.session.save()

    serializer = AddToCartSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    if request.user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=request.user)
    else:
        session_key = request.session.session_key
        cart, _ = Cart.objects.get_or_create(session_key=session_key)

    product_id = serializer.validated_data['product_id']
    variant_id = serializer.validated_data.get('variant_id')
    quantity = serializer.validated_data['quantity']

    product = get_object_or_404(Product, id=product_id, is_active=True)
    variant = None
    if variant_id:
        variant = get_object_or_404(ProductVariant, id=variant_id, is_active=True)

    cart_item, item_created = CartItem.objects.get_or_create(
        cart=cart,
        product=product,
        variant=variant,
        defaults={'quantity': quantity}
    )
    if not item_created:
        cart_item.quantity += quantity
        cart_item.save()

    return Response({
        'success': True,
        'message': 'Item added to cart',
        'cart': CartSerializer(cart).data,
    }, status=status.HTTP_200_OK)


@api_view(['PUT'])
@csrf_exempt
def update_cart_item(request, item_id):
    cart_item = get_object_or_404(CartItem, id=item_id)
    quantity = request.data.get('quantity', 1)
    if quantity < 1:
        return Response(
            {'error': 'Quantity must be at least 1'},
            status=status.HTTP_400_BAD_REQUEST
        )
    cart_item.quantity = quantity
    cart_item.save()
    return Response({
        'success': True,
        'message': 'Cart updated',
        'cart': CartSerializer(cart_item.cart).data
    })


@api_view(['DELETE'])
@csrf_exempt
def remove_cart_item(request, item_id):
    cart_item = get_object_or_404(CartItem, id=item_id)
    cart = cart_item.cart
    cart_item.delete()
    return Response({
        'success': True,
        'message': 'Item removed from cart',
        'cart': CartSerializer(cart).data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@csrf_exempt
def clear_cart(request):
    if request.user.is_authenticated:
        cart = get_object_or_404(Cart, user=request.user)
    else:
        cart = get_object_or_404(Cart, session_key=request.session.session_key)
    cart.items.all().delete()
    return Response({
        'success': True,
        'message': 'Cart cleared',
        'cart': CartSerializer(cart).data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def merge_guest_cart(request):
    try:
        session_key = request.session.session_key
        if not session_key:
            return Response({
                'success': False,
                'message': 'No session found'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        guest_cart = Cart.objects.filter(
            session_key=session_key,
            user__isnull=True
        ).first()
        
        if not guest_cart:
            return Response({
                'success': True,
                'message': 'No guest cart to merge'
            })
        
        user_cart, created = Cart.objects.get_or_create(user=request.user)
        merged_count = 0
        
        for item in guest_cart.items.all():
            user_item, item_created = CartItem.objects.get_or_create(
                cart=user_cart,
                product=item.product,
                variant=item.variant,
                defaults={'quantity': 0}
            )
            user_item.quantity += item.quantity
            user_item.save()
            merged_count += 1
        
        guest_cart.delete()
        
        return Response({
            'success': True,
            'message': f'Successfully merged {merged_count} items from guest cart',
            'merged_count': merged_count
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================
# ORDER ENDPOINTS
# ============================================

@api_view(['GET'])
def get_order(request, order_id):
    order = get_object_or_404(Order, id=order_id)
    return Response(OrderSerializer(order).data)


# ═══════════════════════════════════════════════════════════════════════════
# ORDER CREATION - COMPLETE IMPLEMENTATION
# ═══════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@csrf_exempt
def create_order(request):
    """
    Create a new order with items, payment, and tracking.
    Handles both authenticated and guest users.
    """
    try:
        data = request.data
        
        # ── Validation ──
        required_fields = ['customer_name', 'customer_email', 'customer_phone', 
                          'delivery_address', 'items', 'total_amount', 'payment_method']
        
        for field in required_fields:
            if not data.get(field):
                return Response({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        if not data.get('items') or len(data['items']) == 0:
            return Response({
                'success': False,
                'error': 'Order must contain at least one item'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # ── Get or create user ──
        user = request.user if request.user.is_authenticated else None
        
        # If guest, try to find or create user by email
        if not user:
            email = data.get('customer_email')
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                # Create a guest user
                username = email.split('@')[0]
                base_username = username
                counter = 0
                while User.objects.filter(username=username).exists():
                    counter += 1
                    username = f"{base_username}{counter}"
                
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=None,  # No password for guest users
                    first_name=data.get('customer_name', '').split(' ')[0],
                    last_name=' '.join(data.get('customer_name', '').split(' ')[1:])
                )
                user.save()
        
        # ── Create Order ──
        with transaction.atomic():
            # Generate unique order number
            order_number = f"ORD-{timezone.now().strftime('%Y%m%d')}-{Order.objects.count() + 1:04d}"
            
            # Generate tracking token
            import secrets
            tracking_token = secrets.token_urlsafe(32)
            
            order = Order.objects.create(
                user=user,
                order_number=order_number,
                customer_name=data.get('customer_name'),
                customer_email=data.get('customer_email'),
                customer_phone=data.get('customer_phone'),
                delivery_address=data.get('delivery_address'),
                delivery_date=data.get('delivery_date'),
                delivery_time=data.get('delivery_time'),
                special_instructions=data.get('special_instructions', ''),
                status='pending',
                total_amount=data.get('total_amount'),
                tracking_token=tracking_token,
            )
            
            # ── Create Order Items ──
            total_price = 0
            for item_data in data.get('items', []):
                product = None
                variant = None
                
                if item_data.get('product_id'):
                    try:
                        product = Product.objects.get(id=item_data['product_id'])
                    except Product.DoesNotExist:
                        pass
                
                if item_data.get('variant_id'):
                    try:
                        variant = ProductVariant.objects.get(id=item_data['variant_id'])
                    except ProductVariant.DoesNotExist:
                        pass
                
                unit_price = item_data.get('unit_price', 0)
                quantity = item_data.get('quantity', 1)
                subtotal = unit_price * quantity
                total_price += subtotal
                
                order_item = OrderItem.objects.create(
                    order=order,
                    product=product,
                    variant=variant,
                    product_name=item_data.get('product_name', 'Unknown Product'),
                    variant_name=item_data.get('variant_name', ''),
                    unit_price=unit_price,
                    quantity=quantity,
                    
                )
            
            # ── Create Payment Record ──
            payment_method = data.get('payment_method', 'mpesa')
            mpesa_phone = data.get('mpesa_phone')
            
            payment = Payment.objects.create(
                order=order,
                payment_method=payment_method,
                amount=data.get('total_amount'),
                status='pending',
                mpesa_phone=mpesa_phone if payment_method == 'mpesa' else None,
            )
            
            # ── Generate Tracking URL ──
            tracking_url = f"{request.build_absolute_uri('/')}track/{tracking_token}/"
            
            # ── M-Pesa Integration (if applicable) ──
            checkout_request_id = None
            merchant_request_id = None
            
            if payment_method == 'mpesa' and mpesa_phone:
                try:
                    # Try to import mpesa_service
                    try:
                        from .mpesa_service import initiate_stk_push
                        mpesa_response = initiate_stk_push(
                            phone=mpesa_phone,
                            amount=float(data.get('total_amount')),
                            account_reference=order_number,
                            transaction_desc=f"Payment for order {order_number}"
                        )
                        
                        if mpesa_response.get('success'):
                            checkout_request_id = mpesa_response.get('checkout_request_id')
                            merchant_request_id = mpesa_response.get('merchant_request_id')
                            
                            # Update payment with M-Pesa details
                            payment.mpesa_checkout_request_id = checkout_request_id
                            payment.save()
                    except ImportError:
                        print("M-Pesa service not available - continuing without STK push")
                        
                except Exception as e:
                    print(f"M-Pesa initiation failed: {e}")
                    # Continue without M-Pesa - payment will be pending
            
            # ── Create Notification Profile ──
            try:
                if NOTIFICATIONS_AVAILABLE:
                    OrderNotificationProfile.objects.create(
                        order=order,
                        email=data.get('sms_consent', False),
                        sms=data.get('notif_sms', False),
                        whatsapp=data.get('notif_whatsapp', False),
                    )
            except Exception as e:
                print(f"Notification profile creation failed: {e}")
            
            # ── Response ──
            return Response({
                'success': True,
                'order_id': order.id,
                'order_number': order.order_number,
                'message': 'Order created successfully',
                'checkout_request_id': checkout_request_id,
                'merchant_request_id': merchant_request_id,
                'tracking_token': tracking_token,
                'tracking_url': tracking_url,
            }, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            'success': False,
            'error': str(e),
            'details': traceback.format_exc(),
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================
# PAYMENT ENDPOINTS
# ============================================

@api_view(['GET'])
def get_payment_status(request, order_id):
    payment = get_object_or_404(Payment, order_id=order_id)
    return Response(PaymentSerializer(payment).data)


# ============================================
# REPORT ENDPOINTS - 95%+ SUCCESS RATE TRACKING
# ============================================

def get_report_data_helper(request):
    """Shared helper function to get report data."""
    if not (request.user.is_staff or request.user.is_superuser):
        return {
            'success': False,
            'error': 'Admin access required',
            'status_code': status.HTTP_403_FORBIDDEN
        }
    
    try:
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        status_filter = request.query_params.get('status')
        
        if not start_date:
            start_date = (timezone.now() - timedelta(days=30)).date()
        else:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        
        if not end_date:
            end_date = timezone.now().date()
        else:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        order_query = Q(created_at__date__gte=start_date, created_at__date__lte=end_date)
        if status_filter and status_filter != 'all':
            order_query &= Q(status=status_filter)
        
        orders = Order.objects.filter(order_query).select_related(
            'payment'
        ).prefetch_related(
            'items',
            'items__product'
        ).order_by('-created_at')
        
        report_data = []
        total_amount = 0
        total_orders = 0
        successful_payments = 0
        pending_payments = 0
        failed_payments = 0
        total_items_count = 0
        
        for order in orders:
            payment = getattr(order, 'payment', None)
            payment_status = payment.status if payment else 'pending'
            payment_method = payment.payment_method if payment else 'unknown'
            
            if payment_status == 'completed':
                successful_payments += 1
            elif payment_status == 'pending':
                pending_payments += 1
            elif payment_status == 'failed':
                failed_payments += 1
            
            items = []
            for item in order.items.all():
                items.append({
                    'id': item.id,
                    'product_name': item.product_name,
                    'variant_name': item.variant_name or '',
                    'unit_price': float(item.unit_price),
                    'quantity': item.quantity,
                    'subtotal': float(item.subtotal),
                })
                total_items_count += item.quantity
            
            order_total = float(order.total_amount)
            total_amount += order_total
            total_orders += 1
            
            report_data.append({
                'id': order.id,
                'order_number': order.order_number,
                'customer_name': order.customer_name,
                'customer_email': order.customer_email,
                'customer_phone': order.customer_phone,
                'delivery_address': order.delivery_address,
                'status': order.status,
                'status_display': order.get_status_display(),
                'total_amount': order_total,
                'created_at': order.created_at.isoformat(),
                'payment_method': payment_method,
                'payment_status': payment_status,
                'payment_amount': float(payment.amount) if payment else order_total,
                'mpesa_transaction_id': payment.mpesa_transaction_id if payment else '',
                'items': items,
                'items_count': len(items),
            })
        
        average_order_value = total_amount / total_orders if total_orders > 0 else 0
        success_rate = (successful_payments / total_orders * 100) if total_orders > 0 else 0
        
        return {
            'success': True,
            'data': {
                'orders': report_data,
                'summary': {
                    'total_orders': total_orders,
                    'total_amount': total_amount,
                    'total_items': total_items_count,
                    'average_order_value': average_order_value,
                    'successful_payments': successful_payments,
                    'pending_payments': pending_payments,
                    'failed_payments': failed_payments,
                    'success_rate': round(success_rate, 2),
                    'date_range': {
                        'start': start_date.isoformat(),
                        'end': end_date.isoformat(),
                    }
                }
            },
            'status_code': status.HTTP_200_OK
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e),
            'status_code': status.HTTP_500_INTERNAL_SERVER_ERROR
        }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_report_data(request):
    result = get_report_data_helper(request)
    status_code = result.pop('status_code', status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response(result, status=status_code)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_pdf_report(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({
            'success': False,
            'error': 'Admin access required'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        result = get_report_data_helper(request)
        
        if not result['success']:
            return Response({
                'success': False,
                'error': result.get('error', 'Failed to get report data')
            }, status=result.get('status_code', status.HTTP_500_INTERNAL_SERVER_ERROR))
        
        report_data = result['data']
        
        pdf_data = {
            'report_title': 'Pastry Palace - Sales Report',
            'generated_at': timezone.now().isoformat(),
            'generated_by': request.user.get_full_name() or request.user.username,
            'summary': report_data['summary'],
            'orders': [],
            'order_items': [],
            'payments': [],
        }
        
        for order in report_data['orders']:
            pdf_data['orders'].append({
                'id': order['id'],
                'order_number': order['order_number'],
                'customer_name': order['customer_name'],
                'customer_email': order['customer_email'],
                'customer_phone': order['customer_phone'],
                'status': order['status_display'],
                'total_amount': f"KShs {order['total_amount']:,.2f}",
                'created_at': datetime.fromisoformat(order['created_at']).strftime('%Y-%m-%d %H:%M'),
                'payment_method': order['payment_method'],
                'payment_status': order['payment_status'],
                'items_count': order['items_count'],
            })
            
            for item in order['items']:
                pdf_data['order_items'].append({
                    'order_number': order['order_number'],
                    'product_name': item['product_name'],
                    'variant_name': item['variant_name'],
                    'unit_price': f"KShs {item['unit_price']:,.2f}",
                    'quantity': item['quantity'],
                    'subtotal': f"KShs {item['subtotal']:,.2f}",
                })
            
            pdf_data['payments'].append({
                'order_number': order['order_number'],
                'method': order['payment_method'],
                'amount': f"KShs {order['payment_amount']:,.2f}",
                'status': order['payment_status'].capitalize(),
                'transaction_id': order.get('mpesa_transaction_id', 'N/A'),
                'created_at': datetime.fromisoformat(order['created_at']).strftime('%Y-%m-%d %H:%M'),
            })
        
        return Response({
            'success': True,
            'data': pdf_data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_pdf_report(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({
            'success': False,
            'error': 'Admin access required'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.units import inch
        
        result = get_report_data_helper(request)
        
        if not result['success']:
            return Response({
                'success': False,
                'error': result.get('error', 'Failed to get report data')
            }, status=result.get('status_code', status.HTTP_500_INTERNAL_SERVER_ERROR))
        
        report_data = result['data']
        summary = report_data['summary']
        
        response = HttpResponse(content_type='application/pdf')
        filename = f"report_{timezone.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        doc = SimpleDocTemplate(
            response,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18,
        )
        
        styles = getSampleStyleSheet()
        elements = []
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#2C3E50'),
            alignment=TA_CENTER,
            spaceAfter=30,
        )
        elements.append(Paragraph("Pastry Palace - Sales Report", title_style))
        
        date_style = ParagraphStyle(
            'DateStyle',
            parent=styles['Normal'],
            fontSize=12,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#7F8C8D'),
            spaceAfter=20,
        )
        date_range = f"Report Period: {summary['date_range']['start']} to {summary['date_range']['end']}"
        elements.append(Paragraph(date_range, date_style))
        
        summary_data = [
            ['Metric', 'Value'],
            ['Total Orders', str(summary['total_orders'])],
            ['Total Amount', f"KShs {summary['total_amount']:,.2f}"],
            ['Total Items Sold', str(summary['total_items'])],
            ['Average Order Value', f"KShs {summary['average_order_value']:,.2f}"],
            ['Successful Payments', str(summary['successful_payments'])],
            ['Pending Payments', str(summary['pending_payments'])],
            ['Failed Payments', str(summary['failed_payments'])],
            ['Success Rate', f"{summary['success_rate']}%"],
        ]
        
        summary_table = Table(summary_data, colWidths=[2.5*inch, 2.5*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498DB')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 20))
        
        doc.build(elements)
        return response
        
    except ImportError:
        return Response({
            'success': False,
            'error': 'ReportLab is not installed. Please install it with: pip install reportlab'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================
# PURCHASE HISTORY ENDPOINTS
# ============================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_purchases(request, user_id):
    if str(request.user.id) != str(user_id):
        return Response({
            'error': 'Unauthorized access - you can only view your own purchases'
        }, status=status.HTTP_403_FORBIDDEN)
    
    orders = Order.objects.filter(
        Q(user_id=user_id) | Q(customer_email=request.user.email)
    ).select_related('payment').prefetch_related('items', 'items__product').order_by('-created_at')
    
    serializer = PurchaseHistorySerializer(orders, many=True)
    
    total_spent = orders.filter(
        status__in=['confirmed', 'preparing', 'ready', 'completed']
    ).aggregate(total=Sum('total_amount'))['total'] or 0
    
    return Response({
        'purchases': serializer.data,
        'total_spent': float(total_spent),
        'total_orders': orders.count()
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_purchase_stats(request, user_id):
    if str(request.user.id) != str(user_id):
        return Response({
            'error': 'Unauthorized access'
        }, status=status.HTTP_403_FORBIDDEN)
    
    orders = Order.objects.filter(
        Q(user_id=user_id) | Q(customer_email=request.user.email)
    )
    
    stats = orders.aggregate(
        total_spent=Sum('total_amount', filter=Q(status__in=['confirmed', 'preparing', 'ready', 'completed'])),
        total_orders=Count('id'),
        average_order=Avg('total_amount', filter=Q(status__in=['confirmed', 'preparing', 'ready', 'completed'])),
        last_order=Max('created_at', filter=Q(status__in=['confirmed', 'preparing', 'ready', 'completed']))
    )
    
    return Response({
        'totalSpent': float(stats['total_spent'] or 0),
        'totalOrders': stats['total_orders'] or 0,
        'averageOrderValue': float(stats['average_order'] or 0),
        'lastOrderDate': stats['last_order']
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_purchase_by_id(request, purchase_id):
    order = get_object_or_404(
        Order.objects.select_related('payment').prefetch_related('items', 'items__product'),
        id=purchase_id
    )
    
    if request.user.id != order.user_id and request.user.email != order.customer_email:
        return Response({
            'error': 'Unauthorized access'
        }, status=status.HTTP_403_FORBIDDEN)
    
    serializer = PurchaseHistorySerializer(order)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_purchases_by_status(request, user_id, status_filter=None):
    if str(request.user.id) != str(user_id):
        return Response({
            'error': 'Unauthorized access'
        }, status=status.HTTP_403_FORBIDDEN)
    
    query = Q(user_id=user_id) | Q(customer_email=request.user.email)
    if status_filter:
        query &= Q(status=status_filter)
    
    orders = Order.objects.filter(query).select_related('payment').prefetch_related('items', 'items__product').order_by('-created_at')
    serializer = PurchaseHistorySerializer(orders, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_recent_purchases(request, user_id):
    if str(request.user.id) != str(user_id):
        return Response({
            'error': 'Unauthorized access'
        }, status=status.HTTP_403_FORBIDDEN)
    
    thirty_days_ago = timezone.now() - timedelta(days=30)
    
    orders = Order.objects.filter(
        Q(user_id=user_id) | Q(customer_email=request.user.email),
        created_at__gte=thirty_days_ago
    ).select_related('payment').prefetch_related('items', 'items__product').order_by('-created_at')
    
    serializer = PurchaseHistorySerializer(orders, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


# ============================================
# DEBUG ENDPOINTS (Remove in production)
# ============================================

@csrf_exempt
def debug_api(request):
    product = Product.objects.filter(is_active=True).first()
    if product:
        return JsonResponse({
            'product_id': product.id,
            'product_name': product.name,
            'has_image': bool(product.image),
            'image_url': product.image.url if product.image else None,
        })
    return JsonResponse({'error': 'No products found'})


@api_view(['GET'])
def debug_images(request):
    product = Product.objects.filter(is_active=True).first()
    if not product:
        return Response({'error': 'No products found'})
    return Response({
        'product_id': product.id,
        'product_name': product.name,
        'has_image': bool(product.image),
    })


# ============================================
# PLACEHOLDER ENDPOINTS (To be implemented)
# ============================================

@api_view(['GET'])
@permission_classes([AllowAny])
def track_order(request, tracking_token):
    return Response({'message': 'Tracking endpoint placeholder'})

@api_view(['POST'])
@csrf_exempt
def mpesa_callback(request):
    return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

@api_view(['GET'])
@csrf_exempt
def mpesa_query_status(request):
    return Response({'payment_status': 'pending'})

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def baker_update_status(request, order_id):
    return Response({'message': 'Status update placeholder'})

@api_view(['GET'])
@permission_classes([AllowAny])
def get_delivery_tracking(request, tracking_token):
    return Response({'message': 'Delivery tracking placeholder'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_delivery_tracking(request, order_id):
    return Response({'message': 'Create delivery tracking placeholder'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_driver_location(request):
    return Response({'message': 'Update driver location placeholder'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_driver_to_order(request, order_id):
    return Response({'message': 'Assign driver placeholder'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_delivery_status(request, order_id):
    return Response({'message': 'Update delivery status placeholder'})


# ============================================
# GEOCODING ENDPOINT - COMPLETE IMPLEMENTATION
# ============================================

@api_view(['GET'])
@permission_classes([AllowAny])
def geocode_address(request):
    """
    Geocode an address to get latitude and longitude.
    Uses OpenStreetMap Nominatim API as primary source.
    """
    address = request.GET.get('address', '')
    
    if not address:
        return Response({
            'error': 'Address parameter is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Clean the address - ensure it includes Kenya for better results
    if not any(keyword in address.lower() for keyword in ['kenya', 'ke']):
        address = f"{address}, Kenya"
    
    try:
        # Use OpenStreetMap Nominatim API (free, no API key required)
        nominatim_url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': address,
            'format': 'json',
            'limit': 1,
            'addressdetails': 1,
            'countrycodes': 'ke',  # Limit to Kenya
        }
        
        headers = {
            'User-Agent': 'PastryPalace/1.0 (https://yourdomain.com)'
        }
        
        response = requests.get(nominatim_url, params=params, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return Response({
                'error': f'Geocoding service returned status {response.status_code}'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        data = response.json()
        
        if not data or len(data) == 0:
            return Response({
                'error': 'Address not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        result = data[0]
        
        # Extract coordinates
        lat = float(result.get('lat', 0))
        lng = float(result.get('lon', 0))
        
        if lat == 0 and lng == 0:
            return Response({
                'error': 'Invalid coordinates returned'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Get formatted address
        formatted_address = result.get('display_name', address)
        place_id = result.get('place_id')
        
        return Response({
            'success': True,
            'lat': lat,
            'lng': lng,
            'formatted_address': formatted_address,
            'place_id': place_id,
            'osm_type': result.get('osm_type'),
            'osm_id': result.get('osm_id'),
            'class': result.get('class'),
            'type': result.get('type'),
            'address_details': result.get('addressdetails', {}),
        })
        
    except requests.exceptions.Timeout:
        return Response({
            'error': 'Geocoding service timeout. Please try again.'
        }, status=status.HTTP_504_GATEWAY_TIMEOUT)
        
    except requests.exceptions.ConnectionError:
        return Response({
            'error': 'Could not connect to geocoding service. Please check your internet connection.'
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            'error': f'Geocoding failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================
# ADDRESS AUTOCOMPLETE - COMPLETE IMPLEMENTATION
# ============================================

@api_view(['GET'])
@permission_classes([AllowAny])
def address_autocomplete(request):
    """
    Get address suggestions for autocomplete.
    Uses OpenStreetMap Nominatim API.
    """
    input_text = request.GET.get('input', '')
    
    if not input_text or len(input_text) < 3:
        return Response([], status=status.HTTP_200_OK)
    
    try:
        nominatim_url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': input_text,
            'format': 'json',
            'limit': 5,
            'addressdetails': 1,
            'countrycodes': 'ke',
        }
        
        headers = {
            'User-Agent': 'PastryPalace/1.0 (https://yourdomain.com)'
        }
        
        response = requests.get(nominatim_url, params=params, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return Response([], status=status.HTTP_200_OK)
        
        data = response.json()
        
        results = []
        for item in data:
            results.append({
                'description': item.get('display_name', ''),
                'place_id': item.get('place_id'),
                'lat': float(item.get('lat', 0)),
                'lng': float(item.get('lon', 0)),
                'terms': item.get('display_name', '').split(','),
                'types': [item.get('class', ''), item.get('type', '')],
            })
        
        return Response(results, status=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response([], status=status.HTTP_200_OK)