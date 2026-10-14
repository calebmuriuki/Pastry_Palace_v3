import { Facebook, Twitter, Instagram } from "lucide-react";

const SocialLinks = () => {
  return (
    <div className="fixed left-8 top-1/2 -translate-y-1/2 z-20 hidden lg:flex flex-col gap-6">
      <a
        href="#facebook"
        className="text-foreground hover:text-primary transition-colors"
        aria-label="Facebook"
      >
        <Facebook className="h-5 w-5" />
      </a>
      <a
        href="#twitter"
        className="text-foreground hover:text-primary transition-colors"
        aria-label="Twitter"
      >
        <Twitter className="h-5 w-5" />
      </a>
      <a
        href="https://www.instagram.com/"
        className="text-foreground hover:text-primary transition-colors"
        aria-label="Instagram"
      >
        <Instagram className="h-5 w-5" />
      </a>
      <div className="w-px h-20 bg-foreground/20 mx-auto"></div>
      <span className="text-xs text-foreground/60 -rotate-90 whitespace-nowrap origin-center tracking-wider uppercase">
        Any time Of Day, We always Deliver...
      </span>
    </div>
  );
};

export default SocialLinks;
