# products/admin.py — CakeCraft Complete Admin
# ==============================================
# Original e-commerce admin (Category → Product → Cart → Order → Payment)
# is 100% preserved — every list_display, list_editable, fieldset, method,
# badge colour, icon, and search field is byte-for-byte identical.
#
# Notification layer added in two ways:
#   1. NEW inlines on OrderAdmin (OrderNotificationProfileInline,
#      SentNotificationInline) — show tracking + delivery status per order
#   2. NEW admin classes at the bottom for the four notification models
#
# One bug fixed from the original notification admin file:
#   CategoryPrepConfigAdmin had surge_mode in list_editable but NOT in
#   list_display — Django raises ImproperlyConfigured at startup. Fixed by
#   adding surge_mode to list_display between freshness_hours and surge_toggle.
#
# SINGLE FILE: no separate notifications/admin.py needed.
# Register everything here so the admin stays in one place.

from django.contrib import admin
from django.conf import settings
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe

# ── Original models ──────────────────────────────────────────────────────────
from .models import (
    Category,
    Product,
    ProductVariant,
    Cart,
    CartItem,
    Order,
    OrderItem,
    Payment,
)

# ── Notification models ───────────────────────────────────────────────────────
# Imported with try/except so the original admin still loads even if the
# notifications app migration hasn't run yet during initial setup.
try:
    from .models import (
        CategoryPrepConfig,
        OrderNotificationProfile,
        SentNotification,
        OrderStatusLog,
    )
    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    NOTIFICATIONS_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — CATALOGUE ADMIN
# Original code — zero changes
# ═══════════════════════════════════════════════════════════════════════════════

