"use client";

import { useState } from "react";
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
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notificationStore";

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // UI Only for now
    setTimeout(() => {
      setLoading(false);
      setStep(2);
      showToast({ title: "Pendaftaran affiliate berhasil dikirim!", variant: "success" });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex overflow-hidden relative">
      {/* Background blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full -z-10" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full -z-10" />

      {/* Left Sidebar - Marketing */}
      <div className="hidden lg:flex w-[40%] p-16 flex-col justify-between border-r border-white/5 bg-white/[0.01] backdrop-blur-3xl relative">
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 mb-20 group">
            <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-500">
              <Zap className="text-white w-7 h-7 fill-current" />
            </div>
            <span className="text-2xl font-black tracking-tighter">ERP<span className="text-purple-500">.</span>NET</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl font-black leading-[1.1] mb-8">
              Become our <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Growth Partner.</span>
            </h2>
            <p className="text-lg text-white/50 mb-12 max-w-md font-medium leading-relaxed">
              Dapatkan komisi hingga 30% dari setiap tenant yang Anda referensikan. Bergabunglah dengan program kemitraan paling menguntungkan di industri ERP.
            </p>
          </motion.div>

          <div className="space-y-6">
            {[
              { 
                title: "Komisi 30% Recurring", 
                desc: "Dapatkan penghasilan dari setiap pembayaran tagihan tenant.",
                icon: DollarSign,
                color: "text-emerald-400"
              },
              { 
                title: "Network Expansion", 
                desc: "Bantu bisnis lokal bertransformasi digital bersama kami.",
                icon: Users,
                color: "text-blue-400"
              },
              { 
                title: "Reward Eksklusif", 
                desc: "Bonus tambahan untuk partner dengan performa terbaik.",
                icon: Trophy,
                color: "text-amber-400"
              }
            ].map((item, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
              >
                <div className={cn("w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10", item.color)}>
                  <item.icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white tracking-tight">{item.title}</h4>
                  <p className="text-white/40 text-sm">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0a0a0b] bg-white/10 flex items-center justify-center text-[10px] font-bold">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-xs text-white/30 font-medium">
              Join <span className="text-white">50+ partners</span> who are already growing with us.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-grow flex flex-col items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                <div className="text-left space-y-2">
                  <h1 className="text-4xl font-black">Join Affiliate</h1>
                  <p className="text-white/40 font-medium">Lengkapi data diri Anda untuk mulai menghasilkan.</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Nama Lengkap</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        required
                        type="text" 
                        placeholder="Contoh: Budi Santoso"
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all font-medium"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Alamat Email</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        required
                        type="email" 
                        placeholder="email@anda.com"
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all font-medium"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Nomor WhatsApp</label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        required
                        type="tel" 
                        placeholder="62812345678"
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all font-medium"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/30 ml-1">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        required
                        type="password" 
                        placeholder="••••••••"
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all font-medium"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-4 rounded-2xl font-bold hover:shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                    >
                      {loading ? "Memproses..." : "Daftar Sekarang"}
                      {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    </button>
                  </div>

                  <p className="text-center text-sm text-white/30 font-medium">
                    Suda punya akun? <Link href="/login" className="text-purple-400 hover:text-purple-300 transition-colors">Masuk di sini</Link>
                  </p>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8"
              >
                <div className="w-24 h-24 bg-emerald-500/20 rounded-[32px] flex items-center justify-center mx-auto border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-4xl font-black">Application Sent!</h2>
                  <p className="text-white/50 leading-relaxed font-medium">
                    Terima kasih telah mendaftar sebagai partner. Tim kami akan melakukan review pada aplikasi Anda dalam 24 jam ke depan.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 text-left space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-purple-400" />
                    Apa langkah selanjutnya?
                  </h4>
                  <ul className="space-y-3 text-sm text-white/40 font-medium">
                    <li className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400 font-bold shrink-0">1</div>
                      Review aplikasi oleh tim Super Admin.
                    </li>
                    <li className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400 font-bold shrink-0">2</div>
                      Pemberitahuan via WhatsApp & Email.
                    </li>
                    <li className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-400 font-bold shrink-0">3</div>
                      Akses dashboard affiliate & referral link unik.
                    </li>
                  </ul>
                </div>

                <Link 
                  href="/login"
                  className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors font-bold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Kembali ke Login
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
