"use client";

import { useNotificationStore } from "@/stores/notificationStore";
import { affiliateService, Affiliate } from "@/lib/api/affiliateService";
import { useEffect, useState } from "react";

import { 
  Users, 
  Search, 
  Filter, 
  MoreHorizontal, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  DollarSign,
  ExternalLink,
  Plus,
  Loader2,
  Trophy,
  ShieldCheck,
  Eye,
  User,
  MapPin,
  Building2,
  Phone,
  Mail,
  Zap,
  Settings,
  X,
  LayoutGrid,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { AffiliateDashboardData } from "@/lib/api/affiliateService";

export default function AffiliatesManagementPage() {
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [statsData, setStatsData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  
  // Detail Modal State
  const [selectedAffiliate, setSelectedAffiliate] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<AffiliateDashboardData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleShowDetail = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedAffiliate(id);
    try {
      setLoadingDetail(true);
      const data = await affiliateService.getDetail(id);
      setDetailData(data);
    } catch (err) {
      console.error("Affiliate Detail Fetch Error:", err);
      showToast({ title: "Gagal memuat detail", variant: "error" });
      setSelectedAffiliate(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [list, stats] = await Promise.all([
        affiliateService.listAll(),
        affiliateService.getGlobalStats()
      ]);
      setAffiliates(list);
      setStatsData(stats);
    } catch (err) {
      showToast({ title: "Gagal memuat data", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await affiliateService.updateStatus(id, newStatus);
      showToast({ title: "Status diperbarui", variant: "success" });
      fetchData();
    } catch (err) {
      showToast({ title: "Gagal memperbarui status", variant: "error" });
    }
  };


  const stats = [
    { label: "Total Partners", value: statsData?.total_partners || "0", icon: Users, color: "bg-blue-500", trend: "Total terdaftar" },
    { label: "Active Referrals", value: statsData?.total_referrals || "0", icon: TrendingUp, color: "bg-purple-500", trend: "Total konversi" },
    { label: "Total Earnings", value: `Rp ${(statsData?.total_payouts || 0).toLocaleString()}`, icon: DollarSign, color: "bg-emerald-500", trend: "Akumulasi komisi" },
    { label: "Pending Review", value: statsData?.pending_review || "0", icon: Clock, color: "bg-amber-500", trend: "Menunggu moderasi" },
  ];

  const filteredAffiliates = (affiliates || []).filter(aff => 
    (aff.name || "").toLowerCase().includes(search.toLowerCase()) || 
    (aff.email || "").toLowerCase().includes(search.toLowerCase())
  ).filter(aff => filter === "all" || aff.status === filter);

  return (
    <>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Affiliate Program</h1>
          <p className="text-slate-500 font-medium mt-1">Manage partners, commissions, and payout requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/superadmin/affiliates/settings"
            className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Settings className="w-5 h-5 text-slate-400" />
            Growth Strategies
          </Link>
          <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
            <Plus className="w-5 h-5" />
            Add Partner
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[32px] border border-slate-100/20 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.trend}</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-tight">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-[32px] border border-slate-100/20 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative group flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search partner name or email..."
              className="w-full bg-slate-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600/10 transition-all outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-50 p-1 rounded-xl">
              {['all', 'active', 'pending'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                    filter === t ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <button className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/60">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Partner Info</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Referrals</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Joined</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Memuat data mitra...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredAffiliates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-sm">
                    Tidak ada data mitra ditemukan
                  </td>
                </tr>
              ) : (
                filteredAffiliates.map((aff) => (
                  <tr key={aff.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400">
                        {aff.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{aff.name}</p>
                        <p className="text-xs text-slate-400 font-medium">{aff.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-900 text-xs font-bold border border-slate-200">
                      <ExternalLink className="w-3 h-3" />
                      {aff.total_referrals}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-black text-slate-900">
                    Rp {(aff.wallet_balance || 0).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-center">
                    {aff.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-slate-400">
                    {new Date(aff.created_at).toLocaleDateString('id-ID')}
                  </td>
                   <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                       {aff.status === 'pending' && (
                         <button 
                           onClick={() => handleUpdateStatus(aff.id, 'active')}
                           className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                         >
                           Verify
                         </button>
                       )}
                      <button 
                        onClick={(e) => handleShowDetail(e, aff.id)}
                        className="p-2 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                        title="View Detail"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-all">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-8 border-t border-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-bold">Showing {filteredAffiliates.length} of {affiliates.length} partners</p>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-xl border border-slate-100 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
            <button className="px-4 py-2 rounded-xl border border-slate-100 text-xs font-bold text-slate-500 hover:bg-slate-50">Next</button>
          </div>
        </div>
      </div>
    </div>
      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAffiliate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Partner Dossier.</h2>
                    <p className="text-slate-400 text-sm font-medium">Deep-dive into affiliate performance and history.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedAffiliate(null);
                    setDetailData(null);
                  }}
                  className="p-3 hover:bg-slate-100 rounded-2xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                {loadingDetail ? (
                  <div className="py-32 flex flex-col items-center gap-4 text-center">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Compiling performance data...</p>
                  </div>
                ) : detailData ? (
                  <>
                    {/* Top Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                       <div className="p-6 bg-slate-50 rounded-[32px] space-y-2 border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Rank</p>
                          <div className="flex items-center gap-2">
                             <div className={cn(
                                "w-2 h-2 rounded-full",
                                detailData.affiliate.tier === 'silver' ? "bg-slate-400" :
                                detailData.affiliate.tier === 'gold' ? "bg-amber-400" : "bg-indigo-500"
                             )} />
                             <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">{detailData.affiliate.tier}</h4>
                          </div>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-[32px] space-y-2 border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wallet Balance</p>
                          <h4 className="text-xl font-black text-slate-900 tracking-tight">Rp {(detailData.stats.wallet_balance || 0).toLocaleString()}</h4>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-[32px] space-y-2 border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Earnings</p>
                          <h4 className="text-xl font-black text-slate-900 tracking-tight">Rp {(detailData.stats.total_earnings || 0).toLocaleString()}</h4>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-[32px] space-y-2 border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Referrals</p>
                          <h4 className="text-xl font-black text-slate-900 tracking-tight">{detailData.stats.referred_count} Partners</h4>
                       </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                       <div className="space-y-6">
                          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                             <Zap className="w-4 h-4 text-indigo-500" /> Profil Information
                          </h3>
                          <div className="space-y-4">
                             {[
                                { label: "Referral Code", value: detailData.affiliate.code, icon: Zap },
                                { label: "Account ID", value: detailData.affiliate.user_id, icon: Mail },
                                { label: "Joined Date", value: new Date(detailData.affiliate.created_at).toLocaleDateString('id-ID'), icon: Clock },
                             ].map((item, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl">
                                   <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                      <item.icon className="w-5 h-5" />
                                   </div>
                                   <div>
                                      <p className="text-[9px] font-black text-slate-400 uppercase">{item.label}</p>
                                      <p className="text-sm font-bold text-slate-900">{item.value}</p>
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>

                       <div className="space-y-6">
                          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                             <TrendingUp className="w-4 h-4 text-emerald-500" /> Referral Growth
                          </h3>
                          <div className="bg-slate-50 rounded-[32px] p-6 text-center space-y-2">
                             <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                                <Users className="w-8 h-8 text-indigo-600" />
                             </div>
                             <h4 className="text-2xl font-black text-slate-900 tracking-tight">{detailData.referrals.length}</h4>
                             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Aktif menjaring tenant baru di platform kita bre.</p>
                          </div>
                       </div>
                    </div>

                    {/* Referrals Table */}
                    <div className="space-y-6">
                       <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                          <LayoutGrid className="w-4 h-4 text-slate-400" /> Referral Logs
                       </h3>
                       <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden">
                          <table className="w-full text-left">
                             <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                   <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Tenant Name</th>
                                   <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Status</th>
                                   <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Invoice Claims</th>
                                   <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Commission</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-50">
                                {detailData.referrals.length === 0 ? (
                                   <tr>
                                      <td colSpan={4} className="px-6 py-10 text-center text-xs font-bold text-slate-400 uppercase tracking-widest italic">Belum ada referral tercatat bre.</td>
                                   </tr>
                                ) : (
                                   detailData.referrals.map((ref: any) => (
                                      <tr key={ref.id} className="hover:bg-slate-50 transition-all">
                                         <td className="px-6 py-4">
                                            <p className="text-xs font-black text-slate-900">{ref.tenant_name}</p>
                                            <p className="text-[10px] text-slate-400 font-medium italic">{ref.company_name}</p>
                                         </td>
                                         <td className="px-6 py-4">
                                            <span className={cn(
                                               "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                                               ref.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                                            )}>
                                               {ref.status}
                                            </span>
                                         </td>
                                         <td className="px-6 py-4 font-black text-slate-900 text-xs">
                                            {ref.commission_count} / 4
                                         </td>
                                         <td className="px-6 py-4 text-right">
                                            <p className="text-xs font-black text-indigo-600">{ref.commission_percentage}%</p>
                                         </td>
                                      </tr>
                                   ))
                                )}
                             </tbody>
                          </table>
                       </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                 <button 
                  onClick={() => {
                    setSelectedAffiliate(null);
                    setDetailData(null);
                  }}
                  className="px-8 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                 >
                    Close Dossier
                 </button>
                 <button className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-100">
                    Contact Partner
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
