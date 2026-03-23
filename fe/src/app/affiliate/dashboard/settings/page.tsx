"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Mail, Landmark, Phone, Lock, Hash, Save, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { affiliateService } from "@/lib/api/affiliateService";
import { useNotificationStore } from "@/stores/notificationStore";

export default function SettingsPage() {
  const { user } = useAuth();
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [submittingBank, setSubmittingBank] = useState(false);
  
  const [bankData, setBankData] = useState({
    bank_name: "bca",
    account_number: "",
    account_name: ""
  });

  useEffect(() => {
    const fetchAffiliateData = async () => {
      try {
        setLoading(true);
        const data = await affiliateService.getDashboard();
        if (data.affiliate.metadata) {
          setBankData({
            bank_name: data.affiliate.metadata.bank_name || "bca",
            account_number: data.affiliate.metadata.account_number || "",
            account_name: data.affiliate.metadata.account_name || ""
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAffiliateData();
  }, []);

  const handleSaveBank = async () => {
    try {
      setSubmittingBank(true);
      await affiliateService.updateMetadata(bankData);
      showToast({ title: "Data perbankan diperbarui", variant: "success" });
    } catch (err) {
      showToast({ title: "Gagal memperbarui data", variant: "error" });
    } finally {
      setSubmittingBank(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="mb-12">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4 text-slate-900">
          Profil <span className="text-indigo-600">Akun.</span>
        </h2>
        <p className="text-slate-500 font-medium text-lg max-w-2xl">
          Kelola informasi personal dan data perbankan Anda di sini demi pencairan dana komisi yang lancar.
        </p>
      </div>

      <div className="grid gap-8">
        
        {/* Personal Details Form - Read Only or Linked to User Auth */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-10 relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-50 flex items-center justify-center rounded-2xl text-indigo-600">
                <User className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">Biodata</h3>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 font-medium">
             <div className="space-y-2">
                 <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-4">Nama Lengkap</label>
                 <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input type="text" value={user?.name || ""} readOnly className="w-full bg-slate-50 border border-slate-100 text-slate-500 rounded-2xl pl-12 pr-4 py-4 cursor-not-allowed" />
                 </div>
             </div>
             <div className="space-y-2">
                 <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-4">Email Resmi</label>
                 <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input type="email" value={user?.email || ""} readOnly className="w-full bg-slate-50 border border-slate-100 text-slate-500 rounded-2xl pl-12 pr-4 py-4 cursor-not-allowed" />
                 </div>
             </div>
             <div className="space-y-2">
                 <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-4">Nomor WhatsApp</label>
                 <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input type="tel" value={user?.phone || ""} readOnly className="w-full bg-slate-50 border border-slate-100 text-slate-500 rounded-2xl pl-12 pr-4 py-4 cursor-not-allowed" />
                 </div>
             </div>
          </div>
          <p className="mt-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">* Hubungi Admin jika ingin mengubah data utama akun.</p>
        </motion.div>

        {/* Banking Detail Form */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[40px] border border-slate-800 shadow-2xl p-10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
             <Landmark className="w-64 h-64 -translate-y-10 translate-x-10 text-white" />
          </div>
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-500/20 flex items-center justify-center rounded-2xl text-indigo-400 border border-indigo-500/30">
                <Landmark className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tight text-white">Data Perbankan</h3>
            </div>
            <button 
              onClick={handleSaveBank}
              disabled={submittingBank || loading}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-colors shadow-lg shadow-indigo-900/50 disabled:opacity-50"
            >
               {submittingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
            </button>
          </div>

          <div className="flex bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl items-start gap-4 mb-8">
             <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
             <p className="text-sm font-medium text-rose-300 leading-relaxed">
               Pastikan nomor rekening atau E-Wallet dan Nama Tujuan yang terdaftar valid. Kesalahan data dapat menghambat proses pencairan komisi Anda.
             </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 relative z-10">
             <div className="space-y-2">
                 <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-4">Metode Penarikan</label>
                 <select 
                   value={bankData.bank_name}
                   onChange={(e) => setBankData({...bankData, bank_name: e.target.value})}
                   className="w-full bg-slate-800/50 border border-slate-700 font-bold focus:bg-slate-800 text-white rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all appearance-none cursor-pointer"
                 >
                    <option value="bca">Bank Central Asia (BCA)</option>
                    <option value="mandiri">Bank Mandiri</option>
                    <option value="bri">Bank Rakyat Indonesia (BRI)</option>
                    <option value="gopay">GoPay</option>
                    <option value="dana">DANA</option>
                 </select>
             </div>
             
             <div className="space-y-2">
                 <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-4">Nomor Rekening / HP</label>
                 <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                    <input 
                      type="text" 
                      value={bankData.account_number}
                      onChange={(e) => setBankData({...bankData, account_number: e.target.value})}
                      placeholder="CtH: 852xxxx atau 0812xxx" 
                      className="w-full bg-slate-800/50 border border-slate-700 font-bold focus:bg-slate-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600" 
                    />
                 </div>
             </div>

             <div className="md:col-span-2 space-y-2 mt-2">
                 <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-4">Atas Nama Pemilik Rekening</label>
                 <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                    <input 
                      type="text" 
                      value={bankData.account_name}
                      onChange={(e) => setBankData({...bankData, account_name: e.target.value})}
                      placeholder="Cth: JOHN DOE" 
                      className="w-full bg-slate-800/50 border border-slate-700 font-bold focus:bg-slate-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600 uppercase" 
                    />
                 </div>
             </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
