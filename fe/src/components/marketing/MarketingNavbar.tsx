"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Rocket, Zap, Users, Shield, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLink {
  label: string;
  href: string;
  icon: any;
}

interface MarketingNavbarProps {
  customLinks?: NavLink[];
  registerHref?: string;
  registerLabel?: string;
}

export const MarketingNavbar = ({ 
  customLinks, 
  registerHref = "/register",
  registerLabel = "Get Started"
}: MarketingNavbarProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const defaultLinks = [
    { label: "Features", href: "#features", icon: Zap },
    { label: "Solutions", href: "#solutions", icon: Shield },
    { label: "Pricing", href: "#pricing", icon: Rocket },
    { label: "Affiliate", href: "/affiliate", icon: Users },
  ];

  const navLinks = customLinks || defaultLinks;

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      
      // Nutup menu dulu biar layout stabil
      setMobileMenuOpen(false);

      // Kasih delay dikit biar animasi nutup menu gak ganggu kalkulasi scroll
      setTimeout(() => {
        const id = href.replace("#", "");
        const element = document.getElementById(id);
        if (element) {
          const offset = 80; // tinggi navbar fixed
          const bodyRect = document.body.getBoundingClientRect().top;
          const elementRect = element.getBoundingClientRect().top;
          const elementPosition = elementRect - bodyRect;
          const offsetPosition = elementPosition - offset;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
          });
        }
      }, 100);
    } else {
      // Untuk regular link, tutup menu dulu
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
        (isScrolled || mobileMenuOpen)
          ? "bg-background/95 backdrop-blur-xl border-border py-3 shadow-lg" 
          : "bg-transparent border-transparent py-5"
      )}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform duration-300">
              <Zap className="text-white w-6 h-6 fill-current" />
            </div>
            <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              RRNET
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <motion.div key={link.label} whileHover="hover" initial="initial">
                <Link
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group block py-1"
                >
                  {link.label}
                  <motion.span 
                    variants={{
                      initial: { width: 0, opacity: 0 },
                      hover: { width: "100%", opacity: 1 }
                    }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className="absolute -bottom-1 left-0 h-0.5 bg-gradient-to-r from-purple-600 to-cyan-500" 
                  />
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-medium hover:text-primary transition-colors px-4 py-2"
            >
              Log in
            </Link>
            <Link 
              href={registerHref} 
              className="bg-foreground text-background dark:bg-foreground dark:text-background px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2 group shadow-xl"
            >
              {registerLabel}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button 
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background/98 backdrop-blur-xl border-b overflow-hidden"
          >
            <div className="container mx-auto px-4 py-8 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className="flex items-center gap-4 text-xl font-semibold p-3 hover:bg-accent rounded-xl transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                    <link.icon className="w-5 h-5 text-purple-600" />
                  </div>
                  {link.label}
                </Link>
              ))}
              <div className="h-px bg-border my-4" />
              <div className="grid grid-cols-1 gap-3">
                <Link 
                  href="/login" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-4 font-bold hover:bg-accent rounded-xl border border-border"
                >
                  Log in
                </Link>
                <Link 
                  href={registerHref} 
                  onClick={() => setMobileMenuOpen(false)}
                  className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-center py-4 rounded-xl font-bold shadow-lg shadow-purple-500/20 active:scale-[0.98] transition-transform"
                >
                  {registerLabel}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
