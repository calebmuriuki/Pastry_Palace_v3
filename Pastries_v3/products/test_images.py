# create test_images.py in your project root
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Pastries_v3.settings')
django.setup()

from products.models import Product

# Test all products
for product in Product.objects.all():
    print(f"\n=== Testing {product.name} ===")
    print(f"Has image field: {bool(product.image)}")
    if product.image:
        print(f"Original image path: {product.image.path}")
        print(f"Original image URL: {product.image.url}")
    
    # Test ImageSpecFields
    for field_name in ['image_thumbnail', 'image_medium', 'image_large']:
        if hasattr(product, field_name):
            image_field = getattr(product, field_name)
            print(f"{field_name}: {image_field}")
            try:
                print(f"{field_name} URL: {image_field.url}")
                print(f"{field_name} exists on disk: {os.path.exists(image_field.path)}")
            except Exception as e:
                print(f"{field_name} error: {e}")