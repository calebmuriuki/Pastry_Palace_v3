# products/notification_service.py
# ==================================
# All notification logic lives here — NOT in views.py or signals.py.
#
# Reason: signals.py needs _send_notification_inline, and views.py needs
# _on_payment_confirmed and _create_notification_profile. If these helpers
# lived in views.py, signals.py would import from views.py, creating a
# circular import that crashes Django on startup.
#
# Import chain after this move:
#   apps.py.ready()  → signals.py  → notification_service.py  ✓
#   views.py         → notification_service.py                 ✓
#   No cycle.
#
# Fixes applied vs original views.py:
#   ✓ changed_by='mpesa_callback' → None  (FK(User) field, string caused ValueError)
#   ✓ 'cancelled' key → 'order_cancelled'  (matches signals.py + SentNotification.event_type)
#   ✓ 'completed' template added            (was missing, signal fired into void)
#   ✓ timedelta imported here               (was imported in views.py, kept working)

from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

import logging
logger = logging.getLogger(__name__)

# Notification models — graceful if migrations haven't run yet
try:
    from .models import (
        OrderNotificationProfile,
        OrderStatusLog,
        CategoryPrepConfig,
        SentNotification,
    )
    NOTIFICATIONS_AVAILABLE = True
except ImportError:
    NOTIFICATIONS_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════════════════════
# PROFILE CREATION
# ═══════════════════════════════════════════════════════════════════════════════

def create_notification_profile(order):
    """
    Creates (or retrieves) an OrderNotificationProfile for a new order.
    Called immediately after Order.save() in create_order view.
    Returns the profile, or None if the notifications app isn't available.
    """
    if not NOTIFICATIONS_AVAILABLE:
        return None
    try:
        profile, _ = OrderNotificationProfile.objects.get_or_create(order=order)
        logger.info("Notification profile created — token: %s...", str(profile.tracking_token)[:8])
        return profile
    except Exception as exc:
        logger.warning("Could not create notification profile: %s", exc)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# PAYMENT CONFIRMATION — bake clock + ETA + status log + first email
# ═══════════════════════════════════════════════════════════════════════════════

def on_payment_confirmed(order, payment):
    """
    Called by mpesa_callback (and future Stripe webhook) after payment succeeds.

    1. Stamps payment_confirmed_at — this is when the bake clock starts.
    2. Calculates estimated_ready_at from CategoryPrepConfig (respects surge mode).
    3. Writes an OrderStatusLog row for the pending → confirmed transition.
       changed_by=None because this is an automatic system transition, not a
       baker action. The note field records the M-Pesa receipt number.
    4. Fires the payment_confirmed email inline (no Celery required).
    """
    if not NOTIFICATIONS_AVAILABLE:
        return

    now = timezone.now()

    # ── 1. Get or create profile ───────────────────────────────────────────
    try:
        profile = order.notification_profile
    except Exception:
        profile = create_notification_profile(order)

    if not profile:
        return

    # ── 2. Stamp payment_confirmed_at ──────────────────────────────────────
    profile.payment_confirmed_at = now

    # ── 3. Calculate estimated_ready_at ───────────────────────────────────
    # Walk: OrderItem → Product → Category → CategoryPrepConfig (slug match)
    try:
        first_item = (
            order.items
            .filter(product__isnull=False)
            .select_related('product__category')
            .first()
        )
        if first_item and first_item.product and first_item.product.category:
            category_slug = first_item.product.category.slug
            try:
                config = CategoryPrepConfig.objects.get(category_slug=category_slug)
                max_hours = float(config.effective_max_hours)
                profile.estimated_ready_at = now + timedelta(hours=max_hours)
                logger.info("ETA set: %.1fh → %s", max_hours, profile.estimated_ready_at)
            except CategoryPrepConfig.DoesNotExist:
                profile.estimated_ready_at = now + timedelta(hours=4)
                logger.warning(
                    "No CategoryPrepConfig for '%s', defaulting to 4h ETA", category_slug
                )
    except Exception as exc:
        logger.warning("Could not calculate ETA: %s", exc)
        profile.estimated_ready_at = now + timedelta(hours=4)

    profile.save()

    # ── 4. Log the status transition ───────────────────────────────────────
    # FIX: changed_by must be a User instance or None — never a string.
    # This was passing 'mpesa_callback' which raised ValueError and silently
    # prevented order confirmation on every single payment.
    try:
        OrderStatusLog.objects.create(
            order=order,
            old_status='pending',
            new_status='confirmed',
            changed_by=None,   # automatic system transition — NULL is correct
            note=(
                f"M-Pesa payment confirmed — "
                f"receipt: {payment.mpesa_transaction_id or 'N/A'}"
            ),
        )
    except Exception as exc:
        logger.warning("Could not create status log: %s", exc)

    # ── 5. Send payment-confirmed notification ─────────────────────────────
    try:
        send_notification(order, profile, 'payment_confirmed')
    except Exception as exc:
        logger.warning("Notification send failed (non-fatal): %s", exc)


# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICATION SENDER
# ═══════════════════════════════════════════════════════════════════════════════

# Canonical event_type strings.
# These MUST match the values written into SentNotification.event_type.
# SentNotification has unique_together = ('order', 'event_type', 'channel'),
# so an inconsistent string silently breaks the idempotency guard.
#
#   'payment_confirmed'  — triggered by on_payment_confirmed()
#   'preparing'          — triggered by baker_update_status view
#   'ready'              — triggered by signals.py post_save
#   'completed'          — triggered by signals.py post_save
#   'order_cancelled'    — triggered by signals.py post_save
#
# Note: signals.py uses 'order_cancelled' (not 'cancelled').
# The messages dict below uses the same key.

