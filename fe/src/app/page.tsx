import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import LandingPageClient from "@/components/marketing/LandingPageClient";

export async function generateMetadata(): Promise<Metadata> {
  const defaultMeta = {
    title: "RRNET | All-in-One ERP for ISP & Network Providers",
    description: "Scale your ISP business with automated billing, WhatsApp gateway, and advanced network management. The ultimate ERP solution for modern network providers.",
    keywords: ["ISP ERP", "Network Management", "Billing Software", "WhatsApp Gateway", "ISP Automation", "RRNET"],
  };

  try {
    const apiURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
    const res = await fetch(`${apiURL}/public/site-settings/seo`, { 
      next: { revalidate: 60 } // Revalidate every minute
    });
    
    if (!res.ok) return defaultMeta;
    
    const seo = await res.json();
    
    return {
      title: seo.title || defaultMeta.title,
      description: seo.description || defaultMeta.description,
      keywords: seo.keywords?.length > 0 ? seo.keywords : defaultMeta.keywords,
      openGraph: {
        title: seo.title || defaultMeta.title,
        description: seo.description || defaultMeta.description,
        type: "website",
        locale: "en_US",
        siteName: "RRNET",
      },
    };
  } catch (error) {
    return defaultMeta;
  }
}

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen selection:bg-purple-500/30">
      <MarketingNavbar />
      <main className="flex-grow">
        <LandingPageClient />
      </main>
      <MarketingFooter />
    </div>
  );
}
