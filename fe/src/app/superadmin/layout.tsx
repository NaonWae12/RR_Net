"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { SuperAdminHeader } from "@/components/layout/SuperAdminHeader";
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  Package, 
  CreditCard,
  Settings,
  ShieldCheck,
  Zap,
  Activity,
  MessageSquare,
  Briefcase,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SuperAdminLayoutProps {
  children: ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/superadmin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/superadmin/tenants", label: "Tenants", icon: Users },
    { href: "/superadmin/affiliates", label: "Affiliates", icon: Briefcase },
    { href: "/superadmin/plans", label: "Plans", icon: Layers },
    { href: "/superadmin/addons", label: "Addons", icon: Package },
    { href: "/superadmin/cms", label: "Landing CMS", icon: Settings },
    { href: "/superadmin/billing", label: "Billing", icon: CreditCard },
  ];

  const secondaryItems = [
    { href: "/superadmin/monitoring", label: "System Health", icon: Activity },
    { href: "/superadmin/ai", label: "AI & Automation", icon: Bot },
    { href: "/superadmin/whatsapp", label: "WhatsApp Setup", icon: MessageSquare },
    { href: "/superadmin/compliance", label: "Compliance", icon: ShieldCheck },
  ];

  const isActive = (href: string) => {
    if (href === "/superadmin") {
      return pathname === "/superadmin";
    }
    return pathname?.startsWith(href);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-slate-100 flex flex-col sticky top-0 h-screen">
          <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <Zap className="text-white h-6 w-6 fill-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900 leading-none tracking-tight">ERP<span className="text-indigo-600">.</span>NET</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Super Admin</p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-4">Core Operations</p>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative overflow-hidden",
                        active
                          ? "bg-indigo-50 text-indigo-700 shadow-sm"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      {active && (
                        <motion.div 
                          layoutId="sidebar-active"
                          className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-r-full"
                        />
                      )}
                      <Icon className={cn(
                        "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                        active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                      )} />
                      <span className="text-sm font-bold tracking-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="mt-10 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-4">Infrastructure</p>
              <nav className="space-y-1">
                {secondaryItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300",
                        active
                          ? "bg-indigo-50 text-indigo-700 font-bold"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                      )}
                    >
                      <Icon className={cn(
                        "h-5 w-5",
                        active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                      )} />
                      <span className="text-sm tracking-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="mt-auto p-8 border-t border-slate-100">
            <div className="bg-slate-900 rounded-2xl p-4 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 h-20 w-20 bg-indigo-600/20 rounded-full blur-2xl group-hover:bg-indigo-600/30 transition-all duration-500" />
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Status Keamanan</p>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white">Sistem Terenkripsi</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <SuperAdminHeader />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}

