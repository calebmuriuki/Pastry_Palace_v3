import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";
import { useCart } from "../Contexts/CartContext";

// Product type from API
interface ApiProduct {
  id: number;
  name: string;
  price: string;
  image: string;
  category: string;
  in_stock: boolean;
}

const ProductsGallery = () => {
  const { addToCart } = useCart();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use Vite environment variable for base URL
  const API_URL = `http://localhost:8000/api/products/`;

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        console.log("🚀 STARTING FETCH FROM:", API_URL);
        
        const res = await fetch(API_URL);
        console.log("📡 RESPONSE STATUS:", res.status);
        console.log("📡 RESPONSE OK:", res.ok);
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const text = await res.text();
        console.log("📄 RAW RESPONSE:", text.substring(0, 500));
        
        const data = JSON.parse(text);
        console.log("✅ PARSED DATA:", data);
        console.log("🔢 RESULTS COUNT:", data.results?.length);
        console.log("📦 FIRST PRODUCT:", data.results?.[0]);
        
        setProducts(data.results || []);
        setError(null);
        
      } catch (err) {
        console.error("❌ FETCH ERROR:", err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [API_URL]);

  const handleAddToCart = (id: number, quantity: number) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    addToCart(
      {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        image: product.image,
      },
      quantity
    );
  };

  // Debug info in UI
  if (loading) {
    return (
      <section className="py-20 px-8">
        <p className="text-center text-lg">Loading products from: {API_URL}</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-20 px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-2xl text-red-600 mb-4">Error Loading Products</h2>
          <p className="text-gray-600 mb-2">Error: {error}</p>
          <p className="text-gray-600">API URL: {API_URL}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="cakes" className="py-20 px-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-12">
      

        {/* Header */}
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Our <span className="text-primary font-serif italic">Menu</span>
          </h2>
      
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-gray-600">No products found</p>
            <p className="text-sm text-gray-500">Check console for details</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={String(product.id)}
                name={product.name}
                image={product.image}
                price={Number(product.price)}
                onAddToCart={(id, quantity) =>
                  handleAddToCart(Number(id), quantity)
                }
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductsGallery;