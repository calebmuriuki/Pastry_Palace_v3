# Pastries_v3/Pastries_v3/urls.py
from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from django.conf import settings
from django.conf.urls.static import static

from products.views import get_csrf_token


def api_docs(request):
    return HttpResponse("""
        <h1>🍰 Pastries API</h1>
        <p>Available endpoints:</p>
        <ul>
            <li><a href="/api/categories/">📂 Categories</a></li>
            <li><a href="/api/products/">📦 Products</a></li>
            <li><a href="/api/admin/">🔧 Admin</a></li>
            <li><a href="/api/purchases/user/1/">📋 Purchase History</a></li>
            <li><a href="/media/">🖼️ Media Files</a></li>
        </ul>
        <p>Frontend: <a href="http://localhost:5173">http://localhost:5173</a></p>
        <hr>
        <p>🔍 Test Image: <a href="/media/products/2026/01/08/chocolate-cake.jpg">Chocolate Cake</a></p>
    """)

urlpatterns = [
    # Admin & Core
    path('admin/', admin.site.urls),
    
    # API Routes - All API endpoints are in products.urls
    path('api/', include('products.urls')),
    
    # Home page
    path('', api_docs, name='home'),
    
    # CSRF Token endpoint (also available in products.urls)
    path('api/csrf-token/', get_csrf_token, name='csrf-token'),
]

# ============================================
# SERVE MEDIA & STATIC FILES IN DEVELOPMENT
# ============================================
if settings.DEBUG:
    # Serve media files (user uploaded images)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    
    # Serve static files (CSS, JS, etc.)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)