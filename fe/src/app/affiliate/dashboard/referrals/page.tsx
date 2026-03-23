"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Search, Loader2, ArrowRight, X, Calendar, DollarSign, Target, CheckCircle2 } from "lucide-react";
import { affiliateService } from "@/lib/api/affiliateService";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";

interface ReferralData {
  id: string;
  tenant_name: string;
  company_name: string;
  plan_name: string;
  base_price: number;
  commission_percentage: number;
  status: string;
  commission_count: number;
  max_commissions: number;
  created_at: string;
  last_payment_at?: string;
}

export default function ReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<ReferralData[]>([]);
  const [selectedRef, setSelectedRef] = useState<ReferralData | null>(null);

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        setLoading(true);
        const res = await affiliateService.getDashboard();
        // The repository now returns enriched referral objects
        setReferrals(res.referrals);
      } catch (err) {
        console.error("Failed to fetch referrals:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReferrals();
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="mb-12">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4 text-slate-900">
          Daftar <span className="text-indigo-600">Mitra Anda.</span>
        </h2>
        <p className="text-slate-500 font-medium text-lg max-w-2xl">
          Lacak pertumbuhan jaringan dan status layanan mitra yang mendaftar melalui tautan referral Anda. 
          Pastikan Anda terus memantau retensi mereka untuk memaksimalkan hingga 4x komisi berulang!
        </p>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Riwayat Pendaftaran</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total {referrals?.length || 0} Mitra</p>
            </div>
          </div>
          
          <div className="relative w-full sm:w-64">
             <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
             <input 
               type="text"
               placeholder="Cari tenant..."
               className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
             />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4">Informasi Tenant</th>
                <th className="px-8 py-4">Layanan / Plan</th>
                <th className="px-8 py-4">Persentase</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Tgl Daftar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                 <tr>
                   <td colSpan={5} className="px-8 py-16 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                   </td>
                 </tr>
              ) : (referrals || []).length === 0 ? (
                 <tr>
                   <td colSpan={5} className="px-8 py-16 text-center text-slate-400 font-medium">
                      Belum ada mitra yang mendaftar. Mulai sebar kode referral Anda!
                   </td>
                 </tr>
              ) : (referrals || []).map((ref, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={ref.id} 
                  onClick={() => setSelectedRef(ref)}
                  className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">
                          {ref.company_name.substring(0, 2).toUpperCase()}
                       </div>
                       <div>
                         <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{ref.company_name}</p>
                         <p className="text-xs font-medium text-slate-500 mt-1">PIC: {ref.tenant_name}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                      {ref.plan_name || "Custom Plan"}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="font-black text-indigo-600">{ref.commission_percentage}%</span>
                  </td>
                  <td className="px-8 py-6">
                    {ref.status === 'active' ? (
                      <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-bold uppercase tracking-wider">
                        Active
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-xs font-bold uppercase tracking-wider">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-medium text-slate-600">
                      {new Date(ref.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedRef && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRef(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[110] shadow-2xl p-10 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">Detail <span className="text-indigo-600">Referral.</span></h3>
                <button 
                  onClick={() => setSelectedRef(null)}
                  className="p-2 -mr-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-[32px] p-8 mb-8">
                 <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600 mb-4 border border-indigo-100">
                    <Users className="w-8 h-8" />
                 </div>
                 <h4 className="text-2xl font-black text-slate-900 tracking-tight">{selectedRef.company_name}</h4>
                 <p className="text-slate-500 font-bold text-sm">Tenant ID: #{selectedRef.id.split('-')[0].toUpperCase()}</p>
              </div>

              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status Partner</p>
                       <p className={cn("text-xs font-black uppercase", selectedRef.status === 'active' ? "text-emerald-500" : "text-amber-500")}>
                          {selectedRef.status}
                       </p>
                    </div>
                    <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Fee Komisi</p>
                       <p className="text-xs font-black uppercase text-indigo-600">{selectedRef.commission_percentage}%</p>
                    </div>
                 </div>

                 <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                       <div className="flex items-center gap-3 text-slate-400">
                          <Calendar className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">Tanggal Gabung</span>
                       </div>
                       <span className="text-sm font-bold text-slate-900">{new Date(selectedRef.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                       <div className="flex items-center gap-3 text-slate-400">
                          <Target className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">Layanan Aktif</span>
                       </div>
                       <span className="text-sm font-bold text-indigo-600">{selectedRef.plan_name}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                       <div className="flex items-center gap-3 text-slate-400">
                          <DollarSign className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">Nilai Tagihan</span>
                       </div>
                       <span className="text-sm font-bold text-slate-900">{formatCurrency(selectedRef.base_price)}</span>
                    </div>
                 </div>

                 <div className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                       <h5 className="text-sm font-black uppercase tracking-wider text-slate-900 italic">Progress Klaim Komisi</h5>
                       <span className="text-xs font-black text-indigo-600">{selectedRef.commission_count}/{selectedRef.max_commissions} Kali</span>
                    </div>
                    <div className="flex gap-2">
                       {Array.from({ length: selectedRef.max_commissions }).map((_, i) => (
                          <div 
                             key={i}
                             className={cn(
                                "flex-1 h-3 rounded-full transition-all duration-500",
                                i < selectedRef.commission_count ? "bg-indigo-600 shadow-sm" : "bg-slate-100"
                             )}
                          />
                       ))}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-3 leading-relaxed">
                       * Komisi cair setiap bulan (max {selectedRef.max_commissions}x). 
                       {selectedRef.commission_count < selectedRef.max_commissions 
                          ? ` Anda masih memiliki jatah ${selectedRef.max_commissions - selectedRef.commission_count}x klaim lagi dari tenant ini.` 
                          : " Kuota komisi berulang untuk tenant ini sudah maksimal."}
                    </p>
                 </div>

                 {selectedRef.last_payment_at && (
                    <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                          <CheckCircle2 className="w-5 h-5" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Pembayaran Terakhir</p>
                          <p className="text-sm font-bold text-emerald-900">{new Date(selectedRef.last_payment_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                       </div>
                    </div>
                 )}
              </div>

              <div className="mt-12">
                 <button 
                  onClick={() => setSelectedRef(null)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all"
                 >
                    Tutup Detail
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {!loading && (referrals?.length || 0) === 0 && (
         <div className="flex flex-col items-center justify-center p-12 bg-indigo-50 border border-indigo-100 rounded-[40px] text-center">
            <h3 className="text-2xl font-black italic uppercase tracking-tight text-indigo-900 mb-2">Bawa Omset Pertamamu!</h3>
            <p className="text-indigo-700/80 font-medium text-sm max-w-md mb-8">Berikan kode unik Anda kepada calon mitra saat mereka mendaftar di RR-Net agar otomatis terhitung sebagai mitra Anda.</p>
            <Link 
               href="/affiliate/dashboard" 
               className="px-8 py-4 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-100"
            >
               Ambil Kode Referral
            </Link>
         </div>
      )}
    </div>
  );
}
