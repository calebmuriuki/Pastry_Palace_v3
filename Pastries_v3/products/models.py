from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.utils.text import slugify
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid

# ── ImageKit ────────────────────────────────────────────────────────────────
# FIX: The previous dummy ImageSpecField had no contribute_to_class() method.
# Django's model metaclass calls contribute_to_class() on every class-level
# descriptor at import time.  A bare dummy with only __init__ raises
# AttributeError on startup when imagekit is not installed.
#
# Solution: make the dummy a proper non-op descriptor so Django's metaclass
# is satisfied regardless of whether imagekit is installed.
try:
    from imagekit.models import ImageSpecField
    from imagekit.processors import ResizeToFit
    IMAGEKIT_AVAILABLE = True
except ImportError:
    IMAGEKIT_AVAILABLE = False

    class ImageSpecField:  # type: ignore[no-redef]
        """
        Safe no-op descriptor used when django-imagekit is not installed.
        Django's model metaclass calls contribute_to_class() on every
        descriptor found in a class body — this stub satisfies that contract
        so the app starts cleanl  y without imagekit.
        """
        def __init__(self, *args, **kwargs):
            self._source = kwargs.get('source', '')

        # Called by Django's ModelBase metaclass
        def contribute_to_class(self, cls, name):
            self.name = name
            setattr(cls, name, self)

        # Descriptor protocol — always returns None when imagekit absent
        def __get__(self, obj, objtype=None):
            return None

        def __set__(self, obj, value):
            pass

    class ResizeToFit:  # type: ignore[no-rhedef]
        def __init__(self, *args, **kwargs):
            pass


# ═══════════════════════════════════════════════════════════════════════════════
# CATALOGUE MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class Category(models.Model):
    """Product categories like Cakes, Cupcakes, Donuts"""
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, max_length=150)
    image = models.ImageField(
        upload_to='categories/%Y/%m/%d/',
        help_text='Recommended size: 800x600px',
        blank=True,
        null=True,
    )
    description  = models.TextField(blank=True)
    display_order = models.IntegerField(default=0)
    is_active    = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['display_order', 'name']
        indexes = [
            models.Index(fields=['slug', 'is_active']),
            models.Index(fields=['display_order']),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def menu_count(self):
        return self.products.filter(is_active=True).count()


class Product(models.Model):
    """Individual products like Strawberry Tart, Vanilla Cupcakes"""
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='products',
        db_index=True,
    )
    name        = models.CharField(max_length=200)
    slug        = models.SlugField(unique=True, max_length=250)
    description = models.TextField(blank=True)
    image       = models.ImageField(
        upload_to='products/%Y/%m/%d/',
        help_text='Recommended size: 800x600px',
    )
    base_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )

    # ── ImageKit optimised variants ─────────────────────────────────────────
    # Defined unconditionally so Django's metaclass always finds them.
    # When imagekit is NOT installed the dummy descriptor above silently
    # returns None — serializers guard against this with hasattr() checks.
    image_thumbnail = ImageSpecField(
        source='image',
        processors=[ResizeToFit(300, 200)],
        format='JPEG',
        options={'quality': 85},
    )
    image_medium = ImageSpecField(
        source='image',
        processors=[ResizeToFit(600, 400)],
        format='JPEG',
        options={'quality': 85},
    )
    image_large = ImageSpecField(
        source='image',
        processors=[ResizeToFit(900, 600)],
        format='JPEG',
        options={'quality': 90},
    )

    is_active   = models.BooleanField(default=True,  db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    has_variants = models.BooleanField(default=False)

    sku  = models.CharField(max_length=100, unique=True, null=True, blank=True, db_index=True)
    tags = models.CharField(max_length=500, blank=True, help_text="Comma-separated tags")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_featured', '-created_at']
        indexes = [
            models.Index(fields=['slug', 'is_active']),
            models.Index(fields=['category', 'is_active']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku or 'No SKU'})"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def display_price(self):
        if self.has_variants and self.variants.exists():
            variant = self.variants.filter(is_active=True).order_by('price').first()
            return variant.price if variant else self.base_price
        return self.base_price

    @property
    def in_stock(self):
        if self.has_variants:
            return self.variants.filter(is_active=True, stock_quantity__gt=0).exists()
        return True


class ProductVariant(models.Model):
    """Size/type variants for products"""
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='variants',
        db_index=True,
    )
    name       = models.CharField(max_length=100, help_text="e.g., 1kg (serves 10)")
    size_value = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0)])
    size_unit  = models.CharField(max_length=20, default='kg')
    serves     = models.IntegerField(validators=[MinValueValidator(1)])
    price      = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])

    is_active      = models.BooleanField(default=True, db_index=True)
    is_default     = models.BooleanField(default=False)
    stock_quantity = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    display_order  = models.IntegerField(default=0)

    class Meta:
        ordering = ['display_order', 'size_value']
        unique_together = ['product', 'name']
        indexes = [
            models.Index(fields=['product', 'is_active']),
            models.Index(fields=['is_active', 'stock_quantity']),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.name} (KSh {self.price:,.2f})"

    @property
    def in_stock(self):
        return self.stock_quantity > 0

    def save(self, *args, **kwargs):
        if self.is_default:
            ProductVariant.objects.filter(
                product=self.product, is_default=True
            ).exclude(id=self.id).update(is_default=False)
        super().save(*args, **kwargs)


