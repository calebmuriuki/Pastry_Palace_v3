"""
Django settings for Pastries_v3 project - FIXED FOR 403 ERROR
ENHANCED: Added Google Maps API and delivery tracking configurations
"""

from pathlib import Path
from decouple import config

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent



SECRET_KEY = config('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=False, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')


# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'corsheaders',
    'imagekit',
    
    # Local apps
    'products.apps.ProductsConfig',
]

# ============================================
# MIDDLEWARE (CORRECT ORDER IS CRITICAL!)
# ============================================
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Must be first
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',  # Before CSRF
    'whitenoise.middleware.WhiteNoiseMiddleware',	
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'Pastries_v3.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'Pastries_v3.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Nairobi'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ============================================
# SESSION CONFIGURATION (CRITICAL FOR CART)
# ============================================
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_NAME = 'sessionid'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'  # 'Lax' for same-site, 'None' for cross-domain
SESSION_COOKIE_SECURE = False  # Set True in production with HTTPS
SESSION_COOKIE_AGE = 1209600  # 2 weeks in seconds
SESSION_SAVE_EVERY_REQUEST = True  # ✅ CRITICAL: Save session on every request
SESSION_COOKIE_DOMAIN = None  # Allow localhost
SESSION_EXPIRE_AT_BROWSER_CLOSE = False


# ============================================
# CSRF CONFIGURATION (CRITICAL FOR POST REQUESTS)
# ============================================
CSRF_COOKIE_NAME = 'csrftoken'
CSRF_COOKIE_HTTPONLY = False  # ✅ MUST be False so JavaScript can read it
CSRF_COOKIE_SAMESITE = 'Lax'  # Match session cookie
CSRF_COOKIE_SECURE = False  # Set True in production
CSRF_USE_SESSIONS = False  # Use cookie-based CSRF (not session-based)
CSRF_COOKIE_AGE = 31449600  # 1 year
CSRF_COOKIE_DOMAIN = None  # Allow localhost

# ✅ Trusted origins for CSRF
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://4ed5-102-0-7-236.ngrok-free.app'
]


# ============================================
# CORS SETTINGS (FOR REACT FRONTEND)
# ============================================
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "https://4ed5-102-0-7-236.ngrok-free.app",
]

CORS_ALLOW_CREDENTIALS = True  # ✅ CRITICAL: Allow cookies

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',  # ✅ CRITICAL: Allow CSRF header
    'x-requested-with',
    'cache-control',
    'pragma',
]


# ============================================
# REST FRAMEWORK SETTINGS
# ============================================
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DATETIME_FORMAT': '%Y-%m-%d %H:%M:%S',
}


# ============================================
# STRIPE SETTINGS
# ============================================
STRIPE_PUBLIC_KEY = config('STRIPE_PUBLIC_KEY', default='pk_test_your_key_here')
STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY', default='sk_test_your_key_here')


# ============================================
# M-PESA SETTINGS
# ============================================
MPESA_ENVIRONMENT = config('MPESA_ENVIRONMENT', default='sandbox')
MPESA_CONSUMER_KEY = config('MPESA_CONSUMER_KEY', default='')
MPESA_CONSUMER_SECRET = config('MPESA_CONSUMER_SECRET', default='')
MPESA_SHORTCODE = config('MPESA_SHORTCODE', default='174379')
MPESA_PASSKEY = config('MPESA_PASSKEY', default='')
MPESA_CALLBACK_URL = config('MPESA_CALLBACK_URL', default='http://localhost:8000/api/payments/mpesa/callback/')


# ============================================
# GOOGLE MAPS CONFIGURATION (NEW)
# ============================================
# Get your API key from Google Cloud Console
# Enable: Maps JavaScript API, Geocoding API, Directions API, Places API
GOOGLE_MAPS_API_KEY = config('GOOGLE_MAPS_API_KEY', default='')

# Bakery Location Coordinates (set your actual bakery location)
# Nairobi coordinates are used as default
BAKERY_LATITUDE = config('BAKERY_LATITUDE', default=-1.286389)  # Latitude
BAKERY_LONGITUDE = config('BAKERY_LONGITUDE', default=36.817223)  # Longitude

# Delivery tracking settings
DELIVERY_TRACKING_ENABLED = config('DELIVERY_TRACKING_ENABLED', default=True, cast=bool)
LOCATION_UPDATE_INTERVAL = config('LOCATION_UPDATE_INTERVAL', default=5, cast=int)  # seconds
MAX_DELIVERY_DISTANCE_KM = config('MAX_DELIVERY_DISTANCE_KM', default=20, cast=int)  # kilometers


# ============================================
# EMAIL SETTINGS
# ============================================
EMAIL_BACKEND = config(
    'EMAIL_BACKEND',
    default='django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = config('EMAIL_HOST', default='')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@pastries.co.ke')


# ============================================
# CACHE SETTINGS
# ============================================
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    },
}


# ============================================
# IMAGEKIT SETTINGS
# ============================================
IMAGEKIT_CACHEFILE_DIR = 'cache/images'
IMAGEKIT_DEFAULT_CACHEFILE_STRATEGY = 'imagekit.cachefiles.strategies.JustInTime'
IMAGEKIT_CACHE_BACKEND = 'default'
IMAGEKIT_CACHEFILE_TIMEOUT = 3600
IMAGEKIT_DEFAULT_QUALITY = 85
IMAGEKIT_LAZY_GENERATION = False
IMAGEKIT_PILLOW_DEFAULT_OPTIONS = {
    'quality': 85,
    'optimize': True,
}
IMAGEKIT_SPEC_CACHEFILE_NAMER = 'imagekit.cachefiles.namers.hash'


# ============================================
# LOGGING (ENHANCED FOR DELIVERY TRACKING)
# ============================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django.request': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'products.services': {  # Google Maps service logging
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'products.views': {  # Delivery tracking views logging
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# ============================================
# FRONTEND URL (FOR TRACKING LINKS)
# ============================================
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')


# ============================================
# STORAGES
# ============================================
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
