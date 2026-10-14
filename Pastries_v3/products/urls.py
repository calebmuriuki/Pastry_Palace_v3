# products/urls.py
# =================
# All original routes preserved exactly.
# PURCHASE HISTORY ENDPOINTS ADDED:
#   purchases/user/<str:user_id>/        — Get all purchases for a user
#   purchases/stats/<str:user_id>/       — Get purchase statistics
#   purchases/<str:purchase_id>/         — Get single purchase details
#   purchases/user/<str:user_id>/status/<str:status_filter>/ — Filter by status
#   purchases/user/<str:user_id>/recent/ — Get recent purchases

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.views.decorators.csrf import csrf_exempt
from . import views

router = DefaultRouter()
router.register(r'categories', views.CategoryViewSet, basename='category')
router.register(r'products',   views.ProductViewSet,  basename='product')
router.register(r'orders',     views.OrderViewSet,    basename='order')

urlpatterns = [
    # ── CSRF ──────────────────────────────────────────────────────────────
    path('csrf-token/', views.get_csrf_token, name='csrf-token'),
    
    # ── Authentication ──────────────────────────────────────────────────
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    
    # ── Profile ──────────────────────────────────────────────────────────
    path('profile/', views.get_profile, name='profile'),
    path('profile/update/', views.update_profile, name='profile-update'),
    path('user/', views.get_current_user, name='current-user'),
    
    # ── ViewSet routes ──────────────────────────────────────────────────
    path('', include(router.urls)),
    
    # ── Debug (remove in production) ──────────────────────────────────
    path('debug/', views.debug_api, name='debug'),
    path('debug/images/', views.debug_images, name='debug-images'),
    
    # ── Cart ──────────────────────────────────────────────────────────────
    path('cart/', views.get_cart, name='cart'),
    path('cart/add/', csrf_exempt(views.add_to_cart), name='add-to-cart'),
    path('cart/update/<int:item_id>/', csrf_exempt(views.update_cart_item), name='update-cart-item'),
    path('cart/remove/<int:item_id>/', csrf_exempt(views.remove_cart_item), name='remove-cart-item'),
    path('cart/clear/', csrf_exempt(views.clear_cart), name='clear-cart'),
    path('cart/merge/', views.merge_guest_cart, name='merge-cart'),
    
    # ── Orders ──────────────────────────────────────────────────────────
    path('create-order/', csrf_exempt(views.create_order), name='create-order'),
    path('orders/<int:order_id>/', views.get_order, name='get-order'),
    
    # ── Order tracking (public — UUID token acts as the secret) ──────────
    path('track/<str:tracking_token>/', views.track_order, name='track-order'),
    
    # ── M-Pesa payments ──────────────────────────────────────────────────
    path('payments/mpesa/callback/', csrf_exempt(views.mpesa_callback), name='mpesa-callback'),
    path('payments/mpesa/query/', csrf_exempt(views.mpesa_query_status), name='mpesa-query'),
    path('payments/status/<int:order_id>/', views.get_payment_status, name='payment-status'),
    path('baker/orders/<int:order_id>/status/', views.baker_update_status, name='baker-update-status'),
    
    # ── Delivery Tracking ──────────────────────────────────────────────
    path('delivery/tracking/<str:tracking_token>/', views.get_delivery_tracking, name='delivery-tracking'),
    path('delivery/tracking/create/<int:order_id>/', views.create_delivery_tracking, name='create-delivery-tracking'),
    path('delivery/driver/location/', views.update_driver_location, name='update-driver-location'),
    path('delivery/assign/<int:order_id>/', views.assign_driver_to_order, name='assign-driver'),
    path('delivery/status/<int:order_id>/', views.update_delivery_status, name='update-delivery-status'),
    path('geocode/', views.geocode_address, name='geocode'),
    path('address-autocomplete/', views.address_autocomplete, name='address-autocomplete'),
    
    # ═══════════════════════════════════════════════════════════════════════
    # PURCHASE HISTORY ENDPOINTS
    # ═══════════════════════════════════════════════════════════════════════
    
    # Get all purchases for a user with their items
    path('purchases/user/<str:user_id>/', views.get_user_purchases, name='user-purchases'),
    
    # Get purchase statistics (total spent, orders, average, last order)
    path('purchases/stats/<str:user_id>/', views.get_purchase_stats, name='purchase-stats'),
    
    # Get a single purchase by ID with all details
    path('purchases/<str:purchase_id>/', views.get_purchase_by_id, name='purchase-detail'),
    
    # Get purchases filtered by status (pending, completed, cancelled, etc.)
    path('purchases/user/<str:user_id>/status/<str:status_filter>/', views.get_purchases_by_status, name='purchases-by-status'),
    
    # Get recent purchases (last 30 days)
    path('purchases/user/<str:user_id>/recent/', views.get_recent_purchases, name='recent-purchases'),
    
    # ═══════════════════════════════════════════════════════════════════════
    # PDF REPORT ENDPOINTS
    # ═══════════════════════════════════════════════════════════════════════
    
    # Get report data as JSON (for frontend to render with jsPDF)
    path('reports/data/', views.get_report_data, name='report-data'),
    
    # Get PDF-ready data (frontend uses jsPDF to generate PDF)
    path('reports/pdf-data/', views.generate_pdf_report, name='pdf-report-data'),
    
    # Download PDF generated on server (uses reportlab)
    path('reports/download/', views.download_pdf_report, name='download-pdf-report'),
    
    # Filtered report endpoints
    path('reports/orders/', views.get_report_data, name='report-orders'),
    path('reports/items/', views.get_report_data, name='report-items'),
    path('reports/payments/', views.get_report_data, name='report-payments'),
    
    # Role check endpoint
    path('auth/role/', views.get_user_role, name='user-role'),

    
]