class ProductPrice(models.Model):
    """Product price history"""
    product  = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='price_history', db_index=True)
    variant  = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name='price_history', db_index=True)
    price    = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"Price {self.price} for {self.variant.name if self.variant else self.product.name}"


# ═══════════════════════════════════════════════════════════════════════════════
# CART MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class Cart(models.Model):
    user        = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, db_index=True)
    session_key = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    created_at  = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'session_key']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        identifier = self.user.username if self.user else f"Session: {self.session_key[:10] if self.session_key else 'None'}..."
        return f"Cart #{self.id} - {identifier}"

    @property
    def total_price(self):
        return sum(item.subtotal for item in self.items.all())

    @property
    def total_items(self):
        return sum(item.quantity for item in self.items.all())


class CartItem(models.Model):
    cart     = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items', db_index=True)
    product  = models.ForeignKey(Product, on_delete=models.CASCADE, db_index=True)
    variant  = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, null=True, blank=True, db_index=True)
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    added_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ['cart', 'product', 'variant']
        ordering = ['-added_at']
        indexes = [models.Index(fields=['cart', 'added_at'])]

    def __str__(self):
        variant_info = f" - {self.variant.name}" if self.variant else ""
        return f"{self.product.name}{variant_info} x{self.quantity}"

    @property
    def unit_price(self):
        return self.variant.price if self.variant else self.product.base_price

    @property
    def subtotal(self):
        return self.unit_price * self.quantity


