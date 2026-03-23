"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  Zap, 
  ArrowRight, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  ShieldCheck, 
  Rocket,
  CheckCircle2,
  Trophy,
  Users,
  DollarSign,
  ArrowLeft,
  ChevronLeft,
  Coins,
  ShieldEllipsis,
  MessageSquare,
  Gift,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notificationStore";
import { affiliateService } from "@/lib/api/affiliateService";

export default function AffiliateRegisterPage() {
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    source: "other", // How did they hear about us
  });
  const [isMounted, setIsMounted] = useState(false);

  useState(() => {
    // This runs during initialization
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await affiliateService.register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });
      
      setLoading(false);
      setStep(2);
      showToast({ title: "Pendaftaran berhasil!", variant: "success" });
    } catch (err: any) {
      setLoading(false);
      const msg = err.response?.data?.error || "Gagal melakukan pendaftaran. Silakan coba lagi.";
      showToast({ title: "Gagal Mendaftar", description: msg, variant: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row overflow-x-hidden">
      
      {/* Mobile Header Overlay (Sticky/Simple) */}
      <div className="md:hidden flex items-center p-6 border-b border-slate-200 bg-white">
        <Link href="/affiliate" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
                <Zap className="text-white w-5 h-5 fill-current" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase italic">Partner HUB</span>
        </Link>
      </div>

      {/* Left Sidebar - High Value Marketing Information */}
      <div className="hidden md:flex w-[450px] lg:w-[500px] p-16 flex-col justify-between border-r border-slate-200 bg-white relative">
        <div className="relative z-10">
          <Link href="/affiliate" className="flex items-center gap-3 mb-24 group">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200 group-hover:rotate-12 transition-transform duration-500">
              <Zap className="text-white w-7 h-7 fill-current" />
            </div>
            <span className="text-3xl font-black tracking-tighter italic uppercase text-slate-900">Partner<span className="text-indigo-600">Hub</span></span>
          </Link>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-6">
                🔥 Hot Program 2024
             </div>
            <h2 className="text-5xl lg:text-6xl font-black leading-[1.05] mb-8 italic tracking-tighter">
              Bukan Sekadar Hemat, <br />
              <span className="text-indigo-600 underline decoration-indigo-200">Saatnya Produktif.</span>
            </h2>
            <p className="text-lg text-slate-500 mb-12 max-w-sm font-medium leading-relaxed">
              Transformasikan jaringan internet Anda menjadi sumber penghasilan. Bergabunglah dengan ekosistem kemitraan terbaik dan raih komisi hingga <span className="text-indigo-600 font-black">35%</span>.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-4">
            {[
              { 
                title: "Komisi 35% Berkelanjutan", 
                desc: "Dapatkan penghasilan setiap bulan dari langganan aktif mitra Anda.",
                icon: Coins,
                color: "text-emerald-600",
                bg: "bg-emerald-50"
              },
              { 
                title: "Penagihan Otomatis", 
                desc: "Sistem automasi billing yang memastikan kelancaran pembayaran.",
                icon: Target,
                color: "text-indigo-600",
                bg: "bg-indigo-50"
              },
              { 
                title: "Aset Digital Jangka Panjang", 
                desc: "Bangun database jaringan Anda untuk masa depan yang lebih baik.",
                icon: ShieldEllipsis,
                color: "text-purple-600",
                bg: "bg-purple-50"
              }
            ].map((item, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex gap-4 p-5 rounded-[24px] bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-all hover:-translate-y-1 shadow-sm"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border", item.bg, item.color, "border-" + item.color.split('-')[1] + "-100")}>
                  <item.icon className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 tracking-tight uppercase italic text-sm">{item.title}</h4>
                  <p className="text-slate-500 text-xs font-medium leading-relaxed mt-1">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black ring-1 ring-slate-200">
                  ID
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
              Bergabung dengan <span className="text-slate-900">200+ Pemilik Jaringan</span> yang telah sukses!
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Form Container */}
      <div className="flex-grow flex flex-col items-center justify-center p-6 md:p-16 lg:p-24">
        <div className="w-full max-w-lg">
          {isMounted && (
            <AnimatePresence mode="wait">
              {step === 1 ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="text-left space-y-3">
                    <Link href="/affiliate" className="inline-flex items-center gap-1.5 text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest mb-4">
                        <ChevronLeft className="w-4 h-4" />
                        Kembali Ke Halaman Utama
                    </Link>
                  <h1 className="text-4xl md:text-5xl font-black italic uppercase italic tracking-tighter text-slate-900">Pendaftaran Mitra</h1>
                  <p className="text-slate-500 font-medium">Lengkapi data Anda untuk mendapatkan akses portal eksklusif.</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nama Lengkap Kamu</label>
                    <div className="relative group">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                      <input 
                        required
                        type="text" 
                        placeholder="Contoh: Budi Santoso"
                        className="w-full bg-white border-2 border-slate-100 rounded-3xl py-5 pl-14 pr-6 focus:outline-none focus:border-indigo-600 transition-all font-bold text-lg text-slate-900 shadow-sm"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        suppressHydrationWarning={true}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Alamat Email Aktif</label>
                      <div className="relative group">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                          <input 
                            required
                            type="email" 
                            placeholder="email@anda.com"
                            className="w-full bg-white border-2 border-slate-100 rounded-3xl py-5 pl-14 pr-6 focus:outline-none focus:border-indigo-600 transition-all font-bold text-slate-900 shadow-sm"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            suppressHydrationWarning={true}
                          />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">No. WhatsApp (Aktif)</label>
                      <div className="relative group">
                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                          <input 
                            required
                            type="tel" 
                            placeholder="0812xxxx"
                            className="w-full bg-white border-2 border-slate-100 rounded-3xl py-5 pl-14 pr-6 focus:outline-none focus:border-indigo-600 transition-all font-bold text-slate-900 shadow-sm"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            suppressHydrationWarning={true}
                          />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Bikin Password Aman</label>
                    <div className="relative group">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                      <input 
                        required
                        type="password" 
                        placeholder="••••••••"
                        className="w-full bg-white border-2 border-slate-100 rounded-3xl py-5 pl-14 pr-6 focus:outline-none focus:border-indigo-600 transition-all font-bold text-slate-900 shadow-sm"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        suppressHydrationWarning={true}
                      />
                    </div>
                  </div>

                  <div className="pt-6">
                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black text-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 group disabled:opacity-50 shadow-2xl shadow-indigo-100"
                    >
                      {loading ? "Sedang Memproses..." : "GABUNG SEBAGAI MITRA SEKARANG"}
                      {!loading && <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />}
                    </button>
                    <p className="mt-8 text-center text-sm text-slate-400 font-medium">
                      Sudah memiliki akun mitra? <Link href="/login" className="text-indigo-600 font-black hover:underline underline-offset-4 decoration-indigo-200">MASUK KE PORTAL</Link>
                    </p>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-10"
              >
                <div className="w-28 h-28 bg-emerald-50 rounded-[40px] flex items-center justify-center mx-auto border border-emerald-100 shadow-xl shadow-emerald-50 relative">
                  <CheckCircle2 className="w-14 h-14 text-emerald-600" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center border-4 border-white">
                     <Zap className="w-4 h-4 text-white fill-current" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-4xl md:text-5xl font-black italic uppercase italic tracking-tighter">Pendaftaran Berhasil!</h2>
                  <p className="text-slate-500 leading-relaxed font-bold border-l-4 border-indigo-600 pl-6 py-2 ml-4 text-left">
                    Terima kasih telah mendaftar. Tim kami akan meninjau permohonan Anda dalam waktu <span className="text-indigo-600">24 jam</span>. Kami akan segera menghubungi Anda.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                   <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                         <MessageSquare className="w-5 h-5 text-indigo-600" />
                      </div>
                      <h5 className="font-black text-xs uppercase tracking-widest mb-1 text-slate-900">Informasi WhatsApp</h5>
                      <p className="text-[10px] text-slate-400 font-medium text-left">Harap periksa WhatsApp Anda secara berkala untuk informasi status persetujuan.</p>
                   </div>
                   <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-4">
                         <Gift className="w-5 h-5 text-purple-600" />
                      </div>
                      <h5 className="font-black text-xs uppercase tracking-widest mb-1 text-slate-900">Materi Pemasaran</h5>
                      <p className="text-[10px] text-slate-400 font-medium text-left">Tautan unduhan file marketing kit akan dikirimkan bersamaan dengan aktivasi akun.</p>
                   </div>
                </div>

                <Link 
                  href="/login"
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-black uppercase text-xs tracking-widest pt-10"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Balik Ke Login
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
