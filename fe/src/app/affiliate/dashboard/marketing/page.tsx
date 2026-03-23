"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Copy, Share2, Briefcase, FileText, Image as ImageIcon, Zap, Loader2 } from "lucide-react";
import { affiliateService } from "@/lib/api/affiliateService";
import { useNotificationStore } from "@/stores/notificationStore";

export default function MarketingPage() {
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");

  useEffect(() => {
    const fetchCode = async () => {
      try {
        setLoading(true);
        const res = await affiliateService.getDashboard();
        setCode(res.affiliate.code);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCode();
  }, []);

  const assets = [
    { type: "Banner", title: "Promo Berlangganan 10% Diskon", desc: "Cocok untuk posting di Instagram atau Facebook Ads.", icon: ImageIcon },
    { type: "Copywriting", title: "Pesan WhatsApp Broadcast", desc: "Template teks optimasi untuk menyapa prospek client ISP lokal.", icon: FileText },
    { type: "PDF", title: "Company Profile Lengkap", desc: "Slide penawaran B2B untuk diberikan langsung ke atasan target Anda.", icon: Download },
  ];

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    showToast({ title: "Kode berhasil disalin", variant: "success" });
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="mb-12">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4 text-slate-900">
          Materi <span className="text-indigo-600">Promosi.</span>
        </h2>
        <p className="text-slate-500 font-medium text-lg max-w-2xl">
          Unduh aset promosi resmi dari RRNET, salin template pesan, atau pelajari 
          strategi *close selling* yang telah terbukti menghasilkan ratusan mitra aktif.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {assets.map((asset, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="group relative bg-white border border-slate-200 rounded-[32px] p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-start"
          >
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
              <asset.icon className="w-7 h-7" />
            </div>
            <div className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 border border-slate-200">
              {asset.type}
            </div>
            <h4 className="text-xl font-bold tracking-tight text-slate-900 mb-3 leading-snug">
              {asset.title}
            </h4>
            <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8 flex-1">
              {asset.desc}
            </p>
            
            <div className="w-full grid grid-cols-2 gap-3 mt-auto">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors rounded-xl text-xs font-black uppercase tracking-widest text-slate-600">
                <Copy className="w-4 h-4" /> Salin
              </button>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-colors rounded-xl text-xs font-black uppercase tracking-widest text-indigo-600">
                <Download className="w-4 h-4" /> Unduh
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-16 bg-slate-900 rounded-[40px] p-10 md:p-16 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03]">
           <Zap className="w-96 h-96 -rotate-12" />
        </div>
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-6 border border-indigo-500/30">
            Identitas Unik Anda
          </div>
          <h3 className="text-3xl font-black text-white italic tracking-tighter mb-4">
            Gunakan Kode Referral.
          </h3>
          <p className="text-slate-400 font-medium leading-relaxed mb-8">
            Berikan kode unik Anda di bawah ini kepada calon mitra. Jangan lupa lampirkan materi promosi di atas agar penawaran Anda terlihat lebih profesional!
          </p>
          
          <div className="flex bg-slate-800 rounded-2xl border border-slate-700/50 overflow-hidden shadow-inner max-w-sm">
             <div className="bg-transparent w-full px-6 py-4 text-2xl font-black tracking-widest text-white focus:outline-none flex items-center">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-500" /> : code}
             </div>
             <button 
               onClick={handleCopyCode}
               className="bg-indigo-500 hover:bg-indigo-400 text-white font-black px-8 py-4 transition-colors flex items-center justify-center gap-2 border-l border-slate-700"
             >
                <Copy className="w-5 h-5" /> Copy
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
