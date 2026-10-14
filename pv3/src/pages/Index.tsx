import Navigation from "../components/Navigation";
import SocialLinks from "../components/SocialLinks";
import Hero from "../components/Hero";

const Index = () => {
  return (
    <div className="min-h-screen bg-primary">
      <div className="relative">
        <Navigation />
        <SocialLinks />
        <Hero />
       <footer className="w-full bg-secondary/50 backdrop-blur-sm text-center py-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-foreground/80 text-sm tracking-wide">
            © Caleb 2026 — All rights reserved
          </p>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default Index;
