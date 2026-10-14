# products/management/commands/generateimages.py
# CREATE THIS FILE: products/management/commands/generateimages.py

from django.core.management.base import BaseCommand
from products.models import Product, Category
from imagekit.cachefiles import ImageCacheFile

class Command(BaseCommand):
    help = 'Pre-generate ImageKit cache for all products and categories'

    def handle(self, *args, **options):
        self.stdout.write('🔄 Generating ImageKit cache...\n')
        
        # Products
        products = Product.objects.filter(is_active=True).exclude(image='')
        total = products.count()
        
        for idx, product in enumerate(products, 1):
            self.stdout.write(f'[{idx}/{total}] Processing: {product.name}')
            
            try:
                # Force generate all sizes
                if hasattr(product, 'image_thumbnail'):
                    _ = product.image_thumbnail.url
                    self.stdout.write(f'  ✓ Thumbnail generated')
                
                if hasattr(product, 'image_medium'):
                    _ = product.image_medium.url
                    self.stdout.write(f'  ✓ Medium generated')
                
                if hasattr(product, 'image_large'):
                    _ = product.image_large.url
                    self.stdout.write(f'  ✓ Large generated')
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  ✗ Error: {e}'))
        
        # Categories
        categories = Category.objects.filter(is_active=True).exclude(image='')
        for category in categories:
            try:
                if hasattr(category, 'image_thumbnail'):
                    _ = category.image_thumbnail.url
                    self.stdout.write(f'✓ Category: {category.name}')
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'✗ Category {category.name}: {e}'))
        
        self.stdout.write(self.style.SUCCESS('\n✅ Image cache generation complete!'))