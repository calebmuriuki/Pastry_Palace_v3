# products/serializers.py
# =======================
# All original serializers preserved exactly.
# Three additions to support the notification layer:
#
#   CartItemSerializer    — adds image_url + product_slug
#                           (checkout page needs product image)
#
#   OrderSerializer       — adds tracking_token + notification_profile
#                           (frontend uses these for the tracking page)
#
#   OrderTrackingSerializer — new lightweight serializer for
#                             the public /track/<token>/ page

from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.validators import EmailValidator
from django.db.models import Q
from .models import Product, ProductVariant, Category, Cart, CartItem, Order, OrderItem, Payment, DeliveryTracking, DeliveryDriver, DeliveryAssignment, UserProfile
from django.conf import settings

User = get_user_model()
try:
    from .models import OrderNotificationProfile
    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    NOTIFICATIONS_AVAILABLE = False
    
    
# ═══════════════════════════════════════════════════════════════════════════════
# REGISTER && LOGIN SERIALIZERS
# ═══════════════════════════════════════════════════════════════════════════════

class RegisterSerializer(serializers.ModelSerializer):
    """User registration serializer with password validation"""
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    confirm_password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'password',
            'confirm_password',
            'first_name',
            'last_name',
        ]
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
            'email': {'required': True},
        }
    
    def validate(self, attrs):
        """Validate registration data"""
        # Check password match
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                "password": "Password fields didn't match.",
                "confirm_password": "Password fields didn't match."
            })
        
        # Validate email format
        try:
            EmailValidator()(attrs['email'])
        except Exception:
            raise serializers.ValidationError({
                "email": "Enter a valid email address."
            })
        
        # Check if username exists
        if User.objects.filter(username__iexact=attrs['username']).exists():
            raise serializers.ValidationError({
                "username": "A user with this username already exists."
            })
        
        # Check if email exists
        if User.objects.filter(email__iexact=attrs['email']).exists():
            raise serializers.ValidationError({
                "email": "A user with this email already exists."
            })
        
        return attrs
    
    def create(self, validated_data):
        """Create user with profile"""
        # Remove confirm_password (not needed for user creation)
        validated_data.pop('confirm_password')
        
        # Create user
        user = User.objects.create_user(**validated_data)
        
        # Profile is auto-created by signal in models.py
        return user


class LoginSerializer(serializers.Serializer):
    """User login serializer - supports username or email"""
    username = serializers.CharField(required=True)
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    
    def validate(self, attrs):
        """Validate login credentials"""
        username = attrs.get('username')
        password = attrs.get('password')
        
        if not username or not password:
            raise serializers.ValidationError({
                "username": "Username/email and password are required."
            })
        
        # Authenticate using custom backend
        user = authenticate(
            request=self.context.get('request'),
            username=username,
            password=password
        )
        
        if not user:
            # Check if user exists but is locked
            try:
                user_obj = User.objects.get(
                    Q(username__iexact=username) | Q(email__iexact=username)
                )
                
                # Check if account is locked
                if hasattr(user_obj, 'profile') and user_obj.profile.is_locked:
                    raise serializers.ValidationError(
                        "Account is locked. Please try again after 30 minutes."
                    )
            except User.DoesNotExist:
                pass
            
            raise serializers.ValidationError({
                "username": "Invalid username/email or password."
            })
        
        # Check if user is active
        if not user.is_active:
            raise serializers.ValidationError(
                "This account has been disabled."
            )
        
        attrs['user'] = user
        return attrs

     
# PROFILE SERIALIZERS
# ═══════════════════════════════════════════════════════════════════════════════

