// PageLayout.tsx - UPDATED WITH INTERFACE
import Navigation from "./Navigation";
import SocialLinks from "./SocialLinks";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

// ✅ ADD THIS INTERFACE RIGHT HERE (Line 6)
interface PageLayoutProps {
  children: React.ReactNode;
  cartCount?: number; // ✅ Add cartCount as optional prop
}

// ✅ UPDATE FUNCTION SIGNATURE TO USE THE INTERFACE
const PageLayout = ({ children, cartCount = 0 }: PageLayoutProps) => {
  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Fixed Navigation Header - PASS CARTCOUNT */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-sm border-b border-white/10">
        <Navigation cartCount={cartCount} /> {/* ✅ Pass cartCount */}
      </header>

      {/* Fixed Social Links - Consistent Position */}
      <aside className="fixed left-6 top-1/2 -translate-y-1/2 z-40 hidden lg:block">
        <SocialLinks />
      </aside>

      {/* Main Content Container */}
      <AnimatePresence mode="wait">
        <motion.main
          key={typeof window !== "undefined" ? window.location.pathname : ""}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{
            duration: 0.45,
            ease: "easeInOut",
          }}
          className="flex-1 pt-32 pb-20 px-4 sm:px-6 lg:px-8"
        >
          {/* Content Width Constraint */}
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </motion.main>
      </AnimatePresence>

      {/* Footer - Consistent Spacing */}
      <footer className="w-full bg-secondary/50 backdrop-blur-sm text-center py-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-foreground/80 text-sm tracking-wide">
            © Caleb 2026 — All rights reserved
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PageLayout;