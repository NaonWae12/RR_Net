"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, 
  Ticket, 
  Lock, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  RefreshCcw, 
  ShieldCheck,
  MessageSquare,
  KeyRound
} from "lucide-react";
import { authService } from "@/lib/api/authService";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [timer, setTimer] = useState(0);
  const [otpMethod, setOtpMethod] = useState<"whatsapp" | "email">("email");

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await authService.forgotPassword(email, otpMethod);
      setMaskedPhone(res.info);
      toast.success(`OTP telah dikirim via ${otpMethod === "whatsapp" ? "WhatsApp" : "Email"}!`);
      setStep(2);
      setTimer(60);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ email, otp, password });
      toast.success("Password reset successfully!");
      setStep(4);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-purple-500/30 font-sans flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-8">
           <Link href="/" className="inline-block group">
            <div className="flex items-center gap-3 justify-center mb-2">
              <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform duration-300">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-black italic tracking-tighter text-white">RRNET<span className="text-purple-500">.</span></span>
            </div>
           </Link>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {/* Progress Bar */}
          {step < 4 && (
            <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
              <motion.div 
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                initial={{ width: "33%" }}
                animate={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h1 className="text-3xl font-black italic tracking-tighter">LUPA PASSWORD?</h1>
                  <p className="text-sm text-white/50 leading-relaxed font-medium">
                    Masukkan email akun Anda. Kami akan mengirimkan kode verifikasi OTP ke Email & WhatsApp yang terdaftar.
                  </p>
                </div>

                <form onSubmit={handleRequestOTP} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-1">Alamat Email</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        type="email" 
                        required
                        placeholder="you@email.com"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-1">Metode Pengiriman OTP</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setOtpMethod("email")}
                        className={cn(
                          "py-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2",
                          otpMethod === "email" 
                            ? "bg-purple-500/20 border-purple-500 text-purple-400" 
                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <Mail className="w-4 h-4" />
                        Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setOtpMethod("whatsapp")}
                        className={cn(
                          "py-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2",
                          otpMethod === "whatsapp" 
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" 
                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <MessageSquare className="w-4 h-4" />
                        WhatsApp
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading || !email}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-4 rounded-2xl font-black italic uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl shadow-purple-500/20 flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    {loading ? "Memproses..." : "Kirim Kode OTP"}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>

                <div className="text-center pt-4">
                  <Link href="/login" className="text-xs font-black uppercase tracking-widest text-white/40 hover:text-purple-400 transition-colors flex items-center justify-center gap-2 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Kembali Login
                  </Link>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                    <MessageSquare className="w-8 h-8 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase">Verifikasi OTP</h2>
                    <p className="text-xs text-white/50 leading-relaxed font-medium">
                      Kami telah mengirimkan 6 digit kode OTP ke <span className={cn("font-bold", otpMethod === "whatsapp" ? "text-emerald-400" : "text-purple-400")}>{maskedPhone}</span> Anda.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-white/40 text-center block mb-3">Masukkan Kode OTP</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      placeholder="000000"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-6 text-center text-3xl font-black tracking-[0.8em] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-emerald-400 placeholder:text-white/5"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>

                  <button 
                    onClick={() => setStep(3)}
                    disabled={otp.length !== 6}
                    className="w-full bg-white text-black py-4 rounded-2xl font-black italic uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    Verifikasi Kode
                    <CheckCircle2 className="w-5 h-5" />
                  </button>

                  <div className="text-center pt-2">
                    {timer > 0 ? (
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
                        Kirim ulang dalam <span className="text-white">{timer}s</span>
                      </p>
                    ) : (
                      <button 
                        onClick={handleRequestOTP}
                        className="text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:underline flex items-center gap-2 mx-auto"
                      >
                        <RefreshCcw className="w-3 h-3" />
                        Kirim Ulang OTP
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black italic tracking-tighter uppercase">PASSWORD BARU</h2>
                  <p className="text-sm text-white/50 font-medium">
                    Satu langkah lagi! Buat kata sandi baru yang kuat untuk keamanan akun Anda.
                  </p>
                </div>

                <form onSubmit={handleVerifyAndReset} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-1">Password Baru</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        type="password" 
                        required
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-1">Konfirmasi Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        type="password" 
                        required
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading || !password || password !== confirmPassword}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-4 rounded-2xl font-black italic uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl shadow-purple-500/20 flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    {loading ? "Menyimpan..." : "Reset Password"}
                    <KeyRound className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  </button>
                </form>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8"
              >
                <div className="w-24 h-24 bg-gradient-to-tr from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40 border-4 border-white/10 scale-110">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-4xl font-black italic tracking-tighter uppercase whitespace-nowrap">BERHASIL!</h1>
                  <p className="text-sm text-white/60 font-medium">Password Anda telah berhasil diperbarui. Silakan login kembali.</p>
                </div>
                
                <Link 
                  href="/login"
                  className="inline-flex w-full items-center justify-center bg-white text-black py-4 rounded-2xl font-black italic uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl"
                >
                  Masuk Sekarang
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Support Section */}
        <div className="mt-8 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20">
            Butuh bantuan? <Link href="https://wa.me/something" className="text-white/40 hover:text-white transition-colors underline underline-offset-4">Hubungi CS RRNET</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