class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for UserProfile model"""
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = UserProfile  # Make sure UserProfile is imported
        fields = [
            'username',
            'email',
            'full_name',
            'phone_number',
            'delivery_address',
            'email_verified',
            'loyalty_points',
            'birthday',
            'preferred_contact_method',
            'favorite_pastry_notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'email_verified', 
            'loyalty_points', 
            'created_at', 
            'updated_at'
        ]
    
    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username


class UpdateProfileSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile"""
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name = serializers.CharField(source='user.last_name', required=False, allow_blank=True)
    email = serializers.EmailField(source='user.email', required=False)
    
    class Meta:
        model = UserProfile
        fields = [
            'phone_number',
            'delivery_address',
            'preferred_contact_method',
            'birthday',
            'favorite_pastry_notes',
            'first_name',
            'last_name',
            'email',
        ]
    
    def validate_email(self, value):
        """Validate email is unique"""
        user = self.context['request'].user
        if User.objects.filter(email__iexact=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value
    
    def update(self, instance, validated_data):
        # Update user fields
        user_data = validated_data.pop('user', {})
        user = instance.user
        
        if 'first_name' in user_data:
            user.first_name = user_data['first_name']
        if 'last_name' in user_data:
            user.last_name = user_data['last_name']
        if 'email' in user_data:
            user.email = user_data['email']
        user.save()
        
        # Update profile fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        return instance


# ═══════════════════════════════════════════════════════════════════════════════
# CATEGORY  — original, untouched
# ═══════════════════════════════════════════════════════════════════════════════

class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    image_url     = serializers.SerializerMethodField()

    class Meta:
        model  = Category
        fields = ['id', 'name', 'slug', 'description', 'image_url',
                  'is_active', 'display_order', 'product_count', 'created_at']

    def get_product_count(self, obj):
        return obj.products.filter(is_active=True).count()

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        try:
            if hasattr(obj, 'image_card') and obj.image_card:
                url = obj.image_card.url
                return request.build_absolute_uri(url) if request else url
        except Exception as e:
            print(f"⚠️ Category card image error for '{obj.name}': {e}")
        try:
            if obj.image:
                return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        except Exception as e:
            print(f"⚠️ Category original image error for '{obj.name}': {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCT VARIANT  — original, untouched
# ═══════════════════════════════════════════════════════════════════════════════

class ProductVariantSerializer(serializers.ModelSerializer):
    in_stock        = serializers.ReadOnlyField()
    formatted_price = serializers.SerializerMethodField()

    class Meta:
        model  = ProductVariant
        fields = ['id', 'product', 'name', 'size_value', 'size_unit',
                  'serves', 'price', 'formatted_price', 'is_active', 'is_default',
                  'stock_quantity', 'display_order', 'in_stock']

    def get_formatted_price(self, obj):
        return f"KShs {obj.price:,.2f}"


# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCT LIST  — original, untouched
# ═══════════════════════════════════════════════════════════════════════════════

class ProductListSerializer(serializers.ModelSerializer):
    display_price = serializers.ReadOnlyField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    image_url     = serializers.SerializerMethodField()
    variant_count = serializers.SerializerMethodField()

    class Meta:
        model  = Product
        fields = [
            'id', 'category', 'category_slug', 'category_name', 'name', 'slug',
            'image_url', 'base_price', 'display_price',
            'is_active', 'is_featured', 'has_variants', 'variant_count',
        ]

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        try:
            if hasattr(obj, 'image_thumbnail') and obj.image_thumbnail:
                url = obj.image_thumbnail.url
                return request.build_absolute_uri(url) if request else url
        except Exception as e:
            print(f"⚠️ Thumbnail error for '{obj.name}': {e}")
        try:
            if obj.image:
                return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        except Exception as e:
            print(f"⚠️ Original image error for '{obj.name}': {e}")
        return None

    def get_variant_count(self, obj):
        if obj.has_variants:
            return obj.variants.filter(is_active=True).count()
        return 0


# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCT DETAIL  — original, untouched
# ═══════════════════════════════════════════════════════════════════════════════

class ProductDetailSerializer(serializers.ModelSerializer):
    display_price        = serializers.ReadOnlyField()
    category_name        = serializers.CharField(source='category.name', read_only=True)
    category_slug        = serializers.CharField(source='category.slug', read_only=True)
    variants             = ProductVariantSerializer(many=True, read_only=True)
    image_url            = serializers.SerializerMethodField()
    image_thumbnail_url  = serializers.SerializerMethodField()
    image_medium_url     = serializers.SerializerMethodField()
    image_large_url      = serializers.SerializerMethodField()
    formatted_price      = serializers.SerializerMethodField()

    class Meta:
        model  = Product
        fields = [
            'id', 'category', 'category_slug', 'category_name', 'name', 'slug',
            'description', 'image_url', 'image_thumbnail_url', 'image_medium_url', 'image_large_url',
            'base_price', 'display_price', 'formatted_price',
            'is_active', 'is_featured', 'has_variants', 'sku', 'tags',
            'variants', 'created_at', 'updated_at',
        ]

    def _get_image_url(self, obj, field_name):
        try:
            if hasattr(obj, field_name):
                image_field = getattr(obj, field_name)
                if image_field:
                    url     = image_field.url
                    request = self.context.get('request')
                    return request.build_absolute_uri(url) if request else url
        except Exception as e:
            print(f"⚠️ Error getting {field_name} for '{obj.name}': {e}")
        return None

    def get_image_url(self, obj):
        medium = self._get_image_url(obj, 'image_medium')
        if medium:
            return medium
        if obj.image:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None

    def get_image_thumbnail_url(self, obj): return self._get_image_url(obj, 'image_thumbnail')
    def get_image_medium_url(self, obj):    return self._get_image_url(obj, 'image_medium')
    def get_image_large_url(self, obj):     return self._get_image_url(obj, 'image_large')

    def get_formatted_price(self, obj):
        if obj.display_price:
            return f"KShs {obj.display_price:,.2f}"
        return "KShs 0.00"


# ═══════════════════════════════════════════════════════════════════════════════
# CART  — image_url + product_slug added to CartItemSerializer
# ═══════════════════════════════════════════════════════════════════════════════

class CartItemSerializer(serializers.ModelSerializer):
    product_name  = serializers.CharField(source='product.name', read_only=True)
    product_slug  = serializers.CharField(source='product.slug', read_only=True)
    product_price = serializers.SerializerMethodField()
    variant_name  = serializers.CharField(source='variant.name', read_only=True, allow_null=True)
    total_price   = serializers.SerializerMethodField()
    image_url     = serializers.SerializerMethodField()

    class Meta:
        model  = CartItem
        fields = ['id', 'product', 'product_name', 'product_slug',
                  'variant', 'variant_name',
                  'quantity', 'product_price', 'total_price',
                  'image_url']

    def get_product_price(self, obj):
        return obj.variant.price if obj.variant else obj.product.base_price

    def get_total_price(self, obj):
        price = obj.variant.price if obj.variant else obj.product.base_price
        return price * obj.quantity

    def get_image_url(self, obj):
        """Thumbnail for checkout page — uses image_thumbnail if available"""
        if not obj.product or not obj.product.image:
            return None
        request = self.context.get('request')
        try:
            if hasattr(obj.product, 'image_thumbnail') and obj.product.image_thumbnail:
                url = obj.product.image_thumbnail.url
                return request.build_absolute_uri(url) if request else url
        except Exception:
            pass
        try:
            url = obj.product.image.url
            return request.build_absolute_uri(url) if request else url
        except Exception:
            return None


class CartSerializer(serializers.ModelSerializer):
    items        = CartItemSerializer(many=True, read_only=True)
    total_items  = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model  = Cart
        fields = ['id', 'session_key', 'user', 'items',
                  'total_items', 'total_amount', 'created_at']

    def get_total_items(self, obj):  return obj.total_items
    def get_total_amount(self, obj): return obj.total_price


class AddToCartSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    variant_id = serializers.IntegerField(required=False, allow_null=True)
    quantity   = serializers.IntegerField(min_value=1, default=1)


# ═══════════════════════════════════════════════════════════════════════════════
# ORDER  — tracking_token + notification fields added
# ═══════════════════════════════════════════════════════════════════════════════

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(read_only=True)
    variant_name = serializers.CharField(read_only=True, allow_null=True)
    subtotal     = serializers.SerializerMethodField()

    class Meta:
        model  = OrderItem
        fields = ['id', 'product', 'product_name', 'variant', 'variant_name',
                  'quantity', 'unit_price', 'subtotal']

    def get_subtotal(self, obj):
        return obj.unit_price * obj.quantity


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    tracking_token      = serializers.SerializerMethodField()
    tracking_url        = serializers.SerializerMethodField()
    estimated_ready_at  = serializers.SerializerMethodField()
    payment_confirmed_at= serializers.SerializerMethodField()
    bake_started_at     = serializers.SerializerMethodField()
    ready_at            = serializers.SerializerMethodField()

    class Meta:
        model  = Order
        fields = [
            'id', 'order_number', 'user', 'customer_name', 'customer_email',
            'customer_phone', 'delivery_address', 'delivery_date', 'delivery_time',
            'special_instructions', 'status', 'total_amount',
            'items', 'created_at', 'updated_at',
            'tracking_token', 'tracking_url',
            'estimated_ready_at', 'payment_confirmed_at',
            'bake_started_at', 'ready_at',
        ]

    def _get_profile(self, obj):
        if not NOTIFICATIONS_AVAILABLE:
            return None
        try:
            return obj.notification_profile
        except Exception:
            return None

    def get_tracking_token(self, obj):
        profile = self._get_profile(obj)
        return str(profile.tracking_token) if profile else None

    def get_tracking_url(self, obj):
        profile = self._get_profile(obj)
        if not profile:
            return None
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        return f"{frontend_url}/track/{profile.tracking_token}"

    def get_estimated_ready_at(self, obj):
        profile = self._get_profile(obj)
        return profile.estimated_ready_at if profile else None

    def get_payment_confirmed_at(self, obj):
        profile = self._get_profile(obj)
        return profile.payment_confirmed_at if profile else None

    def get_bake_started_at(self, obj):
        profile = self._get_profile(obj)
        return profile.bake_started_at if profile else None

    def get_ready_at(self, obj):
        profile = self._get_profile(obj)
        return profile.ready_at if profile else None


# ═══════════════════════════════════════════════════════════════════════════════
# PAYMENT  — original, untouched
# ═══════════════════════════════════════════════════════════════════════════════

class PaymentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model  = Payment
        fields = [
            'id', 'order', 'order_number', 'payment_method', 'amount', 'status',
            'stripe_payment_intent_id', 'stripe_charge_id',
            'mpesa_checkout_request_id', 'mpesa_transaction_id', 'mpesa_phone',
            'transaction_data', 'error_message',
            'created_at', 'updated_at',
        ]


# ═══════════════════════════════════════════════════════════════════════════════
# DELIVERY TRACKING SERIALIZERS
# ═══════════════════════════════════════════════════════════════════════════════

class DeliveryTrackingSerializer(serializers.ModelSerializer):
    """Serializer for delivery tracking data"""
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    order_status = serializers.CharField(source='order.status', read_only=True)
    # ✅ FIXED: Added progress_percentage and is_running_late
    progress_percentage = serializers.ReadOnlyField()
    is_running_late = serializers.ReadOnlyField()

    class Meta:
        model = DeliveryTracking
        fields = [
            'order_number',
            'order_status',
            'pickup_latitude',
            'pickup_longitude',
            'destination_latitude',
            'destination_longitude',
            'current_latitude',
            'current_longitude',
            'route_polyline',
            'total_distance',
            'total_duration',
            'distance_remaining',
            'duration_remaining',
            'driver_name',
            'driver_phone',
            'driver_photo',
            'vehicle_number',
            'is_live_tracking',
            'last_location_update',
            'estimated_arrival',
            'current_activity',
            'progress_percentage',
            'is_running_late',
        ]


class DeliveryDriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryDriver
        fields = '__all__'


class DeliveryAssignmentSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    driver_phone = serializers.CharField(source='driver.phone', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    
    class Meta:
        model = DeliveryAssignment
        fields = '__all__'

# products/serializers.py - Complete Purchase History Serializers

# ============================================
# PURCHASE HISTORY SERIALIZERS
# ============================================

class PurchaseHistoryItemSerializer(serializers.ModelSerializer):
    """Serializer for order items in purchase history"""
    total = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 
            'product_name', 
            'variant_name', 
            'quantity', 
            'unit_price',
            'price',
            'total', 
            'image_url'
        ]
    
    def get_price(self, obj):
        """Get the unit price"""
        return float(obj.unit_price)
    
    def get_total(self, obj):
        """Calculate total price for this item"""
        return float(obj.unit_price * obj.quantity)
    
    def get_image_url(self, obj):
        """Get product image URL if available"""
        try:
            if obj.product and obj.product.image:
                return obj.product.image.url
        except Exception:
            pass
        return None


class PurchaseHistorySerializer(serializers.ModelSerializer):
    """Serializer for purchase history orders"""
    items = PurchaseHistoryItemSerializer(many=True, read_only=True)
    payment_status = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 
            'order_number', 
            'total_amount', 
            'status',
            'payment_method', 
            'payment_status', 
            'delivery_address',
            'created_at', 
            'updated_at', 
            'items'
        ]
    
    def get_payment_status(self, obj):
        """Get payment status from related payment"""
        try:
            if hasattr(obj, 'payment') and obj.payment:
                return obj.payment.status
        except Exception:
            pass
        return 'pending'
    
    def get_payment_method(self, obj):
        """Get payment method from related payment"""
        try:
            if hasattr(obj, 'payment') and obj.payment:
                return obj.payment.payment_method
        except Exception:
            pass
        return 'unknown'


class PurchaseStatsSerializer(serializers.Serializer):
    """Serializer for purchase statistics"""
    totalSpent = serializers.DecimalField(max_digits=10, decimal_places=2)
    totalOrders = serializers.IntegerField()
    averageOrderValue = serializers.DecimalField(max_digits=10, decimal_places=2)
    lastOrderDate = serializers.DateTimeField(allow_null=True)