def send_notification(order, profile, event_type):
    """
    Synchronous notification sender.
    Fires email via Django's configured email backend (console in dev, SMTP in prod).
    Logs every send attempt to SentNotification for the admin delivery monitor.

    Channel dispatch per event:
      payment_confirmed  → email
      preparing          → email
      ready              → email + sms + whatsapp (if sms_consent)
      completed          → email + sms + whatsapp (if sms_consent)
      order_cancelled    → email
    """
    if not NOTIFICATIONS_AVAILABLE:
        return

    now = timezone.now()
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    tracking_url = f"{frontend_url}/track/{profile.tracking_token}"

    # ── Message templates ──────────────────────────────────────────────────
    # FIX 1: key was 'cancelled' — signals.py passes 'order_cancelled'.
    #         Mismatch caused messages.get() to return None → silent skip.
    # FIX 2: 'completed' template was entirely absent.
    eta_str = (
        profile.estimated_ready_at.strftime('%a %d %b, %I:%M %p')
        if profile.estimated_ready_at else 'We will update you soon'
    )

    messages = {
        'payment_confirmed': {
            'subject': f'Order #{order.order_number} confirmed — Pastries',
            'body': (
                f"Hi {order.customer_name},\n\n"
                f"Your payment has been received and your order is confirmed!\n\n"
                f"Order: #{order.order_number}\n"
                f"Amount: KShs {order.total_amount:,.2f}\n"
                f"Estimated ready: {eta_str}\n\n"
                f"Track your order:\n{tracking_url}\n\n"
                f"Thank you for your order!\n— The Pastries Team"
            ),
        },
        'preparing': {
            'subject': f'Your order #{order.order_number} is being prepared!',
            'body': (
                f"Hi {order.customer_name},\n\n"
                f"Your baker has started on your order!\n\n"
                f"Order: #{order.order_number}\n"
                f"Estimated ready: {eta_str}\n\n"
                f"Track your order: {tracking_url}\n\n"
                f"— The Pastries Team"
            ),
        },
        'ready': {
            'subject': f'Your order #{order.order_number} is ready!',
            'body': (
                f"Hi {order.customer_name},\n\n"
                f"Your order is ready for pickup/delivery!\n\n"
                f"Order: #{order.order_number}\n\n"
                f"Track here: {tracking_url}\n\n"
                f"— The Pastries Team"
            ),
        },
        'completed': {
            'subject': f'Order #{order.order_number} complete — thank you!',
            'body': (
                f"Hi {order.customer_name},\n\n"
                f"Your order has been delivered. Thank you for ordering from Pastries!\n\n"
                f"We'd love to hear what you thought:\n"
                f"{frontend_url}/review/{order.order_number}\n\n"
                f"— The Pastries Team"
            ),
        },
        'order_cancelled': {
            # FIX: was 'cancelled' — now matches signals.py and SentNotification records
            'subject': f'Order #{order.order_number} cancelled',
            'body': (
                f"Hi {order.customer_name},\n\n"
                f"Your order #{order.order_number} has been cancelled.\n"
                f"If you paid, a refund will be processed within 3–5 business days.\n\n"
                f"— The Pastries Team"
            ),
        },
    }

    msg = messages.get(event_type)
    if not msg:
        logger.warning(
            "No message template for event '%s' — skipping notification for order %s",
            event_type, order.order_number
        )
        return

    # ── Email ──────────────────────────────────────────────────────────────
    if profile.notif_email and order.customer_email:
        try:
            send_mail(
                subject=msg['subject'],
                message=msg['body'],
                from_email=getattr(
                    settings, 'DEFAULT_FROM_EMAIL', 'noreply@pastries.co.ke'
                ),
                recipient_list=[order.customer_email],
                fail_silently=False,
            )
            SentNotification.objects.get_or_create(
                order=order,
                event_type=event_type,
                channel='email',
                defaults={
                    'status': 'sent',
                    'sent_at': now,
                    'attempt_count': 1,
                },
            )
            logger.info("Email sent to %s [%s]", order.customer_email, event_type)
        except Exception as exc:
            logger.error("Email failed [%s]: %s", event_type, exc)
            SentNotification.objects.get_or_create(
                order=order,
                event_type=event_type,
                channel='email',
                defaults={
                    'status': 'failed',
                    'last_error': str(exc)[:500],
                    'attempt_count': 1,
                },
            )

    # ── SMS / WhatsApp — ready + completed only, requires sms_consent ──────
    # Records a 'pending' SentNotification row so the admin panel shows intent.
    # Wire Twilio/Africa's Talking here when ready; the idempotency guard
    # (unique_together) will prevent duplicate sends on retry.
    sms_events = {'ready', 'completed'}
    if event_type in sms_events and profile.sms_consent:
        for channel in ('sms', 'whatsapp'):
            channel_enabled = (
                (channel == 'sms' and profile.notif_sms)
                or (channel == 'whatsapp' and profile.notif_whatsapp)
            )
            if channel_enabled:
                SentNotification.objects.get_or_create(
                    order=order,
                    event_type=event_type,
                    channel=channel,
                    defaults={
                        'status': 'pending',
                        'attempt_count': 0,
                    },
                )
                logger.info(
                    "%s queued for [%s] — wire Twilio to send",
                    channel.upper(), event_type
                )