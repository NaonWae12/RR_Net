"use client";

import { useState, useEffect } from "react";
import { 
  Zap, 
  Home, 
  Users, 
  Coins, 
  CreditCard, 
  Briefcase, 
  Settings, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

export default function AffiliateDashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const navItems = [
    { id: "overview", label: "Beranda", icon: Home, href: "/affiliate/dashboard" },
    { id: "referrals", label: "Mitra Saya", icon: Users, href: "/affiliate/dashboard/referrals" }, 
    { id: "scheme", label: "Skema Komisi", icon: Coins, href: "/affiliate/dashboard/commissions-scheme" },
    { id: "commissions", label: "Penarikan", icon: CreditCard, href: "/affiliate/dashboard/withdrawals" }, 
    { id: "marketing", label: "Materi Pro", icon: Briefcase, href: "/affiliate/dashboard/marketing" }, 
    { id: "settings", label: "Profil", icon: Settings, href: "/affiliate/dashboard/settings" }, 
  ];

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (!isMounted) return null;

  return (
    <div className="h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row overflow-hidden relative">
      
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Zap className="text-indigo-600 w-6 h-6 fill-current" />
          <h1 className="text-lg font-black tracking-tighter">Partner<span className="text-indigo-600">Hub</span></h1>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="p-2 -mr-2 text-slate-400">
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[300px] bg-white z-[70] p-8 flex flex-col shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-3">
                  <Zap className="text-indigo-600 w-7 h-7 fill-current" />
                  <h1 className="text-xl font-black tracking-tighter">Partner<span className="text-indigo-600">Hub</span></h1>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 -mr-2 text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        router.push(item.href);
                        setSidebarOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm",
                        isActive
                          ? "bg-indigo-600 text-white shadow-lg" 
                          : "text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className="pt-8 border-t border-slate-100">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 transition-all font-bold text-sm"
                >
                  <LogOut className="w-5 h-5" />
                  Keluar
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-[280px] bg-white border-r border-slate-200 p-8 flex-col h-full shrink-0">
        <div className="flex items-center gap-3 mb-12 cursor-pointer" onClick={() => router.push("/affiliate/dashboard")}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Zap className="text-white w-6 h-6 fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Partner<span className="text-indigo-600">Hub</span></h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">RRNET Affiliate</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm",
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="pt-8 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 transition-all font-bold text-sm"
          >
            <LogOut className="w-5 h-5" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

    </div>
  );
}
