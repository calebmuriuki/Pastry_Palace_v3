import { Button } from "../components/ui/button";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import heroCake from "@/assets/hero-cake.jpg";
import strawberry from "@/assets/strawberry.png";
import flower from "@/assets/flower.png";

const Hero = () => {
  return (
    <section className="relative min-h-[calc(100vh-100px)] flex items-center justify-center px-8 py-12">
      {/* Main Content Container */}
      <div className="relative w-full max-w-7xl bg-secondary rounded-[3rem] p-12 md:p-16 overflow-hidden">
        {/* Decorative floating elements */}
        <img
          src={strawberry}
          alt=""
          className="absolute top-12 right-1/4 w-16 h-16 object-contain animate-float"
          style={{ animationDelay: "0s" }}
        />
        <img
          src={strawberry}
          alt=""
          className="absolute bottom-1/3 left-12 w-12 h-12 object-contain animate-float"
          style={{ animationDelay: "1s" }}
        />
        <img
          src={strawberry}
          alt=""
          className="absolute top-1/2 left-1/3 w-10 h-10 object-contain animate-float"
          style={{ animationDelay: "2s" }}
        />
        <img
          src={flower}
          alt=""
          className="absolute top-1/4 right-1/3 w-12 h-12 object-contain animate-float opacity-70"
          style={{ animationDelay: "0.5s" }}
        />
        <img
          src={flower}
          alt=""
          className="absolute bottom-1/4 right-16 w-10 h-10 object-contain animate-float opacity-70"
          style={{ animationDelay: "1.5s" }}
        />

        <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                Every One{" "}
                <span className="font-serif italic text-primary">Love's</span>
              </h1>
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                <span className="text-foreground">Natural and</span>
                <br />
                <span className="text-primary">healthy Cakes.</span>
              </h2>
            </div>

            <b><p className="text-muted-foreground text-lg max-w-md leading-relaxed tracking-wide">
              Welcome to Pastry Palace , where artisan craftsmanship meets the convenience of online indulgence. We specialize in curating an exquisite collection of handcrafted cakes, designed to elevate your celebrations and everyday moments into unforgettable experiences. </p></b>

            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="uppercase tracking-wide">
                Order Now
              </Button>
              <Button variant="outline" size="lg" className="uppercase tracking-wide">
                Explore More
              </Button>
            </div>
          </div>

          {/* Right Content - Product Showcase */}
          <div className="relative">
            {/* Circular Badge */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-24 h-24 bg-white rounded-full border-2 border-dashed border-foreground/30 flex items-center justify-center z-10">
              <div className="text-center">
                <span className="text-2xl">🎂</span>
                <p className="text-[10px] font-bold uppercase leading-tight mt-1">
                  We Care
                  <br />
                  What You
                  <br />
                  Eat
                </p>
              </div>
            </div>

            {/* Product Image with Border */}
            <div className="relative bg-white rounded-full border-8 border-primary p-4 aspect-square max-w-md mx-auto">
              <img
                src={heroCake}
                alt="Delicious strawberry cake with fresh cream"
                className="w-full h-full object-cover rounded-full"
              />

              {/* Rating Badge */}
              <div className="absolute bottom-8 -right-4 bg-foreground text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <Star className="h-4 w-4 fill-yellow-400/50 text-yellow-400/50" />
                <span className="font-bold ml-1">4.5</span>
              </div>

              {/* Navigation Arrows */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                <button className="w-12 h-12 bg-white border-2 border-foreground/10 rounded-full flex items-center justify-center hover:border-primary transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Page Indicators */}
            <div className="absolute top-1/4 right-8 flex flex-col gap-2">
              <span className="text-primary font-bold text-2xl">01</span>
              <div className="w-px h-12 bg-foreground/20"></div>
              <span className="text-muted-foreground text-sm">03</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
