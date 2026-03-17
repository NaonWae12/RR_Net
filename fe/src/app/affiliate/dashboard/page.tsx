"use client";

import { useState, useEffect } from "react";
import { 
  Zap, 
  Users, 
  ExternalLink, 
  Copy, 
  Download, 
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Briefcase,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notificationStore";

const MOCK_REFERRALS = [
  { id: "1", name: "Dewa Network", plan: "Pro", status: "active", commission: 150000, date: "2024-02-10" },
  { id: "2", name: "Indo Connect", plan: "Business", status: "active", commission: 300000, date: "2024-02-12" },
  { id: "3", name: "Nusa ISP", plan: "Pro", status: "pending", commission: 150000, date: "2024-02-15" },
  { id: "4", name: "Solo WiFi", plan: "Basic", status: "active", commission: 75000, date: "2024-02-18" },
];

export default function AffiliateDashboardPage() {
  const { showToast } = useNotificationStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Fix hydration mismatch by detecting screen size after mount
  useEffect(() => {
    setIsDesktop(window.innerWidth >= 768);
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const referralCode = "RRNET-PARTNER-88";
  const referralLink = "https://rrnet.io/register?ref=" + referralCode;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} disalin!`, "success");
  };

  const stats = [
    { label: "Total Saldo", value: "Rp 1.250.000", icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Referral Aktif", value: "12", icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Klik Link", value: "245", icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Pending Cair", value: "Rp 450.000", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col md:flex-row overflow-hidden relative">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full -z-10" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full -z-10" />

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02] backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-lg flex items-center justify-center">
            <Zap className="text-white w-5 h-5 fill-current" />
          </div>
          <span className="text-lg font-black tracking-tighter">RRNET<span className="text-purple-500">.</span>PARTNER</span>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-lg">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar - Desktop & Mobile Drawer */}
      <AnimatePresence>
        {(sidebarOpen || isDesktop) && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className={cn(
              "fixed md:relative top-0 left-0 bottom-0 w-[280px] bg-white/[0.02] backdrop-blur-3xl border-r border-white/5 p-8 flex flex-col z-50 md:z-10",
              !sidebarOpen && "hidden md:flex"
            )}
          >
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Zap className="text-white w-6 h-6 fill-current" />
                </div>
                <div>
                  <h1 className="text-lg font-black leading-none tracking-tighter">ERP<span className="text-purple-500">.</span>NET</h1>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">Affiliate Hub</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 hover:bg-white/5 rounded-lg">
                <X className="w-5 h-5 text-white/40" />
              </button>
            </div>

            <nav className="space-y-2 flex-grow">
              {[
                { id: "overview", label: "Dashboard", icon: LayoutDashboard },
                { id: "referrals", label: "My Referrals", icon: Users },
                { id: "commissions", label: "Pencairan", icon: DollarSign },
                { id: "marketing", label: "Marketing Kit", icon: Briefcase },
                { id: "settings", label: "Settings", icon: Settings },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm group relative overflow-hidden",
                    activeTab === item.id 
                      ? "bg-purple-600 text-white shadow-xl shadow-purple-600/20" 
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-white/20 group-hover:text-purple-400")} />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="pt-8 border-t border-white/5">
              <div className="bg-white/5 rounded-2xl p-4 mb-4">
                <p className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-1">Partner Tier</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-purple-400">SILVER PARTNER</span>
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                </div>
              </div>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-white/40 hover:text-red-400 hover:bg-red-400/5 transition-all font-bold text-sm group">
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-12 overflow-y-auto max-h-screen">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="text-sm font-black text-purple-500 uppercase tracking-[0.2em] mb-2">Welcome Back, Partner</h2>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Budi Santoso</h1>
          </div>
          <div className="hidden lg:flex items-center gap-4 bg-white/5 p-2 rounded-[24px] border border-white/5">
            <div className="px-4 py-2">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Balance</p>
              <p className="text-lg font-black tracking-tight">Rp 1.250.000</p>
            </div>
            <button className="bg-purple-600 hover:bg-purple-500 px-6 h-12 rounded-[18px] font-black text-sm tracking-tight transition-all shadow-lg shadow-purple-600/20">
              Tarik Saldo
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/[0.02] border border-white/5 p-4 md:p-6 rounded-[32px] hover:bg-white/[0.04] transition-all"
            >
              <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center mb-4 border border-white/5 shadow-lg", stat.bg)}>
                <stat.icon className={cn("w-5 h-5 md:w-6 md:h-6", stat.color)} />
              </div>
              <p className="text-2xl md:text-3xl font-black text-white">{stat.value}</p>
              <p className="text-[10px] md:text-xs font-bold text-white/30 uppercase tracking-widest mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Action Center - Referral Links */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="lg:col-span-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-[32px] p-6 md:p-8 relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-[80px] group-hover:bg-white/20 transition-all duration-700" />
            <div className="relative z-10">
              <h3 className="text-2xl font-black mb-4 flex items-center gap-2 italic">
                <TrendingUp className="w-6 h-6" />
                Bagi Link, Dapat Cuan!
              </h3>
              <p className="text-white/80 font-medium mb-8 max-w-lg text-sm md:text-base leading-relaxed">
                Salin link referral unik Anda dan bagikan ke calon tenant. Setiap tenant baru yang langganan, saldo Anda langsung nambah!
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                  <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-2">Referral Code</p>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-xl font-black tracking-widest">{referralCode}</span>
                    <button onClick={() => copyToClipboard(referralCode, "Kode")} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                  <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-2">Direct Link</p>
                  <div className="flex items-center justify-between gap-4">
                    <span className="truncate text-sm font-medium opacity-60 font-mono">{referralLink}</span>
                    <button onClick={() => copyToClipboard(referralLink, "Link")} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                      <Copy className="w-5 h-5 shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-8 flex flex-col justify-between">
            <div>
              <h4 className="text-lg font-black mb-4">Butuh Bantuan?</h4>
              <p className="text-sm text-white/40 font-medium leading-relaxed mb-6">
                Download panduan marketing atau hubungi support kami lewat WhatsApp khusus VIP Partner.
              </p>
            </div>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all font-bold text-sm">
                Download Marketing Kit
                <Download className="w-5 h-5 text-purple-400" />
              </button>
              <button className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all font-bold text-sm">
                Hubungi PIC Affiliate
                <ExternalLink className="w-5 h-5 text-indigo-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Recent Referrals Table */}
        <div className="bg-white/[0.01] border border-white/5 rounded-[32px] overflow-hidden">
          <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-xl font-black flex items-center gap-3">
              <Users className="w-6 h-6 text-purple-500" />
              Referral Terbaru
            </h3>
            <button className="text-sm font-black text-purple-400 hover:text-purple-300 transition-colors uppercase tracking-widest flex items-center gap-2">
              Lihat Semua
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 uppercase">
                  <th className="px-8 py-4 text-[10px] font-black text-white/20 tracking-[0.2em]">Nama Tenant</th>
                  <th className="px-8 py-4 text-[10px] font-black text-white/20 tracking-[0.2em]">Plan</th>
                  <th className="px-8 py-4 text-[10px] font-black text-white/20 tracking-[0.2em]">Estimasi Komisi</th>
                  <th className="px-8 py-4 text-[10px] font-black text-white/20 tracking-[0.2em] text-center">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black text-white/20 tracking-[0.2em] text-right">Tanggal Berlangganan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {MOCK_REFERRALS.map((ref) => (
                  <tr key={ref.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-5 font-bold text-white group-hover:text-purple-400 transition-all">{ref.name}</td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 rounded-lg bg-white/5 text-[10px] font-black uppercase border border-white/5">{ref.plan}</span>
                    </td>
                    <td className="px-8 py-5 font-black text-emerald-400">Rp {ref.commission.toLocaleString()}</td>
                    <td className="px-8 py-5">
                      <div className="flex justify-center">
                        {ref.status === 'active' ? (
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right font-medium text-white/30 text-sm tracking-tight">{ref.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
