"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  Wallet, 
  TrendingUp, 
  Zap, 
  Copy, 
  ChevronRight, 
  History, 
  Loader2, 
  Star, 
  Info,
  Gift,
  ArrowRight,
  ShieldCheck,
  Award,
  Clock
} from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { useNotificationStore } from "@/stores/notificationStore";
import { affiliateService, AffiliateDashboardData, AffiliateTierSettings } from "@/lib/api/affiliateService";
import { useAuth } from "@/lib/hooks/useAuth";

export default function AffiliateDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AffiliateDashboardData | null>(null);
  const [settings, setSettings] = useState<AffiliateTierSettings | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const [dashRes, settingsRes] = await Promise.all([
          affiliateService.getDashboard(),
          affiliateService.getSettings()
        ]);
        setData(dashRes);
        setSettings(settingsRes);
      } catch (err) {
        console.error("Failed to fetch dashboard:", err);
        showToast({ title: "Gagal memuat data", variant: "error" });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const getTierProgress = () => {
    if (!data?.affiliate || !settings) return null;
    
    const count = data.affiliate.referred_count;
    const tier = data.affiliate.tier.toLowerCase();
    
    let nextTier = "";
    let threshold = 0;
    let nextCommission = 0;

    if (tier === "silver") {
      nextTier = "Gold";
      threshold = settings.gold;
      nextCommission = settings.commission_gold;
    } else if (tier === "gold") {
      nextTier = "Platinum";
      threshold = settings.platinum;
      nextCommission = settings.commission_platinum;
    } else {
      return { isMax: true };
    }

    const remaining = Math.max(0, threshold - count);
    const percentage = Math.min(100, (count / threshold) * 100);

    return {
      nextTier,
      threshold,
      remaining,
      percentage,
      nextCommission,
      isMax: false
    };
  };

  const progress = getTierProgress();

  const StatCard = ({ label, value, icon: Icon, color, trend }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all group"
    >
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", 
        color === "indigo" ? "bg-indigo-50 text-indigo-600" : 
        color === "emerald" ? "bg-emerald-50 text-emerald-600" : 
        color === "amber" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600")}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-900">{loading ? "..." : value}</p>
        {trend && (
           <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {trend}
           </p>
        )}
      </div>
    </motion.div>
  );

  return (
    <main className="max-w-7xl mx-auto py-10 px-6 space-y-10">
      
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
            Selamat datang kembali, <span className="text-indigo-600">{user?.name || 'Partner'}!</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg max-w-2xl">
            Pantau pertumbuhan jaringan Anda di sini. Fokus sebar kode dan biarkan sistem kami menghitung cuan Anda.
          </p>
        </div>
        <div className="flex flex-col gap-4">
           {data?.affiliate?.tier && (
              <div className="flex flex-col items-end gap-2">
                 <div className="flex items-center gap-3 px-6 py-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl self-start md:self-auto">
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                       <Star className="w-4 h-4 fill-white" />
                    </div>
                    <div className="text-left">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Status Tier</p>
                       <p className="text-sm font-black text-white uppercase italic tracking-tight">{data.affiliate.tier} Partner</p>
                    </div>
                 </div>
                 {data.affiliate.tier_expires_at && (
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 animate-pulse">
                       <Clock className="w-3.5 h-3.5" />
                       <span className="text-[10px] font-black uppercase tracking-widest">
                          Grace Period s/d {new Date(data.affiliate.tier_expires_at).toLocaleDateString()}
                       </span>
                    </div>
                 )}
              </div>
           )}
        </div>
      </section>

      {/* Main Stats Grid */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            label="Total Saldo" 
            value={formatCurrency(data?.stats?.wallet_balance || 0)} 
            icon={Wallet} 
            color="indigo" 
            trend="+12% bulan ini"
          />
          <StatCard 
            label="Mitra Aktif" 
            value={(data?.stats?.referred_count || 0).toString()} 
            icon={Users} 
            color="emerald" 
          />
          <StatCard 
            label="Total Pendapatan" 
            value={formatCurrency(data?.stats?.total_earnings || 0)} 
            icon={TrendingUp} 
            color="amber" 
          />
          <StatCard 
            label="Kode Referral" 
            value={data?.affiliate?.code || "---"} 
            icon={Zap} 
            color="rose" 
          />
        </div>

        {/* Tier Progress Section - THE BROKEN PART FETCHED BACK */}
        {!loading && progress && !progress.isMax && (
           <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm relative overflow-hidden group"
           >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                 <Award className="w-32 h-32 text-indigo-600" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                 <div className="w-full md:w-1/3">
                    <div className="flex items-center justify-between mb-3">
                       <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                          {data?.affiliate?.tier_expires_at ? "Pertahankan Rank" : `Target Level ${progress.nextTier}`}
                       </p>
                       <p className="text-sm font-black text-indigo-600">{data?.affiliate?.referred_count} / {progress.threshold}</p>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                       <motion.div 
                          className={cn("h-full rounded-full shadow-sm", data?.affiliate?.tier_expires_at ? "bg-amber-500" : "bg-indigo-600")}
                          initial={{ width: 0 }}
                          animate={{ width: `${progress.percentage}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                       />
                    </div>
                 </div>
                 <div className="flex-1">
                    <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                       {data?.affiliate?.tier_expires_at ? (
                          `Status ${data.affiliate.tier} Anda sedang dalam masa tenggang. Ajak ${progress.remaining} mitra lagi sebelum ${new Date(data.affiliate.tier_expires_at).toLocaleDateString()} untuk mempertahankan komisi Anda!`
                       ) : (
                          `Referral aktif Anda saat ini adalah ${data?.affiliate?.referred_count} mitra. Ayo semangat tingkatkan promosi Anda! Cukup ajak ${progress.remaining} mitra lagi untuk naik level dan nikmati komisi ${progress.nextCommission}% (${progress.nextTier}).`
                       )}
                    </p>
                 </div>
              </div>
           </motion.div>
        )}

        {/* Action Center - Simplified for Codes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[40px] p-8 md:p-10 text-white relative overflow-hidden group shadow-2xl">
            <Zap className="absolute right-0 bottom-0 w-80 h-80 text-white/5 -mb-20 -mr-20 group-hover:scale-110 transition-transform duration-700" />
            
            <div className="relative z-10 space-y-8">
              <div>
                <h3 className="text-3xl font-black mb-4 flex items-center gap-3 italic uppercase tracking-tighter text-white">
                  <Gift className="w-10 h-10 text-indigo-400" />
                  Satu Kode, Ribuan Peluang!
                </h3>
                <p className="text-indigo-200/80 font-medium max-w-lg text-base leading-relaxed">
                  Berikan kode Anda ke calon mitra. Saat mereka mendaftar dan mulai berlangganan, komisi otomatis masuk ke wallet Anda hingga <span className="text-white font-black underline decoration-indigo-500/50">4x periode pembayaran!</span>
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-[24px] p-6 backdrop-blur-md">
                   <p className="text-[10px] font-black uppercase text-indigo-300 tracking-widest mb-3">Copy & Share Kode Anda</p>
                   <div className="flex items-center justify-between">
                      <code className="text-3xl font-black tracking-[0.2em] text-white underline decoration-indigo-500/30">{data?.affiliate?.code || "------"}</code>
                      <button 
                        onClick={() => {
                          const code = data?.affiliate?.code || "";
                          navigator.clipboard.writeText(code);
                          showToast({ title: "Kode disalin ke clipboard", variant: "success" });
                        }}
                        className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-indigo-400 transition-all border border-white/5"
                      >
                         <Copy className="w-6 h-6" />
                      </button>
                   </div>
                </div>
                
                <button 
                  onClick={() => {
                    const text = `Halo! Yuk gunain RR-Net buat manajemen ISP kamu. Pake kode referral saya: ${data?.affiliate?.code} pas daftar ya biar dapet privilege khusus!`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                  }}
                  className="flex-shrink-0 px-10 py-6 bg-indigo-500 hover:bg-indigo-400 text-white rounded-[24px] font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-indigo-950/50 flex items-center gap-3 self-center sm:self-auto"
                >
                   Bagikan ke WhatsApp <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[40px] p-8 flex flex-col justify-between shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-125 transition-transform duration-1000">
                <TrendingUp className="w-48 h-48" />
             </div>
             
             <div>
                <h4 className="text-xl font-black uppercase italic tracking-tight mb-4 flex items-center gap-2">
                   <Info className="w-5 h-5 text-indigo-600" />
                   Edukasi Cepat.
                </h4>
                <div className="space-y-4 relative z-10">
                   {[
                      { icon: ShieldCheck, text: "Pastikan mitra memasukkan kode saat registrasi." },
                      { icon: Zap, text: "Cek detail komisi di halaman Mitra Saya." },
                      { icon: Wallet, text: "Tarik dana kapan saja setelah saldo min. 100k." }
                   ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4">
                         <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                            <item.icon className="w-4 h-4 text-slate-400" />
                         </div>
                         <p className="text-xs font-bold text-slate-500 leading-relaxed">{item.text}</p>
                      </div>
                   ))}
                </div>
             </div>

             <div className="mt-8 pt-8 border-t border-slate-100 italic">
                <Link 
                   href="/affiliate/dashboard/referrals" 
                   className="w-full py-4 bg-slate-50 hover:bg-slate-100 transition-all rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest text-slate-600 border border-slate-100"
                >
                   Lihat Perkembangan <ChevronRight className="w-4 h-4" />
                </Link>
             </div>
          </div>
        </div>
      </section>

      {/* Recent Activity Table */}
      <section className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
              <History className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900">Pendaftaran Terbaru</h3>
          </div>
          <Link href="/affiliate/dashboard/referrals" className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline decoration-2 underline-offset-4 decoration-indigo-600/30">
             Lihat Semua Mitra
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4">Mitra (Perusahaan)</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Paket</th>
                <th className="px-8 py-4 text-right">Tanggal Gabung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                 <tr>
                    <td colSpan={4} className="px-8 py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" /></td>
                 </tr>
              ) : !data?.referrals || data.referrals.length === 0 ? (
                 <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-bold italic uppercase tracking-widest text-xs">Belum ada mitra yang terdaftar.</td>
                 </tr>
              ) : data.referrals.slice(0, 5).map((ref, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <p className="font-black text-slate-900">{ref.company_name || ref.tenant_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{ref.tenant_name}</p>
                  </td>
                  <td className="px-8 py-5">
                    {ref.status === 'active' ? (
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-widest">Aktif</span>
                    ) : (
                      <span className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[10px] font-black uppercase tracking-widest">Pending</span>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-xs font-black text-slate-600 uppercase">{ref.plan_name}</p>
                  </td>
                  <td className="px-8 py-5 text-right font-medium text-slate-400 text-sm">
                    {new Date(ref.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      
    </main>
  );
}
