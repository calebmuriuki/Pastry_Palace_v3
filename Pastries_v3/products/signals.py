# products/signals.py  (new file)
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Order

@receiver(post_save, sender=Order)
def order_status_changed(sender, instance, created, update_fields, **kwargs):
    if created:
        return
    if update_fields and 'status' not in update_fields:
        return

    try:
        from .models import OrderNotificationProfile
        from .views import _send_notification_inline
        from django.utils import timezone
        profile = instance.notification_profile
    except Exception:
        return

    if instance.status == 'ready':
        if not profile.ready_at:
            profile.ready_at = timezone.now()
            profile.save(update_fields=['ready_at', 'updated_at'])
        _send_notification_inline(instance, profile, 'ready')

    elif instance.status == 'completed':
        _send_notification_inline(instance, profile, 'completed')

    elif instance.status == 'cancelled':
        _send_notification_inline(instance, profile, 'order_cancelled')