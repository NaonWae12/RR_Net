"use client";

import { motion } from "framer-motion";
import { 
  DollarSign, 
  ShieldCheck, 
  Trophy, 
  Zap, 
  Info, 
  HelpCircle, 
  TrendingUp, 
  ArrowRight,
  Calculator,
  AlertCircle,
  Loader2,
  Gift
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { affiliateService, AffiliateTierSettings } from "@/lib/api/affiliateService";
import { superAdminService } from "@/lib/api/superAdminService";
import apiClient from "@/lib/api/apiClient";
import { Plan, LandingPagePricing } from "@/lib/api/types";

export default function CommissionSchemePage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AffiliateTierSettings | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isYearly, setIsYearly] = useState(false);
  const [config, setConfig] = useState<LandingPagePricing | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [s, p, cRes] = await Promise.all([
          affiliateService.getSettings(),
          affiliateService.getPublicPlans(),
          apiClient.get('/public/site-settings/pricing').catch(() => ({ data: null }))
        ]);
        setSettings(s);
        setPlans(p.filter(plan => plan.is_active));
        if (cRes?.data) setConfig(cRes.data);
      } catch (err) {
        console.error("Failed to fetch commission scheme data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const tiers = [
    { 
      name: "Silver Partner", 
      icon: ShieldCheck, 
      commission: settings?.commission_silver || 15, 
      require: `0 - ${settings?.gold ? settings.gold - 1 : 4} Referral Aktif`, 
      color: "text-slate-400", 
      bg: "bg-slate-50",
      border: "border-slate-200"
    },
    { 
      name: "Gold Partner", 
      icon: Trophy, 
      commission: settings?.commission_gold || 25, 
      require: `${settings?.gold || 5} - ${settings?.platinum ? settings.platinum - 1 : 14} Referral Aktif`, 
      color: "text-amber-500", 
      bg: "bg-amber-50",
      border: "border-amber-200"
    },
    { 
      name: "Platinum Partner", 
      icon: Zap, 
      commission: settings?.commission_platinum || 35, 
      require: `${settings?.platinum || 15}+ Referral Aktif`, 
      color: "text-indigo-600", 
      bg: "bg-indigo-50",
      border: "border-indigo-200"
    },
  ];

  const formatCurrency = (value: number) => {
    return "Rp " + Math.floor(value).toLocaleString("id-ID");
  };

  const calculateCommissionNumber = (price: number, percentage: number) => {
    return (price * percentage) / 100;
  };

  const calculateCommission = (price: number, percentage: number) => {
    return formatCurrency(calculateCommissionNumber(price, percentage));
  };

  const planDiscount = config?.yearly_discount ?? 20;

  const examples = plans.slice(0, 3).map(plan => {
    const activePrice = isYearly 
      ? (plan.price_yearly || plan.price_monthly * 12 * (1 - planDiscount / 100)) 
      : plan.price_monthly;
    return {
      label: `${plan.name} (${formatCurrency(activePrice)})`,
      silver: calculateCommission(activePrice, settings?.commission_silver || 15),
      gold: calculateCommission(activePrice, settings?.commission_gold || 25),
      platinum: calculateCommission(activePrice, settings?.commission_platinum || 35)
    };
  });

  // If no plans found, use some defaults
  const displayExamples = examples.length > 0 ? examples : [
    { label: `Paket Basic (${formatCurrency(isYearly ? 150000 * 12 * (1 - planDiscount / 100) : 150000)})`, silver: formatCurrency((isYearly ? 150000 * 12 * (1 - planDiscount / 100) : 150000) * 0.15), gold: formatCurrency((isYearly ? 150000 * 12 * (1 - planDiscount / 100) : 150000) * 0.25), platinum: formatCurrency((isYearly ? 150000 * 12 * (1 - planDiscount / 100) : 150000) * 0.35) },
    { label: `Paket Pro (${formatCurrency(isYearly ? 300000 * 12 * (1 - planDiscount / 100) : 300000)})`, silver: formatCurrency((isYearly ? 300000 * 12 * (1 - planDiscount / 100) : 300000) * 0.15), gold: formatCurrency((isYearly ? 300000 * 12 * (1 - planDiscount / 100) : 300000) * 0.25), platinum: formatCurrency((isYearly ? 300000 * 12 * (1 - planDiscount / 100) : 300000) * 0.35) },
    { label: `Paket Business (${formatCurrency(isYearly ? 500000 * 12 * (1 - planDiscount / 100) : 500000)})`, silver: formatCurrency((isYearly ? 500000 * 12 * (1 - planDiscount / 100) : 500000) * 0.15), gold: formatCurrency((isYearly ? 500000 * 12 * (1 - planDiscount / 100) : 500000) * 0.25), platinum: formatCurrency((isYearly ? 500000 * 12 * (1 - planDiscount / 100) : 500000) * 0.35) },
  ];

  const rules = [
    { title: "Komisi Berkali-kali (Max 4x)", desc: "Dari 1 mitra yang Anda ajak, Anda bisa mendapat komisi berulang hingga 4 kali pembayaran bulanan berturut-turut selama mereka masih berlangganan." },
    { title: "Daya Tarik Diskon 10%", desc: "Mitra yang mendaftar menggunakan kode referral Anda otomatis meraup diskon 10% di tagihan pertamanya. Andalan paling jitu buat bahan promosi!" },
    { title: "Wajib Jaga Retensi", desc: "Komisi hanya didapat selama layanan mitra aktif. Jika mitra berhenti berlangganan di bulan ke-2, komisi Anda ikut berhenti. Edukasi mitra Anda untuk memoles performa layanan mereka!" },
    { title: "Proses Pencairan", desc: "Komisi masuk otomatis ke dompet afiliasi Anda 24 jam setelah invoice mitra berstatus lunas. Pencairan uang (withdrawal) berbatas waktu tahan saldo selama 28 hari demi menjaga stabilitas (refund grace period)." },
  ];

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="mb-12">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4 text-slate-900">
          Skema <span className="text-indigo-600">Komisi Partner.</span>
        </h2>
        <p className="text-slate-500 font-medium text-lg max-w-2xl">
          Panduan lengkap perhitungan pendapatan Anda sebagai partner resmi RRNET. Transparan, adil, dan menguntungkan.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {tiers.map((tier, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "p-8 rounded-[36px] border group hover:shadow-2xl transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden",
              tier.bg, tier.border
            )}
          >
            <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-sm border bg-white", tier.color)}>
              <tier.icon className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-black uppercase italic tracking-tight text-slate-900 mb-2">{tier.name}</h4>
            <div className="text-4xl font-black text-slate-900 mb-6">{tier.commission}% <span className="text-sm text-slate-400 font-medium">/ bulan</span></div>
            <div className="px-6 py-2 rounded-2xl bg-white border border-slate-100 text-xs font-black uppercase tracking-widest text-slate-500">
              {tier.require}
            </div>
            
            <div className="absolute -bottom-6 -right-6 opacity-5 group-hover:scale-110 transition-transform">
               <tier.icon className="w-24 h-24" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="bg-white border text-slate-700 border-slate-200 p-10 rounded-[40px] shadow-sm mb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Calculator className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tight">Ilustrasi Pendapatan</h3>
            </div>
            
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200">
              <button 
                onClick={() => setIsYearly(false)}
                className={cn("px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all", !isYearly ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                Bulanan
              </button>
              <button 
                onClick={() => setIsYearly(true)}
                className={cn("px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all", isYearly ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                Tahunan
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-100">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Produk / Layanan</th>
                  <th className="px-6 py-4">Silver</th>
                  <th className="px-6 py-4">Gold</th>
                  <th className="px-6 py-4">Platinum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                   <tr>
                     <td colSpan={4} className="px-6 py-10 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                     </td>
                   </tr>
                ) : displayExamples.map((ex, i) => (
                  <tr key={i} className="text-sm font-bold text-slate-600">
                    <td className="px-6 py-5 text-slate-900">{ex.label}</td>
                    <td className="px-6 py-5">{ex.silver}</td>
                    <td className="px-6 py-5">{ex.gold}</td>
                    <td className="px-6 py-5 font-black text-indigo-600">{ex.platinum}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-10 p-6 bg-indigo-600 rounded-3xl text-white relative overflow-hidden group">
             <div className="absolute right-0 top-0 p-4 opacity-10">
                <Gift className="w-16 h-16" />
             </div>
             <p className="text-xs font-black uppercase tracking-widest text-indigo-200 mb-2">Passive Income Real</p>
             <h4 className="text-xl font-black italic tracking-tight leading-snug">
               Bayangkan punya 50 mitra paket Pro dengan tier Gold. Anda bisa raih pendapatan bersih {(() => {
                 const proPlan = plans.find(p => p.name.toLowerCase().includes("pro"));
                 const basePrice = isYearly ? (proPlan?.price_yearly || (proPlan?.price_monthly || 300000) * 12 * (1 - planDiscount / 100)) : (proPlan?.price_monthly || 300000);
                 return formatCurrency(calculateCommissionNumber(basePrice, settings?.commission_gold || 25) * 50);
               })()} tiap {isYearly ? "tahun" : "bulan"}!
             </h4>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
              <Info className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tight">Aturan & Syarat</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rules.map((rule, i) => (
              <div key={i} className="bg-white border border-slate-200 p-6 rounded-[28px] hover:border-indigo-100 transition-all">
                <h5 className="font-black text-slate-900 uppercase italic text-sm mb-2">{rule.title}</h5>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">{rule.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 p-8 rounded-[32px] flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-1" />
            <div>
              <h5 className="font-black text-amber-900 uppercase italic text-sm mb-1">Catatan Penting</h5>
              <div className="space-y-3">
                <p className="text-xs text-amber-700/80 leading-relaxed font-medium">
                  • Penyalahgunaan sistem (self-referral atau penipuan data) akan menyebabkan penonaktifan akun secara permanen tanpa kompensasi saldo. Pastikan promosi dilakukan secara profesional.
                </p>
                <p className="text-xs text-amber-700/80 leading-relaxed font-medium">
                  • Untuk terus menjaga ekosistem kemitraan yang sehat dan menyesuaikan dengan dinamika nilai bisnis, RRNET dari waktu ke waktu dapat melakukan penyesuaian pada struktur komisi (seperti persentase, batas maksimal pencairan, hingga target tier). Penyesuaian ini akan selalu diberitahukan dan diperbarui secara transparan di halaman ini.
                </p>
              </div>
            </div>
          </div>
          
          <div className="pt-4">
             <button className="w-full flex items-center justify-between px-8 py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 transition-all font-black text-white uppercase tracking-[0.1em] shadow-xl shadow-indigo-200">
                Mulai Bagikan Referral
                <ArrowRight className="w-5 h-5" />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