# ═══════════════════════════════════════════════════════════════════════════════
# ORDER MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class Order(models.Model):
    STATUS_CHOICES = [
        ('pending',   'Pending'),
        ('confirmed', 'Confirmed'),
        ('preparing', 'Preparing'),
        ('ready',     'Ready for Pickup/Delivery'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    user         = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, db_index=True)
    order_number = models.CharField(max_length=50, unique=True, db_index=True)

    customer_name  = models.CharField(max_length=200)
    customer_email = models.EmailField(db_index=True)
    customer_phone = models.CharField(max_length=20, db_index=True)

    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])

    delivery_address     = models.TextField(blank=True)
    delivery_date        = models.DateField(null=True, blank=True)
    delivery_time        = models.TimeField(null=True, blank=True)
    special_instructions = models.TextField(blank=True)
    
    tracking_token = models.CharField(
        max_length=255, 
        unique=True, 
        null=True, 
        blank=True,
        db_index=True,
        help_text="Unique token for tracking the order"
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_number', 'status']),
            models.Index(fields=['customer_email', 'created_at']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"Order #{self.order_number} - {self.customer_name} (KSh {self.total_amount:,.2f})"

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = f"ORD-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)


class OrderItem(models.Model):
    order   = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items', db_index=True)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, db_index=True)
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True, db_index=True)

    product_name = models.CharField(max_length=200)
    variant_name = models.CharField(max_length=100, blank=True)
    unit_price   = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    quantity     = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        ordering = ['-id']
        indexes = [models.Index(fields=['order', 'product'])]

    def __str__(self):
        variant_info = f" - {self.variant_name}" if self.variant_name else ""
        return f"{self.product_name}{variant_info} x{self.quantity}"

    @property
    def subtotal(self):
        return self.unit_price * self.quantity


class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('stripe', 'Stripe'),
        ('mpesa',  'M-Pesa'),
        ('cash',   'Cash on Delivery'),
    ]
    PAYMENT_STATUS_CHOICES = [
        ('pending',    'Pending'),
        ('processing', 'Processing'),
        ('completed',  'Completed'),
        ('failed',     'Failed'),
        ('refunded',   'Refunded'),
    ]

    order          = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment', db_index=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, db_index=True)
    status         = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending', db_index=True)
    amount         = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])

    stripe_payment_intent_id = models.CharField(max_length=100, blank=True, db_index=True)
    stripe_charge_id         = models.CharField(max_length=100, blank=True, db_index=True)

    mpesa_checkout_request_id = models.CharField(max_length=100, blank=True, db_index=True)
    mpesa_transaction_id      = models.CharField(max_length=100, blank=True, db_index=True)
    mpesa_phone               = models.CharField(max_length=20,  blank=True, db_index=True)

    transaction_data = models.JSONField(default=dict, blank=True)
    error_message    = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order', 'status']),
            models.Index(fields=['payment_method', 'created_at']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"Payment #{self.id} for Order {self.order.order_number} - {self.get_status_display()}"


# ═══════════════════════════════════════════════════════════════════════════════
# DELIVERY TRACKING MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class DeliveryTracking(models.Model):
    """Real-time delivery tracking for orders"""
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='delivery_tracking')

    # Coordinates
    pickup_latitude       = models.DecimalField(max_digits=10, decimal_places=7)
    pickup_longitude      = models.DecimalField(max_digits=10, decimal_places=7)
    destination_latitude  = models.DecimalField(max_digits=10, decimal_places=7)
    destination_longitude = models.DecimalField(max_digits=10, decimal_places=7)

    # Current driver location — null until driver starts moving
    current_latitude  = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    current_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    # Route
    route_polyline    = models.TextField(blank=True)
    total_distance    = models.FloatField(default=0, help_text="meters")
    total_duration    = models.IntegerField(default=0, help_text="seconds")
    distance_remaining = models.FloatField(default=0, help_text="meters")
    duration_remaining = models.IntegerField(default=0, help_text="seconds")

    # Driver snapshot (denormalised for fast reads)
    driver_name    = models.CharField(max_length=100, blank=True, null=True)
    driver_phone   = models.CharField(max_length=20,  blank=True, null=True)
    driver_photo   = models.URLField(blank=True, null=True)
    vehicle_number = models.CharField(max_length=20, blank=True, null=True)

    # State
    is_live_tracking     = models.BooleanField(default=False)
    last_location_update = models.DateTimeField(null=True, blank=True)
    estimated_arrival    = models.DateTimeField(null=True, blank=True)
    current_activity     = models.CharField(max_length=50, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['order', 'is_live_tracking']),
            models.Index(fields=['last_location_update']),
        ]

    def __str__(self):
        return f"Tracking for Order {self.order.order_number}"

    @property
    def progress_percentage(self):
        if self.total_distance > 0:
            return ((self.total_distance - self.distance_remaining) / self.total_distance) * 100
        return 0

    @property
    def is_running_late(self):
        from django.utils import timezone as tz
        if self.estimated_arrival and self.is_live_tracking:
            return tz.now() > self.estimated_arrival
        return False


