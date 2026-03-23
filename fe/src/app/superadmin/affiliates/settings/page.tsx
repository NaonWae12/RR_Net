"use client";

import { useNotificationStore } from "@/stores/notificationStore";
import { affiliateService, AffiliateTierSettings, AffiliateCampaign } from "@/lib/api/affiliateService";
import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft,
  Settings,
  Plus,
  Save,
  Loader2,
  Calendar,
  Users,
  Target,
  Trophy,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Zap,
  LayoutGrid,
  ChevronRight,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function AffiliateCampaignsPage() {
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<AffiliateCampaign[]>([]);
  const [activeTab, setActiveTab] = useState<'strategies' | 'builder'>('strategies');
  
  // Current Builder State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AffiliateCampaign>>({
    name: "",
    description: "",
    tier_config: {
      silver: 0,
      gold: 5,
      platinum: 15,
      commission_silver: 15,
      commission_gold: 25,
      commission_platinum: 35,
      retention_months: 3
    },
    max_affiliates: 0,
    is_active: true,
    is_default: false
  });
  const [saving, setSaving] = useState(false);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const list = await affiliateService.listCampaigns();
      setCampaigns(list);
    } catch (err) {
      showToast({ title: "Gagal memuat strategi", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleEdit = (c: AffiliateCampaign) => {
    setEditingId(c.id);
    setFormData({
      ...c,
      ends_at: c.ends_at ? new Date(c.ends_at).toISOString().split('T')[0] : ""
    });
    setActiveTab('builder');
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({
      name: "",
      description: "",
      tier_config: {
        silver: 0,
        gold: 5,
        platinum: 15,
        commission_silver: 15,
        commission_gold: 25,
        commission_platinum: 35,
        retention_months: 3
      },
      max_affiliates: 0,
      is_active: true,
      is_default: false
    });
    setActiveTab('builder');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingId) {
        await affiliateService.updateCampaign(editingId, formData);
        showToast({ title: "Strategi diperbarui", variant: "success" });
      } else {
        await affiliateService.createCampaign(formData);
        showToast({ title: "Strategi baru ditambahkan", variant: "success" });
      }
      fetchCampaigns();
      setActiveTab('strategies');
    } catch (err) {
      showToast({ title: "Gagal menyimpan", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link 
            href="/superadmin/affiliates"
            className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all group"
          >
            <ArrowLeft className="w-3 h-3" />
            Kembali ke Management
          </Link>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Growth Strategies</h1>
          <p className="text-slate-500 font-medium">Orchestrate automated promotion and commission levels.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-[20px] shadow-inner">
          <button 
            onClick={() => setActiveTab('strategies')}
            className={cn(
               "px-6 py-2.5 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all",
               activeTab === 'strategies' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Active Strategies
          </button>
          <button 
            onClick={() => handleNew()}
            className={cn(
               "px-6 py-2.5 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all",
               activeTab === 'builder' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Strategy Builder
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'strategies' ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {loading ? (
              <div className="col-span-full py-32 flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Menganalisa strategi platform...</p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="col-span-full py-32 bg-white rounded-[40px] border border-dashed border-slate-200 flex flex-col items-center gap-4 text-center">
                 <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200">
                    <Target className="w-10 h-10" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase">Belum ada Campaign</h3>
                    <p className="text-slate-400 font-medium">Mulai buat strategi growth marketing lu di sini bre!</p>
                 </div>
                 <button 
                  onClick={handleNew}
                  className="mt-4 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100"
                 >
                    Create First Campaign
                 </button>
              </div>
            ) : (
              campaigns.map((c) => (
                <motion.div 
                  key={c.id}
                  layoutId={c.id}
                  className={cn(
                    "group relative bg-white p-8 rounded-[40px] border-2 transition-all hover:shadow-2xl hover:shadow-indigo-500/10",
                    c.is_default ? "border-slate-100" : c.is_active ? "border-indigo-100" : "border-slate-50 grayscale opacity-60"
                  )}
                >
                  {/* Badge */}
                  <div className="absolute top-8 right-8 flex gap-2">
                     {c.is_default && (
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                           Default Strategy
                        </span>
                     )}
                     {c.is_active ? (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
                           <Zap className="w-2 h-2 fill-emerald-600" />
                           Running
                        </span>
                     ) : (
                        <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                           Stopped
                        </span>
                     )}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{c.name}</h3>
                      <p className="text-slate-500 text-sm font-medium mt-1 leading-relaxed">{c.description}</p>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                             <Users className="w-3 h-3" /> Kuota Partner
                          </p>
                          <p className="text-lg font-black text-slate-900">
                             {c.current_affiliates_count} / {c.max_affiliates === 0 ? "∞" : c.max_affiliates}
                          </p>
                          {c.max_affiliates > 0 && (
                             <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-indigo-500" 
                                  style={{ width: `${Math.min(100, (c.current_affiliates_count / c.max_affiliates) * 100)}%` }} 
                                />
                             </div>
                          )}
                       </div>
                       <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                             <Clock className="w-3 h-3" /> Durasi Promo
                          </p>
                          <p className="text-sm font-black text-slate-900 uppercase">
                             {c.ends_at ? new Date(c.ends_at).toLocaleDateString('id-ID') : "Seterusnya"}
                          </p>
                       </div>
                    </div>

                    {/* Commision Preview */}
                    <div className="flex items-center gap-3">
                       {['Silver', 'Gold', 'Platinum'].map(tier => (
                          <div key={tier} className="flex-1 text-center py-2 border border-slate-100 rounded-xl">
                             <p className="text-[8px] font-black text-slate-400 uppercase">{tier}</p>
                             <p className="text-xs font-black text-indigo-600">{(c.tier_config as any)[`commission_${tier.toLowerCase()}`]}%</p>
                          </div>
                       ))}
                    </div>

                    <button 
                      onClick={() => handleEdit(c)}
                      className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-100"
                    >
                      Configure Strategy
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.form 
            key="builder"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleSubmit}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Left: General Info */}
            <div className="lg:col-span-2 space-y-8">
               <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm space-y-8">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 rounded-[20px] bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <LayoutGrid className="w-7 h-7" />
                     </div>
                     <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Campaign Metadata.</h2>
                        <p className="text-slate-400 text-sm font-medium">Beri identitas yang jelas untuk strategi ini.</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nama Strategi</label>
                        <input 
                           type="text" 
                           required
                           className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none"
                           placeholder="E.g. Ramadan Growth 2024"
                           value={formData.name}
                           onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Deskripsi & Catatan</label>
                        <input 
                           type="text" 
                           className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none"
                           placeholder="Jelasin dikit biar gak lupa bre..."
                           value={formData.description}
                           onChange={(e) => setFormData({...formData, description: e.target.value})}
                        />
                     </div>
                  </div>

                  {/* Automation Section */}
                  <div className="pt-8 border-t border-slate-50 space-y-8">
                     <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Platform Automation</h3>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                           <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Kuota Partner (Max)</label>
                              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg">0 = Unlimited</span>
                           </div>
                           <div className="relative">
                              <Users className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                              <input 
                                 type="number" 
                                 className="w-full bg-slate-50 border-none rounded-2xl pl-16 pr-6 py-4 font-black text-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none"
                                 value={formData.max_affiliates}
                                 onChange={(e) => setFormData({...formData, max_affiliates: parseInt(e.target.value) || 0})}
                              />
                           </div>
                           <p className="text-[10px] font-medium text-slate-400 leading-relaxed italic">Campaign akan mati otomatis jika jumlah partner tercapai.</p>
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Berakhir Pada (Deadline)</label>
                           <div className="relative">
                              <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                              <input 
                                 type="date" 
                                 className="w-full bg-slate-50 border-none rounded-2xl pl-16 pr-6 py-4 font-black text-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none appearance-none"
                                 value={formData.ends_at}
                                 onChange={(e) => setFormData({...formData, ends_at: e.target.value})}
                              />
                           </div>
                           <p className="text-[10px] font-medium text-slate-400 leading-relaxed italic">Strategi akan revert ke Default otomatis setelah tanggal ini.</p>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Tier Rule Builder */}
               <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm space-y-10">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 rounded-[20px] bg-amber-50 flex items-center justify-center text-amber-600">
                        <Trophy className="w-7 h-7" />
                     </div>
                     <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Tier Configuration.</h2>
                        <p className="text-slate-400 text-sm font-medium">Tentukan syarat naik kasta dan besaran cuan.</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     {['Silver', 'Gold', 'Platinum'].map((tier, idx) => {
                        const t = tier.toLowerCase();
                        const color = idx === 0 ? "slate" : idx === 1 ? "amber" : "indigo";
                        return (
                           <div key={tier} className={cn("p-6 rounded-[32px] border-2 space-y-6", `border-${color}-100 bg-${color}-50/30`)}>
                              <div className="flex items-center gap-2">
                                 <div className={cn("w-2 h-2 rounded-full", `bg-${color}-500`)} />
                                 <h4 className="font-black text-slate-900 uppercase tracking-tight">{tier} Rank</h4>
                              </div>
                              
                              <div className="space-y-4">
                                 <div>
                                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Min. Active Referrals</label>
                                    <input 
                                       type="number"
                                       disabled={t === 'silver'}
                                       className={cn("w-full bg-white border border-slate-100 rounded-xl p-3 font-black text-slate-900 focus:outline-none focus:ring-2 transition-all", t === 'silver' ? "opacity-50 cursor-not-allowed" : `focus:ring-${color}-500/20`)}
                                       value={(formData.tier_config as any)[t]}
                                       onChange={(e) => {
                                          const config = {...(formData.tier_config as any)};
                                          config[t] = parseInt(e.target.value) || 0;
                                          setFormData({...formData, tier_config: config});
                                       }}
                                    />
                                 </div>
                                 <div>
                                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Komisi Invoice (%)</label>
                                    <div className="relative">
                                       <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>
                                       <input 
                                          type="number"
                                          step="0.01"
                                          className="w-full bg-white border border-slate-100 rounded-xl p-3 font-black text-slate-900 focus:outline-none focus:ring-2 transition-all"
                                          value={(formData.tier_config as any)[`commission_${t}`]}
                                          onChange={(e) => {
                                             const config = {...(formData.tier_config as any)};
                                             config[`commission_${t}`] = parseFloat(e.target.value) || 0;
                                             setFormData({...formData, tier_config: config});
                                          }}
                                       />
                                    </div>
                                 </div>
                              </div>
                           </div>
                        );
                     })}
                  </div>

                  <div className="bg-slate-900 rounded-[32px] p-8 text-white flex items-center justify-between gap-8 group overflow-hidden relative">
                     <Clock className="absolute right-0 bottom-0 w-32 h-32 text-white/5 -mb-10 -mr-10 group-hover:scale-110 transition-transform duration-500" />
                     <div className="relative z-10 space-y-1">
                        <h4 className="text-lg font-black uppercase italic tracking-widest flex items-center gap-2">
                           <ShieldCheck className="w-5 h-5 text-indigo-400" />
                           Grace Period Protection.
                        </h4>
                        <p className="text-slate-400 text-xs font-medium max-w-sm">
                           Durasi rank dipertahankan (bulan) jika sisa mitra aktif turun di bawah syarat minimum.
                        </p>
                     </div>
                     <div className="relative z-10 flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl">
                        <input 
                           type="number" 
                           className="bg-transparent text-white text-3xl font-black w-20 text-center focus:outline-none"
                           value={formData.tier_config?.retention_months || 0}
                           onChange={(e) => {
                              const config = {...(formData.tier_config as any)};
                              config.retention_months = parseInt(e.target.value) || 0;
                              setFormData({...formData, tier_config: config});
                           }}
                        />
                        <span className="text-[10px] font-black uppercase text-indigo-300">Bulan</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Right: Actions & Summary */}
            <div className="space-y-6">
               <div className="sticky top-8 space-y-6">
                  <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
                     <div className="space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Status Strategi</h3>
                        <div className="flex gap-2">
                           <button 
                              type="button"
                              onClick={() => setFormData({...formData, is_active: true})}
                              className={cn(
                                 "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                                 formData.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                              )}
                           >
                              <CheckCircle2 className="w-4 h-4" /> Active
                           </button>
                           <button 
                              type="button"
                              onClick={() => setFormData({...formData, is_active: false})}
                              className={cn(
                                 "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                                 !formData.is_active ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"
                              )}
                           >
                              <AlertTriangle className="w-4 h-4" /> Paused
                           </button>
                        </div>
                     </div>

                     <div className="pt-6 border-t border-slate-50 space-y-4">
                        <button 
                           type="submit"
                           disabled={saving}
                           className="w-full bg-indigo-600 text-white rounded-[24px] py-4 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                        >
                           {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                           Save Strategy
                        </button>
                        <button 
                           type="button"
                           onClick={() => setActiveTab('strategies')}
                           className="w-full bg-slate-50 text-slate-400 rounded-2xl py-4 font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all"
                        >
                           Batalkan Perubahan
                        </button>
                     </div>
                  </div>

                  <div className="bg-amber-50 p-8 rounded-[40px] border border-amber-100 space-y-4">
                     <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-amber-500 shadow-sm shadow-amber-200">
                        <AlertTriangle className="w-5 h-5" />
                     </div>
                     <p className="text-xs font-bold text-amber-700 leading-relaxed italic">
                        "Peringatan bre: Strategi yang baru lu Save bakal langsung ngerubah aturan main platform kalau dia status-nya Active. Tenang, affiliator lama bakal tetep ke-link ke campaign pas mereka daftar, tapi itungan Rank global bakal ngikutin config terbaru."
                     </p>
                  </div>
               </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
