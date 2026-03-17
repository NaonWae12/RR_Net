"use client";

import { motion } from "framer-motion";
import { 
  Zap, 
  Users, 
  Trophy, 
  DollarSign, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  MessageSquare,
  TrendingUp,
  Clock,
  Cpu,
  Layers,
  Globe,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { cn } from "@/lib/utils";

export default function AffiliateLandingPage() {
  const affiliateLinks = [
    { label: "Keuntungan", href: "#benefits", icon: Trophy },
    { label: "Cara Kerja", href: "#how-it-works", icon: Zap },
    { label: "Skema Komisi", href: "#commission", icon: DollarSign },
    { label: "FAQ", href: "#faq", icon: MessageSquare },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0b] text-white selection:bg-purple-500/30">
      <MarketingNavbar 
        customLinks={affiliateLinks}
        registerHref="/affiliate-register"
        registerLabel="Gabung Partner"
      />
      
      <main className="flex-grow pt-32 pb-20">
        {/* Hero Section */}
        <section className="relative px-4 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] -z-10">
            <div className="absolute top-[-10%] left-[10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full" />
          </div>

          <div className="container mx-auto max-w-6xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-[0.2em] mb-8"
            >
              🚀 Partner Program Is Live
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-8xl font-black mb-8 leading-[1.05] tracking-tighter"
            >
              Majukan Ekosistem ISP, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400 italic">Dapatkan Penghasilan Pasif.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-white/50 mb-12 max-w-3xl mx-auto font-medium leading-relaxed"
            >
              Bergabunglah dengan program kemitraan paling transparan di industri ERP. 
              Dapatkan komisi berkelanjutan sebesar 30% selama mitra yang Anda referensikan aktif berlangganan.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link 
                href="/affiliate-register" 
                className="bg-white text-black px-10 py-5 rounded-[24px] font-black text-lg hover:scale-105 transition-all shadow-2xl flex items-center justify-center gap-2 group"
              >
                Mulai Sebagai Partner
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                href="#how-it-works" 
                className="bg-white/5 backdrop-blur-md border border-white/10 px-10 py-5 rounded-[24px] font-black text-lg hover:bg-white/10 transition-all text-center"
              >
                Pelajari Program
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Stats / Numbers */}
        <section className="py-24">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { label: "Besaran Komisi", value: "30%", icon: DollarSign },
                { label: "Periode Pencairan", value: "Bulanan", icon: Clock },
                { label: "Durasi Cookie", value: "60 Hari", icon: Globe },
                { label: "Tingkat Retensi", value: "98%", icon: TrendingUp },
              ].map((stat, i) => (
                <div key={i} className="text-center p-8 rounded-[32px] bg-white/[0.02] border border-white/5">
                  <stat.icon className="w-6 h-6 text-purple-400 mx-auto mb-4" />
                  <h3 className="text-3xl md:text-4xl font-black mb-1">{stat.value}</h3>
                  <p className="text-xs font-bold text-white/30 uppercase tracking-widest">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-24 relative overflow-hidden">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-black mb-6 uppercase italic">Cara Kerja Program.</h2>
              <p className="text-white/40 font-medium max-w-2xl mx-auto">Tiga langkah sederhana untuk mulai membangun penghasilan tambahan bersama RRNET.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connector Line (Desktop) */}
              <div className="hidden md:block absolute top-[28%] left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-purple-500/0 via-purple-500/20 to-purple-500/0" />
              
              {[
                { 
                  step: "01", 
                  title: "Daftar Sebagai Partner", 
                  desc: "Lengkapi formulir pendaftaran melalui dashboard kami hanya dalam 1 menit. Tanpa biaya pendaftaran.",
                  icon: Users
                },
                { 
                  step: "02", 
                  title: "Bagikan Tautan", 
                  desc: "Gunakan tautan referral unik Anda melalui kanal digital, komunitas, atau tawarkan ke rekan sesama pengusaha ISP.",
                  icon: MessageSquare
                },
                { 
                  step: "03", 
                  title: "Dapatkan Hasil", 
                  desc: "Setiap pengguna baru yang aktif menggunakan RRNET akan memberikan komisi 30% yang langsung masuk ke saldo Anda.",
                  icon: Wallet
                }
              ].map((item, i) => (
                <div key={i} className="relative p-8 rounded-[40px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-8 border border-indigo-500/20 shadow-lg">
                    <item.icon className="w-8 h-8 text-indigo-400" />
                  </div>
                  <span className="text-6xl font-black text-white/[0.03] absolute top-8 right-8 group-hover:text-indigo-500/10 transition-colors uppercase tracking-widest font-mono">{item.step}</span>
                  <h3 className="text-2xl font-black mb-4">{item.title}</h3>
                  <p className="text-white/40 font-medium leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Commission Calculator / Why Join */}
        <section id="benefits" className="py-24 bg-white/[0.01] border-y border-white/5">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div id="commission">
                <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50">
                  Mengapa Bergabung <br />Bersama RRNET?
                </h2>
                <div className="space-y-6">
                  {[
                    { title: "Komisi Berkelanjutan 30%", desc: "Dapatkan penghasilan jangka panjang selama mitra yang Anda bawa tetap berlangganan." },
                    { title: "Dashboard Transparan", desc: "Akses data klik, konvrensi, dan riwayat komisi secara real-time dan akurat." },
                    { title: "Marketing Kit Profesional", desc: "Tersedia aset visual seperti banner dan materi promosi untuk membantu Anda." },
                    { title: "Dukungan Prioritas", desc: "Akses komunikasi khusus bagi partner untuk konsultasi strategi pertumbuhan." }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="mt-1">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold">{item.title}</h4>
                        <p className="text-white/40 text-sm font-medium">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-8 md:p-12 rounded-[48px] bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8">
                   <Trophy className="w-20 h-20 text-white/5 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                </div>
                <h4 className="text-2xl font-black mb-6 italic">Ilustrasi Kemitraan 💸</h4>
                <div className="space-y-6">
                  <div className="bg-black/20 rounded-2xl p-6 border border-white/5">
                    <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-2">Referral 10 Mitra Pro</p>
                    <p className="text-3xl font-black">Rp 1.500.000 <span className="text-xs font-medium text-white/40">/ Bulan</span></p>
                  </div>
                  <div className="bg-black/20 rounded-2xl p-6 border border-white/5">
                    <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-2">Referral 50 Mitra Business</p>
                    <p className="text-3xl font-black">Rp 12.000.000 <span className="text-xs font-medium text-white/40">/ Bulan</span></p>
                  </div>
                  <p className="text-xs italic text-white/30 text-center font-medium">Angka di atas merupakan ilustrasi berdasarkan skema paket langganan aktif.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 px-4">
          <div className="container mx-auto max-w-3xl">
            <h2 className="text-4xl font-black mb-12 text-center italic uppercase">Informasi Umum Partner.</h2>
            <div className="space-y-4">
              {[
                { q: "Apakah saya harus menjadi pengguna RRNET?", a: "Tidak. Pendaftaran terbuka bagi siapa saja yang ingin menjadi mitra pertumbuhan kami." },
                { q: "Kapan komisi akan dicairkan?", a: "Komisi akan diproses setiap awal bulan untuk periode pembayaran mitra di bulan sebelumnya." },
                { q: "Berapa batas minimum penarikan?", a: "Batas minimum penarikan saldo adalah sebesar Rp 50.000." },
                { q: "Bagaimana jika mitra berhenti berlangganan?", a: "Sesuai skema komisi berkelanjutan, pendapatan dari mitra tersebut akan terhenti jika masa langganannya berakhir." }
              ].map((faq, i) => (
                <div key={i} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
                  <h4 className="font-bold mb-2 flex items-center gap-3">
                    <Zap className="w-4 h-4 text-purple-400" />
                    {faq.q}
                  </h4>
                  <p className="text-white/40 text-sm font-medium leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24">
          <div className="container mx-auto px-4 max-w-5xl text-center">
            <div className="p-12 md:p-20 rounded-[64px] bg-gradient-to-r from-purple-600 to-indigo-600 relative overflow-hidden group shadow-2xl shadow-purple-600/40">
              <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[200%] bg-white/10 blur-[100px] rotate-45 -z-10 group-hover:translate-x-full transition-transform duration-1000" />
              <h2 className="text-5xl md:text-7xl font-black mb-8 italic tracking-tighter">Mulai Langkah Anda Sekarang.</h2>
              <p className="text-xl text-white/80 font-medium mb-12 max-w-2xl mx-auto">Bangun penghasilan pasif Anda dengan menjadi mitra strategis RRNET.</p>
              <Link 
                href="/affiliate-register" 
                className="inline-flex bg-white text-black px-12 py-6 rounded-[28px] font-black text-2xl hover:scale-110 transition-all shadow-2xl"
              >
                Gabung Program Mitra
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