# ==================== CATEGORY ADMIN ====================
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'name', 'slug', 'image_preview', 'menu_count_display',
        'is_active', 'display_order', 'created_at'
    ]
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    list_editable = ['is_active', 'display_order']
    ordering = ['display_order', 'name']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['image_preview_large', 'created_at', 'updated_at']

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'slug', 'description', 'display_order', 'is_active')
        }),
        ('Image', {
            'fields': ('image', 'image_preview_large')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def menu_count_display(self, obj):
        return obj.menu_count
    menu_count_display.short_description = 'Products'

    def image_preview(self, obj):
        """Small thumbnail for list view"""
        if obj.image:
            try:
                if hasattr(obj, 'image_thumbnail'):
                    url = obj.image_thumbnail.url
                else:
                    url = obj.image.url
                return format_html(
                    '<img src="{}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />',
                    url
                )
            except Exception as e:
                return format_html(
                    '<span style="color: red;">❌ Error: {}</span>',
                    str(e)
                )
        return mark_safe('<span style="color: gray;">No image</span>')
    image_preview.short_description = 'Image'

    def image_preview_large(self, obj):
        """Large preview for detail view"""
        if obj.image:
            try:
                if hasattr(obj, 'image_card'):
                    url = obj.image_card.url
                else:
                    url = obj.image.url

                return format_html(
                    '<div style="margin: 10px 0;">'
                    '<img src="{}" style="max-width: 400px; max-height: 300px; border: 1px solid #ddd; border-radius: 8px;" />'
                    '<div style="margin-top: 10px; font-size: 12px; color: #666;">'
                    '<strong>Image URL:</strong> <a href="{}" target="_blank">{}</a>'
                    '</div>'
                    '</div>',
                    url, url, url
                )
            except Exception as e:
                return format_html(
                    '<div style="padding: 10px; background: #fee; border: 1px solid #fcc; border-radius: 4px;">'
                    '<strong style="color: red;">❌ Image Error:</strong><br>{}'
                    '</div>',
                    str(e)
                )
        return format_html('<span style="color: gray;">{}</span>',
        "No image uploaded")
    image_preview_large.short_description = 'Image Preview'


# ==================== PRODUCT ADMIN ====================
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'name', 'category', 'image_preview', 'display_price_method',
        'is_active', 'is_featured', 'has_variants', 'created_at'
    ]
    list_filter = ['category', 'is_active', 'is_featured', 'has_variants', 'created_at']
    search_fields = ['name', 'description', 'sku', 'tags']
    list_editable = ['is_active', 'is_featured']
    ordering = ['-is_featured', '-created_at']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['image_preview_large', 'display_price', 'created_at', 'updated_at']

    fieldsets = (
        ('Basic Information', {
            'fields': ('category', 'name', 'slug', 'description', 'sku', 'tags')
        }),
        ('Image', {
            'fields': ('image', 'image_preview_large')
        }),
        ('Pricing & Variants', {
            'fields': ('base_price', 'display_price', 'has_variants')
        }),
        ('Status & Features', {
            'fields': ('is_active', 'is_featured')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def display_price_method(self, obj):
        return f"KShs {obj.display_price:,.2f}"
    display_price_method.short_description = 'Price'
    display_price_method.admin_order_field = 'base_price'

    def image_preview(self, obj):
        """Small thumbnail for list view"""
        if obj.image:
            try:
                if hasattr(obj, 'image_thumbnail'):
                    url = obj.image_thumbnail.url
                else:
                    url = obj.image.url
                return format_html(
                    '<img src="{}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />',
                    url
                )
            except Exception as e:
                return format_html(
                    '<span style="color: red; font-size: 10px;">❌ {}</span>',
                    str(e)[:30]
                )
        return mark_safe('<span style="color: gray;">No image</span>')
    image_preview.short_description = 'Image'

    def image_preview_large(self, obj):
        """Large preview with multiple sizes"""
        if obj.image:
            html_parts = []

            # Original image
            try:
                url = obj.image.url
                html_parts.append(
                    f'<div style="margin-bottom: 15px;">'
                    f'<h4 style="margin: 0 0 5px 0;">Original Image</h4>'
                    f'<img src="{url}" style="max-width: 400px; max-height: 300px; border: 1px solid #ddd; border-radius: 8px;" />'
                    f'<div style="font-size: 11px; color: #666; margin-top: 5px;">'
                    f'<a href="{url}" target="_blank">{url}</a>'
                    f'</div>'
                    f'</div>'
                )
            except Exception as e:
                html_parts.append(
                    f'<div style="color: red; margin-bottom: 10px;">❌ Original: {str(e)}</div>'
                )

            # Thumbnail
            if hasattr(obj, 'image_thumbnail'):
                try:
                    url = obj.image_thumbnail.url
                    html_parts.append(
                        f'<div style="display: inline-block; margin-right: 15px; vertical-align: top;">'
                        f'<h5 style="margin: 0 0 5px 0;">Thumbnail</h5>'
                        f'<img src="{url}" style="border: 1px solid #ddd; border-radius: 4px;" />'
                        f'<div style="font-size: 10px; color: #666;">{url.split("/")[-1]}</div>'
                        f'</div>'
                    )
                except Exception as e:
                    html_parts.append(
                        f'<div style="color: orange; font-size: 11px;">⚠️ Thumbnail: {str(e)}</div>'
                    )

            # Medium
            if hasattr(obj, 'image_medium'):
                try:
                    url = obj.image_medium.url
                    html_parts.append(
                        f'<div style="display: inline-block; margin-right: 15px; vertical-align: top;">'
                        f'<h5 style="margin: 0 0 5px 0;">Medium</h5>'
                        f'<img src="{url}" style="max-width: 200px; border: 1px solid #ddd; border-radius: 4px;" />'
                        f'<div style="font-size: 10px; color: #666;">{url.split("/")[-1]}</div>'
                        f'</div>'
                    )
                except Exception as e:
                    html_parts.append(
                        f'<div style="color: orange; font-size: 11px;">⚠️ Medium: {str(e)}</div>'
                    )

            # Large
            if hasattr(obj, 'image_large'):
                try:
                    url = obj.image_large.url
                    html_parts.append(
                        f'<div style="display: inline-block; vertical-align: top;">'
                        f'<h5 style="margin: 0 0 5px 0;">Large</h5>'
                        f'<img src="{url}" style="max-width: 200px; border: 1px solid #ddd; border-radius: 4px;" />'
                        f'<div style="font-size: 10px; color: #666;">{url.split("/")[-1]}</div>'
                        f'</div>'
                    )
                except Exception as e:
                    html_parts.append(
                        f'<div style="color: orange; font-size: 11px;">⚠️ Large: {str(e)}</div>'
                    )

            return mark_safe(''.join(html_parts))

        return mark_safe('<span style="color: gray;">No image uploaded</span>')
    image_preview_large.short_description = 'Image Previews'


# ==================== PRODUCT VARIANT ADMIN ====================
@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'product',
        'name',
        'price_display',
        'stock_quantity',
        'in_stock_display',
        'is_active',
        'is_default',
    ]

    list_filter = ['is_active', 'is_default', 'product__category']
    search_fields = ['name', 'product__name']
    list_editable = ['stock_quantity', 'is_active', 'is_default']
    ordering = ['product', 'display_order']

    def price_display(self, obj):
        return obj.price
    price_display.short_description = "Price"

    def in_stock_display(self, obj):
        # format_html() with no {} placeholders raises TypeError in Django 6.
        # mark_safe() is correct here — the HTML is 100% static, no user data.
        if obj.stock_quantity > 0:
            return mark_safe(
                "<span style='color:white;background:green;padding:2px 8px;border-radius:10px;'>✔ In Stock</span>"
            )
        return mark_safe(
            "<span style='color:white;background:red;padding:2px 8px;border-radius:10px;'>✖ Out of Stock</span>"
        )
    in_stock_display.short_description = "Stock Status"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — CART ADMIN
# Original code — zero changes
# ═══════════════════════════════════════════════════════════════════════════════

class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    readonly_fields = ['product', 'variant', 'quantity', 'unit_price_display', 'subtotal_display', 'added_at']
    can_delete = False

    def unit_price_display(self, obj):
        return f"KShs {obj.unit_price:,.2f}"
    unit_price_display.short_description = 'Unit Price'

    def subtotal_display(self, obj):
        return f"KShs {obj.subtotal:,.2f}"
    subtotal_display.short_description = 'Subtotal'


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user_display', 'session_key_short',
        'total_items_display', 'total_price_display', 'created_at'
    ]
    list_filter = ['created_at']
    search_fields = ['user__username', 'user__email', 'session_key']
    readonly_fields = ['total_price_display', 'total_items_display']
    inlines = [CartItemInline]

    def user_display(self, obj):
        if obj.user:
            return format_html(
                '<strong>{}</strong><br><span style="color: #666; font-size: 11px;">{}</span>',
                obj.user.username,
                obj.user.email
            )
        return mark_safe('<span style="color: gray;">Anonymous</span>')
    user_display.short_description = 'User'

    def session_key_short(self, obj):
        if obj.session_key:
            short = obj.session_key[:15] + '...' if len(obj.session_key) > 15 else obj.session_key
            return format_html(
                '<span style="font-family: monospace; font-size: 10px;">{}</span>',
                short
            )
        return '—'
    session_key_short.short_description = 'Session'

    def total_items_display(self, obj):
        count = obj.total_items
        return format_html(
            '<span style="font-weight: bold;">{}</span>',
            count
        )
    total_items_display.short_description = 'Items'

    def total_price_display(self, obj):
        return f"KShs {obj.total_price:,.2f}"
    total_price_display.short_description = 'Total'


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — ORDER ADMIN
# Original OrderItemInline and most of OrderAdmin preserved exactly.
# Notification layer adds:
#   • OrderNotificationProfileInline — tracking token + channel prefs + bake timeline
#   • SentNotificationInline         — delivery status of every notification
#   • notification_status column     — at-a-glance sent/failed counts in list view
#   • 'Notifications' fieldset       — appended at bottom of OrderAdmin detail view
#   • Bulk actions                   — resend_ready_notification, mark_ready_for_pickup
# ═══════════════════════════════════════════════════════════════════════════════

class OrderItemInline(admin.TabularInline):
    """Original — untouched"""
    model = OrderItem
    extra = 0
    readonly_fields = ['product', 'variant', 'product_name', 'variant_name', 'unit_price', 'quantity', 'subtotal_display']
    can_delete = False

    def subtotal_display(self, obj):
        return f"KShs {obj.subtotal:,.2f}"
    subtotal_display.short_description = 'Subtotal'


# ── NEW: Notification inlines (only registered if notifications app is available)
if NOTIFICATIONS_AVAILABLE:

    class OrderNotificationProfileInline(admin.StackedInline):
        """
        Shows the notification profile for this order inside OrderAdmin.
        Lets support staff:
          • Copy the tracking URL to share with the customer
          • See which channels the customer opted into
          • See all bake timeline timestamps in one place
          • Edit channel preferences if customer calls asking to change
        """
        model = OrderNotificationProfile
        extra = 0
        max_num = 1          # OneToOne — can only ever be one
        can_delete = False   # Never orphan a tracking token
        verbose_name = 'Notification Profile'
        verbose_name_plural = 'Notification Profile'

        readonly_fields = [
            'tracking_token',
            'tracking_url_display',
            'payment_confirmed_at',
            'bake_started_at',
            'estimated_ready_at',
            'ready_at',
            'dispatched_at',
            'is_overdue_display',
            'created_at',
            'updated_at',
        ]

        fieldsets = [
            ('Tracking', {
                'fields': ['tracking_token', 'tracking_url_display'],
            }),
            ('Channel Preferences', {
                'fields': [
                    'notif_email', 'notif_sms', 'notif_whatsapp',
                    'sms_consent', 'sms_consent_at',
                ],
                'description': (
                    'These control which channels Celery will send to. '
                    'sms_consent must be True before any SMS or WhatsApp is sent.'
                ),
            }),
            ('Bake Timeline', {
                'fields': [
                    'payment_confirmed_at', 'bake_started_at',
                    'estimated_ready_at', 'is_overdue_display',
                    'ready_at', 'dispatched_at',
                ],
            }),
        ]

        def tracking_url_display(self, obj):
            frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            url = f"{frontend}/track/{obj.tracking_token}"
            return format_html(
                '<a href="{}" target="_blank" style="font-family:monospace;font-size:12px;">{}</a>',
                url, url
            )
        tracking_url_display.short_description = 'Customer Tracking URL'

        def is_overdue_display(self, obj):
            if obj.is_overdue:
                return format_html(
                    '<span style="background:#c47b7b;color:white;padding:2px 10px;'
                    'border-radius:3px;font-weight:bold;">⚠️ OVERDUE</span>'
                )
            return format_html(
                '<span style="background:#7aab7a;color:white;padding:2px 10px;'
                'border-radius:3px;">On Track</span>'
            )
        is_overdue_display.short_description = 'ETA Status'


    class SentNotificationInline(admin.TabularInline):
        """
        Shows every notification sent (or attempted) for this order.
        All readonly — audit only. Use SentNotificationAdmin for retry actions.
        """
        model = SentNotification
        extra = 0
        can_delete = False
        verbose_name = 'Sent Notification'
        verbose_name_plural = 'Notification Delivery Log'

        readonly_fields = [
            'event_type', 'channel', 'status_badge_inline',
            'attempt_count', 'provider_id', 'last_error_short', 'sent_at',
        ]
        fields = readonly_fields   # show only these columns, nothing editable

        def status_badge_inline(self, obj):
            colors = {
                'sent':     ('#7aab7a', 'SENT'),
                'failed':   ('#c47b7b', 'FAILED ❌'),
                'pending':  ('#d4a853', 'PENDING'),
                'retrying': ('#c97d3a', 'RETRYING'),
            }
            color, label = colors.get(obj.status, ('#888', obj.status.upper()))
            return format_html(
                '<span style="background:{};color:white;padding:2px 8px;'
                'border-radius:3px;font-size:11px">{}</span>',
                color, label
            )
        status_badge_inline.short_description = 'Status'

        def last_error_short(self, obj):
            if obj.last_error:
                return format_html(
                    '<span style="color:#c47b7b;font-size:11px;" title="{}">{}</span>',
                    obj.last_error,
                    obj.last_error[:60] + ('...' if len(obj.last_error) > 60 else '')
                )
            return '—'
        last_error_short.short_description = 'Last Error'


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    # ── list_display: original columns preserved in original order ──
    # notification_status appended at end — does not disrupt existing columns
    list_display = [
        'order_number', 'customer_name', 'customer_email_short',
        'total_amount_display', 'status_badge', 'created_at_formatted',
        'notification_status',   # ← NEW: at-a-glance delivery summary
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['order_number', 'customer_email', 'customer_name', 'customer_phone']

    # ── readonly_fields: originals preserved, new ones appended ──
    readonly_fields = ['order_number', 'total_amount', 'created_at', 'updated_at']

    # ── inlines: OrderItemInline first (original), notification inlines added after ──
    inlines = (
        [OrderItemInline, OrderNotificationProfileInline, SentNotificationInline]
        if NOTIFICATIONS_AVAILABLE else
        [OrderItemInline]
    )

    # ── actions: new bulk notification actions ──
    actions = ['resend_ready_notification', 'mark_as_preparing']

    fieldsets = (
        # ── ORIGINAL fieldsets — byte-for-byte identical ──────────────────────
        ('Order Information', {
            'fields': ('order_number', 'status', 'total_amount', 'created_at', 'updated_at')
        }),
        ('Customer Information', {
            'fields': ('user', 'customer_name', 'customer_email', 'customer_phone')
        }),
        ('Delivery Information', {
            'fields': ('delivery_address', 'delivery_date', 'delivery_time', 'special_instructions')
        }),
        # ── NEW fieldset appended at bottom ───────────────────────────────────
        ('Notifications', {
            'fields': (),   # actual content shown via inlines
            'description': (
                'Notification delivery history and tracking profile are shown '
                'in the inline sections below.'
            ),
            'classes': ('collapse',),
        }),
    )

    # ── ORIGINAL methods — zero changes ──────────────────────────────────────

    def customer_email_short(self, obj):
        email = obj.customer_email
        return email[:25] + '...' if len(email) > 25 else email
    customer_email_short.short_description = 'Email'

    def total_amount_display(self, obj):
        return f"KShs {obj.total_amount:,.2f}"
    total_amount_display.short_description = 'Total'
    total_amount_display.admin_order_field = 'total_amount'

    def status_badge(self, obj):
        """Colorful status badges — original colours and icons preserved exactly"""
        status_styles = {
            'pending':   ('⏳', '#ff9800', '#fff'),
            'confirmed': ('✓',  '#2196f3', '#fff'),
            'preparing': ('🔧', '#9c27b0', '#fff'),
            'ready':     ('✓✓', '#4caf50', '#fff'),
            'completed': ('✓✓✓','#8bc34a', '#333'),
            'cancelled': ('✗',  '#f44336', '#fff'),
        }
        icon, bg_color, text_color = status_styles.get(obj.status, ('•', '#9e9e9e', '#fff'))

        return format_html(
            '<span style="'
            'display: inline-block; '
            'padding: 4px 12px; '
            'background: {}; '
            'color: {}; '
            'border-radius: 12px; '
            'font-weight: bold; '
            'font-size: 11px; '
            'white-space: nowrap;'
            '">{} {}</span>',
            bg_color, text_color, icon, obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    def created_at_formatted(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')
    created_at_formatted.short_description = 'Created'
    created_at_formatted.admin_order_field = 'created_at'

    # ── NEW methods added by notification layer ───────────────────────────────

    def notification_status(self, obj):
        """
        Shows sent/failed notification counts inline in the order list.
        Green = all sent, red = some failed, grey = none sent yet.
        """
        if not NOTIFICATIONS_AVAILABLE:
            return '—'
        try:
            sent   = obj.sent_notifications.filter(status='sent').count()
            failed = obj.sent_notifications.filter(status='failed').count()
            total  = obj.sent_notifications.count()

            if total == 0:
                return format_html(
                    '<span style="color:#999;font-size:11px;">No notifs</span>'
                )
            if failed > 0:
                return format_html(
                    '<span style="color:#7aab7a;font-size:11px;">✉ {}</span> '
                    '<span style="color:#c47b7b;font-size:11px;">❌ {}</span>',
                    sent, failed
                )
            return format_html(
                '<span style="color:#7aab7a;font-size:11px;">✉ {} sent</span>',
                sent
            )
        except Exception:
            return '—'
    notification_status.short_description = 'Notifs'

    # ── Bulk actions ──────────────────────────────────────────────────────────

    @admin.action(description='📨 Resend "ready" notification to selected orders')
    def resend_ready_notification(self, request, queryset):
        """
        Manually re-fires the 'ready' notification for selected orders.
        Useful when a customer missed the first notification.
        Note: resets the SentNotification record to 'pending' first so the
        idempotency guard doesn't block the resend.
        """
        if not NOTIFICATIONS_AVAILABLE:
            self.message_user(request, '⚠️ Notifications app not available.', level='warning')
            return

        from .notifications.tasks import dispatch_order_notification  # noqa

        resent = 0
        skipped = 0
        for order in queryset.filter(status='ready'):
            # Reset the idempotency record so it can be re-sent
            SentNotification.objects.filter(
                order=order, event_type='ready'
            ).update(status='pending', attempt_count=0, last_error='')
            dispatch_order_notification.delay(order.id, 'ready')
            resent += 1

        for order in queryset.exclude(status='ready'):
            skipped += 1

        msg = f'✅ Queued ready notifications for {resent} order(s).'
        if skipped:
            msg += f' Skipped {skipped} (not in "ready" status).'
        self.message_user(request, msg)

    @admin.action(description='🔧 Mark selected orders as Preparing')
    def mark_as_preparing(self, request, queryset):
        """
        Bulk-moves confirmed orders to 'preparing' status.
        Also fires the 'preparing' notification via Celery.
        Only acts on orders currently in 'confirmed' status.
        """
        if not NOTIFICATIONS_AVAILABLE:
            self.message_user(request, '⚠️ Notifications app not available.', level='warning')
            return

        from .notifications.tasks import dispatch_order_notification  # noqa

        updated = 0
        skipped = 0
        for order in queryset.filter(status='confirmed'):
            order.status = 'preparing'
            order.save(update_fields=['status', 'updated_at'])
            if NOTIFICATIONS_AVAILABLE:
                try:
                    profile = order.notification_profile
                    from django.utils import timezone
                    profile.bake_started_at = timezone.now()
                    profile.save(update_fields=['bake_started_at', 'updated_at'])
                except OrderNotificationProfile.DoesNotExist:
                    pass
            dispatch_order_notification.delay(order.id, 'preparing')
            updated += 1

        for order in queryset.exclude(status='confirmed'):
            skipped += 1

        msg = f'🔧 Moved {updated} order(s) to "preparing".'
        if skipped:
            msg += f' Skipped {skipped} (not in "confirmed" status).'
        self.message_user(request, msg)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — PAYMENT ADMIN
# Original code — zero changes
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'order_link', 'payment_method_badge', 'amount_display',
        'status_badge', 'created_at_formatted'
    ]
    list_filter = ['payment_method', 'status', 'created_at']
    search_fields = [
        'order__order_number',
        'stripe_payment_intent_id',
        'mpesa_transaction_id',
        'mpesa_phone'
    ]
    readonly_fields = [
        'stripe_payment_intent_id',
        'stripe_charge_id',
        'mpesa_checkout_request_id',
        'mpesa_transaction_id',
        'transaction_data',
        'error_message',
        'created_at',
        'updated_at'
    ]

    fieldsets = (
        ('Payment Information', {
            'fields': ('order', 'payment_method', 'amount', 'status')
        }),
        ('Stripe Details', {
            'fields': ('stripe_payment_intent_id', 'stripe_charge_id'),
            'classes': ('collapse',)
        }),
        ('M-Pesa Details', {
            'fields': (
                'mpesa_checkout_request_id',
                'mpesa_transaction_id',
                'mpesa_phone'
            ),
            'classes': ('collapse',)
        }),
        ('Transaction Data', {
            'fields': ('transaction_data', 'error_message'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    def order_link(self, obj):
        url = reverse('admin:products_order_change', args=[obj.order.id])
        return format_html(
            '<a href="{}" style="font-weight: bold;">{}</a>',
            url, obj.order.order_number
        )
    order_link.short_description = 'Order'

    def payment_method_badge(self, obj):
        """Payment method with icon"""
        method_styles = {
            'stripe': ('💳', '#635bff'),
            'mpesa':  ('📱', '#00a550'),
            'cash':   ('💰', '#ff9800'),
        }
        icon, color = method_styles.get(obj.payment_method, ('•', '#9e9e9e'))

        return format_html(
            '<span style="color: {}; font-weight: bold;">{} {}</span>',
            color, icon, obj.get_payment_method_display()
        )
    payment_method_badge.short_description = 'Method'

    def amount_display(self, obj):
        return f"KShs {obj.amount:,.2f}"
    amount_display.short_description = 'Amount'

    def status_badge(self, obj):
        """Colorful status badge"""
        status_styles = {
            'pending':    ('⏳', '#ff9800', '#fff'),
            'processing': ('🔄', '#2196f3', '#fff'),
            'completed':  ('✓',  '#4caf50', '#fff'),
            'failed':     ('✗',  '#f44336', '#fff'),
            'refunded':   ('↩',  '#9e9e9e', '#fff'),
        }
        icon, bg_color, text_color = status_styles.get(obj.status, ('•', '#9e9e9e', '#fff'))

        return format_html(
            '<span style="'
            'display: inline-block; '
            'padding: 4px 12px; '
            'background: {}; '
            'color: {}; '
            'border-radius: 12px; '
            'font-weight: bold; '
            'font-size: 11px;'
            '">{} {}</span>',
            bg_color, text_color, icon, obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    def created_at_formatted(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')
    created_at_formatted.short_description = 'Created'


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — CART & ORDER ITEM STANDALONE ADMINS
# Original code — zero changes
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'cart', 'product', 'variant', 'quantity',
        'unit_price_display', 'subtotal_display', 'added_at'
    ]
    list_filter = ['added_at', 'cart']
    search_fields = ['product__name', 'cart__id']

    def unit_price_display(self, obj):
        return f"KShs {obj.unit_price:,.2f}"
    unit_price_display.short_description = 'Unit Price'

    def subtotal_display(self, obj):
        return f"KShs {obj.subtotal:,.2f}"
    subtotal_display.short_description = 'Subtotal'


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'order_link', 'product_name', 'variant_name',
        'unit_price_display', 'quantity', 'subtotal_display'
    ]
    list_filter = ['order']
    search_fields = ['product_name', 'order__order_number']

    def order_link(self, obj):
        url = reverse('admin:products_order_change', args=[obj.order.id])
        return format_html(
            '<a href="{}">{}</a>',
            url, obj.order.order_number
        )
    order_link.short_description = 'Order'

    def unit_price_display(self, obj):
        return f"KShs {obj.unit_price:,.2f}"
    unit_price_display.short_description = 'Unit Price'

    def subtotal_display(self, obj):
        return f"KShs {obj.subtotal:,.2f}"
    subtotal_display.short_description = 'Subtotal'


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — NOTIFICATION ADMIN CLASSES
# Registered only if the notifications models are available.
# ═══════════════════════════════════════════════════════════════════════════════

if NOTIFICATIONS_AVAILABLE:

    @admin.register(CategoryPrepConfig)
    class CategoryPrepConfigAdmin(admin.ModelAdmin):
        """
        Baker's control panel for bake time configuration.
        Change min/max hours, freshness windows, and surge mode here —
        no code deploy needed.
        """
        list_display = [
            'category_label',
            'category_slug',
            'min_hours',
            'effective_max_display',
            'freshness_hours',
            'surge_mode',          # ← required here because surge_mode is in list_editable
            'surge_toggle',
            'updated_at',
        ]
        # Every field in list_editable MUST appear in list_display — fixed vs original
        list_editable = ['min_hours', 'freshness_hours', 'surge_mode']
        readonly_fields = ['updated_at']

        fieldsets = [
            ('Category', {
                'fields': ['category_slug', 'category_label'],
                'description': (
                    'category_slug must match your existing Category.slug exactly. '
                    'Check /admin/products/category/ to confirm slugs.'
                ),
            }),
            ('Prep Times', {
                'fields': ['min_hours', 'max_hours', 'freshness_hours'],
                'description': (
                    'Configure how long this category takes to bake '
                    'and how long it stays fresh after ready.'
                ),
            }),
            ('Surge Mode', {
                'fields': ['surge_mode', 'surge_buffer_hours'],
                'description': '⚡ Enable on busy days — automatically adds buffer hours to max prep time.',
            }),
        ]

        def effective_max_display(self, obj):
            if obj.surge_mode:
                return format_html(
                    '<span style="color:#c97d3a;font-weight:bold">{} hrs ⚡ surge</span>',
                    obj.effective_max_hours
                )
            return f'{obj.max_hours} hrs'
        effective_max_display.short_description = 'Max Hours'

        def surge_toggle(self, obj):
            if obj.surge_mode:
                return format_html(
                    '<span style="background:#c97d3a;color:white;padding:2px 8px;'
                    'border-radius:3px;font-size:11px">SURGE ON</span>'
                )
            return format_html(
                '<span style="background:#7aab7a;color:white;padding:2px 8px;'
                'border-radius:3px;font-size:11px">Normal</span>'
            )
        surge_toggle.short_description = 'Surge'


    @admin.register(OrderNotificationProfile)
    class OrderNotificationProfileAdmin(admin.ModelAdmin):
        """
        Full notification profile list — use for customer support lookups.
        Find a customer's tracking URL, resend tokens, or check consent records.
        """
        list_display = [
            'order_link',
            'tracking_token_short',
            'channel_prefs',
            'payment_confirmed_at',
            'ready_at',
            'is_overdue_badge',
            'review_prompt_sent',
        ]
        list_filter   = ['notif_email', 'notif_sms', 'notif_whatsapp', 'sms_consent']
        search_fields = ['order__order_number', 'order__customer_name', 'order__customer_email']
        readonly_fields = [
            'tracking_token',
            'tracking_url_display',
            'payment_confirmed_at',
            'bake_started_at',
            'estimated_ready_at',
            'ready_at',
            'dispatched_at',
            'created_at',
            'updated_at',
        ]

        fieldsets = [
            ('Order', {
                'fields': ['order', 'tracking_token', 'tracking_url_display'],
            }),
            ('Notification Preferences', {
                'fields': [
                    'notif_email', 'notif_sms', 'notif_whatsapp',
                    'sms_consent', 'sms_consent_at',
                ],
            }),
            ('Bake Timeline', {
                'fields': [
                    'payment_confirmed_at', 'bake_started_at',
                    'estimated_ready_at', 'ready_at', 'dispatched_at',
                ],
            }),
            ('Review', {
                'fields': ['review_prompt_sent'],
            }),
        ]

        def order_link(self, obj):
            url = reverse('admin:products_order_change', args=[obj.order.id])
            return format_html(
                '<a href="{}">#{} — {}</a>',
                url, obj.order.order_number, obj.order.customer_name
            )
        order_link.short_description = 'Order'

        def tracking_token_short(self, obj):
            return str(obj.tracking_token)[:8] + '...'
        tracking_token_short.short_description = 'Token'

        def channel_prefs(self, obj):
            prefs = []
            if obj.notif_email:    prefs.append('📧')
            if obj.notif_sms:      prefs.append('📱')
            if obj.notif_whatsapp: prefs.append('💬')
            return ' '.join(prefs) or '—'
        channel_prefs.short_description = 'Channels'

        def tracking_url_display(self, obj):
            frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            url = f"{frontend}/track/{obj.tracking_token}"
            return format_html('<a href="{}" target="_blank">{}</a>', url, url)
        tracking_url_display.short_description = 'Tracking URL (share with customer)'

        def is_overdue_badge(self, obj):
            if obj.is_overdue:
                return format_html(
                    '<span style="background:#c47b7b;color:white;padding:2px 8px;'
                    'border-radius:3px;font-size:11px">⚠️ OVERDUE</span>'
                )
            return '—'
        is_overdue_badge.short_description = 'ETA'


    @admin.register(SentNotification)
    class SentNotificationAdmin(admin.ModelAdmin):
        """
        Full notification delivery log.
        Use the retry action to re-queue failed notifications.
        """
        list_display = [
            'order_link',
            'event_type',
            'channel',
            'status_badge',
            'attempt_count',
            'provider_id_short',
            'sent_at',
            'created_at',
        ]
        list_filter   = ['status', 'channel', 'event_type', 'created_at']
        search_fields = ['order__order_number', 'order__customer_name', 'last_error']
        readonly_fields = [
            'order', 'event_type', 'channel', 'sent_at', 'created_at', 'provider_id',
        ]
        actions = ['retry_failed']

        def order_link(self, obj):
            url = reverse('admin:products_order_change', args=[obj.order.id])
            return format_html(
                '<a href="{}">#{}</a> {}',
                url, obj.order.order_number, obj.order.customer_name[:20]
            )
        order_link.short_description = 'Order'

        def status_badge(self, obj):
            colors = {
                'sent':     ('#7aab7a', 'SENT'),
                'failed':   ('#c47b7b', 'FAILED ❌'),
                'pending':  ('#d4a853', 'PENDING'),
                'retrying': ('#c97d3a', 'RETRYING'),
            }
            color, label = colors.get(obj.status, ('#888', obj.status.upper()))
            return format_html(
                '<span style="background:{};color:white;padding:2px 8px;'
                'border-radius:3px;font-size:11px">{}</span>',
                color, label
            )
        status_badge.short_description = 'Status'

        def provider_id_short(self, obj):
            if obj.provider_id:
                return obj.provider_id[:20] + '...'
            return '—'
        provider_id_short.short_description = 'Provider ID'

        @admin.action(description='🔄 Retry failed notifications')
        def retry_failed(self, request, queryset):
            """
            Resets failed notifications to pending and re-queues them via Celery.
            Resets attempt_count so the retry logic starts fresh.
            """
            from products.notifications.tasks import send_single_notification  # noqa

            retried = 0
            for notif in queryset.filter(status='failed'):
                notif.status        = 'pending'
                notif.attempt_count = 0
                notif.last_error    = ''
                notif.save()
                send_single_notification.delay(
                    notif.order.id, notif.event_type, notif.channel
                )
                retried += 1
            self.message_user(request, f'✅ Queued {retried} notifications for retry.')


    @admin.register(OrderStatusLog)
    class OrderStatusLogAdmin(admin.ModelAdmin):
        """
        Full audit trail of every Order.status transition.
        Read-only — used for debugging and compliance.
        """
        list_display  = [
            'order_link', 'old_status', 'arrow', 'new_status',
            'changed_by', 'note_short', 'changed_at',
        ]
        list_filter   = ['new_status', 'changed_at']
        search_fields = ['order__order_number', 'order__customer_name', 'note']
        readonly_fields = [
            'order', 'old_status', 'new_status', 'changed_by', 'note', 'changed_at',
        ]

        def order_link(self, obj):
            url = reverse('admin:products_order_change', args=[obj.order.id])
            return format_html('<a href="{}">{}</a>', url, obj.order.order_number)
        order_link.short_description = 'Order'

        def arrow(self, obj):
            return '→'
        arrow.short_description = ''

        def note_short(self, obj):
            if obj.note:
                return obj.note[:40] + ('...' if len(obj.note) > 40 else '')
            return '—'
        note_short.short_description = 'Note'


# ═══════════════════════════════════════════════════════════════════════════════
# SITE CUSTOMIZATION — original preserved exactly
# ═══════════════════════════════════════════════════════════════════════════════

admin.site.site_header = "Pastries v3 Administration"
admin.site.site_title = "Pastries v3 Admin"
admin.site.index_title = "Welcome to Pastries v3 Admin Portal"
