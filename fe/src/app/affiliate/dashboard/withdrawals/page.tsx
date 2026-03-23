"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Wallet, Download, Clock, CheckCircle2, History, Loader2, AlertCircle, DollarSign, X } from "lucide-react";
import { affiliateService, Withdrawal } from "@/lib/api/affiliateService";
import { formatCurrency, cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notificationStore";

export default function WithdrawalsPage() {
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<Withdrawal[]>([]);

  const [formData, setFormData] = useState({
    amount: '',
    bank_name: '',
    account_number: '',
    account_name: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashboard, historyRes] = await Promise.all([
        affiliateService.getDashboard(),
        affiliateService.getWithdrawals(),
      ]);
      setBalance(dashboard.stats.wallet_balance);
      setHistory(historyRes);

      // Auto-fill bank info if available in metadata
      if (dashboard.affiliate.metadata) {
        setFormData(prev => ({
          ...prev,
          bank_name: dashboard.affiliate.metadata.bank_name || "",
          account_number: dashboard.affiliate.metadata.account_number || "",
          account_name: dashboard.affiliate.metadata.account_name || ""
        }));
      }
    } catch (err: any) {
      console.error(err);
      showToast({
        title: "Gagal memuat data penarikan",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formData.amount);
    
    if (isNaN(amountNum) || amountNum < 100000) {
      showToast({ title: "Minimal penarikan Rp 100.000", variant: "error" });
      return;
    }

    if (amountNum > balance) {
      showToast({ title: "Saldo tidak mencukupi", variant: "error" });
      return;
    }

    if (!formData.bank_name || !formData.account_number || !formData.account_name) {
      showToast({ title: "Lengkapi data rekening", variant: "error" });
      return;
    }

    try {
      setSubmitting(true);
      await affiliateService.createWithdrawal({
        amount: amountNum,
        bank_name: formData.bank_name,
        account_number: formData.account_number,
        account_name: formData.account_name
      });
      showToast({ title: "Penarikan berhasil diajukan", variant: "success" });
      setFormData({ ...formData, amount: '' });
      fetchData(); // Refresh info
    } catch (err: any) {
      showToast({ title: err.response?.data?.error || "Gagal mengajukan penarikan", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4 text-slate-900">
            Penarikan <span className="text-indigo-600">Komisi.</span>
          </h2>
          <p className="text-slate-500 font-medium text-lg max-w-2xl">
            Cairkan pendapatan Anda langsung ke rekening bank atau e-wallet pilihan. Proses verifikasi cepat dan transparan.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/20 group">
          <Wallet className="absolute right-0 bottom-0 text-white/5 w-64 h-64 -mb-16 -mr-16 group-hover:scale-110 transition-transform duration-700" />
          
          <div className="relative">
            <p className="text-indigo-200 font-black uppercase tracking-widest text-xs mb-2">Total Saldo Tersedia</p>
            <h3 className="text-6xl font-black tracking-tighter mb-8 drop-shadow-md">
              {loading ? <Loader2 className="w-12 h-12 animate-spin text-indigo-200" /> : formatCurrency(balance)}
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-4">
               <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20">
                  <CreditCard className="w-5 h-5 text-indigo-200" />
                  <span className="text-sm font-bold tracking-tight">Pencairan Terjadwal</span>
               </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-sm flex flex-col justify-between">
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Estimasi pencairan dana berikutnya akan diproses dalam <strong className="text-indigo-600">24 Jam Kerja</strong> setelah pengajuan disetujui.
          </p>
          <div className="w-full bg-slate-100 rounded-2xl p-4">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pencairan dalam Proses</p>
             <p className="text-lg font-black text-slate-900 mt-1">
                {formatCurrency((Array.isArray(history) ? history : []).filter(h => h.status === 'pending').reduce((acc, h) => acc + h.amount, 0))}
             </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
          {/* Withdrawal Form Section */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
              <h3 className="text-xl font-black uppercase italic tracking-tight mb-8">Formulir <span className="text-indigo-600">Penarikan.</span></h3>
              
              <form onSubmit={handleWithdraw} className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nominal Penarikan (IDR)</label>
                    <div className="relative">
                       <DollarSign className="w-5 h-5 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
                       <input 
                         type="number"
                         value={formData.amount}
                         onChange={(e) => setFormData({...formData, amount: e.target.value})}
                         placeholder="Minimal Rp 100.000"
                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-lg font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nama Bank / E-Wallet</label>
                       <input 
                         type="text"
                         value={formData.bank_name}
                         onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                         placeholder="Misal: BCA, GoPay, OVO"
                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-all"
                       />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nomor Rekening / HP</label>
                        <input 
                          type="text"
                          value={formData.account_number}
                          onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                          placeholder="Masukkan nomor akun"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-all"
                        />
                    </div>
                 </div>

                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nama Pemilik Akun</label>
                    <input 
                      type="text"
                      value={formData.account_name}
                      onChange={(e) => setFormData({...formData, account_name: e.target.value})}
                      placeholder="Nama sesuai buku tabungan/aplikasi"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-all"
                    />
                 </div>

                 <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-700 font-bold leading-relaxed tracking-tight">
                       Pencairan dana membutuhkan waktu verifikasi maksimal 24-48 jam. Pastikan data rekening Anda valid untuk menghindari penolakan.
                    </p>
                 </div>

                 <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                 >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                    Ajukan Pencairan Sekarang
                 </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
              <div className="p-8 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <History className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tight">Riwayat <span className="text-indigo-600">Pencairan.</span></h3>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-8 py-4">ID Transaksi</th>
                      <th className="px-8 py-4">Nominal</th>
                      <th className="px-8 py-4">Metode Tujuan</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                       <tr>
                         <td colSpan={5} className="px-8 py-10 text-center text-slate-300 italic text-sm">Memuat riwayat...</td>
                       </tr>
                    ) : !Array.isArray(history) || history.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="px-8 py-16 text-center">
                            <p className="text-slate-400 font-bold italic uppercase tracking-widest text-xs">Belum ada riwayat penarikan.</p>
                         </td>
                       </tr>
                    ) : (Array.isArray(history) ? history : []).map((item, i) => (
                      <motion.tr 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={item.id} 
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-8 py-6">
                          <p className="text-xs font-black text-slate-400">#{item.id.split('-')[0].toUpperCase()}</p>
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-black text-slate-900">{formatCurrency(item.amount)}</p>
                        </td>
                        <td className="px-8 py-6">
                           <p className="text-sm font-bold text-slate-600">{item.bank_name}</p>
                           <p className="text-[10px] font-medium text-slate-400 mt-0.5">{item.account_number} · {item.account_name}</p>
                        </td>
                        <td className="px-8 py-6">
                          {item.status === 'completed' ? (
                            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-bold uppercase tracking-wider">
                              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> Sukses
                            </span>
                          ) : item.status === 'pending' ? (
                            <span className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-xs font-bold uppercase tracking-wider">
                              <Clock className="w-3.5 h-3.5 inline mr-1" /> Pending
                            </span>
                          ) : (
                            <span className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold uppercase tracking-wider">
                              <X className="w-3.5 h-3.5 inline mr-1" /> Ditolak
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-6 text-sm font-medium text-slate-500">
                          {new Date(item.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
