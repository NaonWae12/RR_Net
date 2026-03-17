import Link from "next/link";
import { Zap, Github, Twitter, Linkedin, Mail } from "lucide-react";

export const MarketingFooter = () => {
  const currentYear = new Date().getFullYear();

  const sections = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#" },
        { label: "Integrations", href: "#" },
        { label: "Pricing", href: "#" },
        { label: "Changelog", href: "#" },
      ],
    },
    {
      title: "Solution",
      links: [
        { label: "For Small ISP", href: "#" },
        { label: "Enterprise", href: "#" },
        { label: "Hotspot Management", href: "#" },
        { label: "Financial Reporting", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Us", href: "#" },
        { label: "Affiliate Program", href: "#" },
        { label: "Compliance", href: "#" },
        { label: "Contact", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Documentation", href: "#" },
        { label: "Help Center", href: "#" },
        { label: "Privacy Policy", href: "#" },
        { label: "Terms of Service", href: "#" },
      ],
    },
  ];

  return (
    <footer className="bg-muted/30 border-t pt-20 pb-10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-lg flex items-center justify-center">
                <Zap className="text-white w-5 h-5 fill-current" />
              </div>
              <span className="text-xl font-bold tracking-tight">RRNET</span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6 max-w-xs">
              The next-generation ERP platform designed specifically for ISP and 
              Network Providers. Empowering growth through intelligent automation.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-9 h-9 rounded-full bg-background border flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                <Github className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-background border flex items-center justify-center hover:bg-sky-500 hover:text-white transition-all">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-background border flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-background border flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all">
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold text-sm uppercase tracking-wider mb-6 text-foreground/80">
                {section.title}
              </h4>
              <ul className="flex flex-col gap-4">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground italic">
            Visual excellence by InoVexa
          </p>
          <p className="text-xs text-muted-foreground">
            © {currentYear} RRNET Global. All rights reserved.
          </p>
          <div className="flex gap-6">
             <Link href="#" className="text-xs text-muted-foreground hover:text-foreground">Status</Link>
             <Link href="#" className="text-xs text-muted-foreground hover:text-foreground">Cookies</Link>
             <Link href="#" className="text-xs text-muted-foreground hover:text-foreground">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