class DeliveryDriver(models.Model):
    """Driver information and availability"""
    name           = models.CharField(max_length=100)
    phone          = models.CharField(max_length=20, unique=True)
    email          = models.EmailField(blank=True)
    photo          = models.URLField(blank=True, null=True)
    vehicle_number = models.CharField(max_length=20)
    vehicle_type   = models.CharField(max_length=50, default='Motorcycle')

    is_active    = models.BooleanField(default=True)
    is_available = models.BooleanField(default=True)
    current_latitude  = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    current_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    total_deliveries = models.IntegerField(default=0)
    rating           = models.DecimalField(max_digits=3, decimal_places=2, default=5.0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [models.Index(fields=['is_active', 'is_available'])]

    def __str__(self):
        return f"{self.name} - {self.vehicle_number}"


class DeliveryAssignment(models.Model):
    """Tracks which driver is assigned to which order"""
    order  = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='delivery_assignment')
    driver = models.ForeignKey(DeliveryDriver, on_delete=models.SET_NULL, null=True, related_name='assignments')

    assigned_at  = models.DateTimeField(auto_now_add=True)
    started_at   = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=[
            ('assigned',   'Assigned'),
            ('picked_up',  'Picked Up'),
            ('in_transit', 'In Transit'),
            ('delivered',  'Delivered'),
            ('cancelled',  'Cancelled'),
        ],
        default='assigned',
    )

    class Meta:
        indexes = [models.Index(fields=['status', 'assigned_at'])]

    def __str__(self):
        driver_name = self.driver.name if self.driver else 'Unassigned'
        return f"Order {self.order.order_number} - Driver: {driver_name}"
    
    # -----models.py - Add this at the bottom------
    
    
# products/models.py - Add this to the UserProfile class

class UserProfile(models.Model):
    """Extended profile for users - linked to Django's User"""
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='profile'
    )
    
    # Additional fields for Pastry Palace
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    delivery_address = models.TextField(blank=True)
    
    # For email verification
    email_verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(max_length=100, blank=True)
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)
    
    # For password reset
    reset_password_token = models.CharField(max_length=100, blank=True)
    reset_password_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Security
    failed_login_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    
    # For customer preferences
    preferred_contact_method = models.CharField(
        max_length=20,
        choices=[
            ('email', 'Email'),
            ('phone', 'Phone'),
            ('sms', 'SMS'),
        ],
        default='email'
    )
    favorite_pastry_notes = models.TextField(blank=True, help_text="Staff notes for VIP customers")
    birthday = models.DateField(null=True, blank=True)
    loyalty_points = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # ✅ ADD THIS PROPERTY
    @property
    def is_locked(self):
        """Check if the account is currently locked"""
        if self.locked_until:
            from django.utils import timezone
            return self.locked_until > timezone.now()
        return False
    
    # ✅ ADD THIS METHOD
    def lock_account(self, duration_minutes=30):
        """Lock the account for a specified duration"""
        from django.utils import timezone
        self.locked_until = timezone.now() + timezone.timedelta(minutes=duration_minutes)
        self.save(update_fields=['locked_until'])
    
    # ✅ ADD THIS METHOD
    def unlock_account(self):
        """Unlock the account"""
        self.locked_until = None
        self.failed_login_attempts = 0
        self.save(update_fields=['locked_until', 'failed_login_attempts'])
    
    def __str__(self):
        return f"Profile for {self.user.username}"
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'email_verified']),
            models.Index(fields=['phone_number']),
        ]

# Keep your signals as they are
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Auto-create profile when user registers"""
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Save profile when user is saved"""
    if not hasattr(instance, 'profile'):
        UserProfile.objects.create(user=instance)
    else:
        instance.profile.save()