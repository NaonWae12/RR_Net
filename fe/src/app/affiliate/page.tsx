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
  Wallet,
  Coins,
  ShieldEllipsis,
  Activity,
  ArrowUpRight
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
    <div className="flex flex-col min-h-screen bg-[#070708] text-white selection:bg-indigo-500/30">
      <MarketingNavbar 
        customLinks={affiliateLinks}
        registerHref="/affiliate-register"
        registerLabel="Daftar Partner"
      />
      
      <main className="flex-grow pt-32 pb-20">
        {/* Hero Section - Aggressive & High Converting */}
        <section className="relative px-4 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[700px] -z-10">
            <div className="absolute top-[-10%] left-[5%] w-[50%] h-[50%] bg-indigo-600/20 blur-[130px] rounded-full animate-pulse" />
            <div className="absolute bottom-[20%] right-[10%] w-[40%] h-[40%] bg-purple-500/10 blur-[110px] rounded-full" />
          </div>

          <div className="container mx-auto max-w-6xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-[0.2em] mb-8"
            >
              🔥 Program Partner RT/RW Net #1 Indonesia
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-8xl font-black mb-8 leading-[1.05] tracking-tighter"
            >
              Bukan Sekadar Hemat, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 italic">Optimalkan Pendapatan Anda.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-2xl text-white/50 mb-12 max-w-3xl mx-auto font-medium leading-relaxed"
            >
              Ubah jaringan internet menjadi sumber penghasilan berkelanjutan. Dapatkan komisi hingga <span className="text-white font-black underline decoration-indigo-500 underline-offset-4">35%</span> dari setiap mitra yang berlangganan aktif. Keuntungan berulang setiap bulan!
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link 
                href="/affiliate-register" 
                className="bg-indigo-600 text-white px-12 py-5 rounded-[24px] font-black text-xl hover:scale-105 hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-600/30 flex items-center justify-center gap-2 group"
              >
                Gabung sebagai Mitra
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                href="#how-it-works" 
                className="bg-white/5 backdrop-blur-md border border-white/10 px-12 py-5 rounded-[24px] font-black text-xl hover:bg-white/10 transition-all text-center"
              >
                Pelajari Lebih Lanjut
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-24">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Komisi Maksimal", value: "35%", icon: Coins, color: "text-amber-400" },
                { label: "Payout Real-Time", value: "H+28", icon: Clock, color: "text-indigo-400" },
                { label: "Recurring", value: "Tiap Bulan", icon: Activity, color: "text-emerald-400" },
                { label: "Kepuasan Partner", value: "9.9/10", icon: Trophy, color: "text-purple-400" },
              ].map((stat, i) => (
                <div key={i} className="group p-8 rounded-[40px] bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 transition-all">
                  <stat.icon className={cn("w-6 h-6 mb-6", stat.color)} />
                  <h3 className="text-4xl font-black mb-1 group-hover:scale-110 transition-transform origin-left">{stat.value}</h3>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pain Point Section - Problem vs Solution */}
        <section className="py-24 relative">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl md:text-5xl font-black mb-6 uppercase italic leading-none">
                  Peluang Besar di <br />
                  <span className="text-indigo-500">Industri Infrastruktur Digital.</span>
                </h2>
                <p className="text-white/40 font-medium text-lg mb-8 leading-relaxed">
                  Ribuan pengusaha RT/RW Net masih mencari cara untuk mengotomasi bisnis mereka. Jadilah solusi bagi mereka sambil membangun aset pendapatan digital Anda sendiri.
                </p>
                <ul className="space-y-4">
                  {[
                    "Kebutuhan Sistem Automasi yang Terus Meningkat",
                    "Produk yang Sudah Terbukti Membantu Banyak ISP",
                    "Peralatan Pemasaran (Marketing Kit) Siap Pakai",
                    "Sistem Pelacakan Komisi yang Transparan & Akurat"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 font-bold text-white/80">
                      <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative group">
                <div className="absolute inset-0 bg-indigo-600/20 blur-[80px] rounded-full group-hover:bg-indigo-600/30 transition-all duration-700" />
                <div className="relative p-8 md:p-12 rounded-[56px] bg-white/[0.03] border border-white/10 backdrop-blur-3xl">
                   <h4 className="text-2xl font-black mb-6">Misi Kami: <br />Memberdayakan Pengusaha Lokal 🚀</h4>
                   <p className="text-white/60 font-medium leading-relaxed mb-8">
                      Kami berdedikasi untuk memberikan solusi efisiensi di industri jaringan. Sebagai mitra, Anda bertindak sebagai penghubung teknologi yang membantu sesama pengusaha tumbuh lebih cepat lewat sistem kami.
                   </p>
                   <div className="flex -space-x-4">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="w-12 h-12 rounded-full border-4 border-[#070708] bg-white/10 flex items-center justify-center font-bold text-xs ring-2 ring-indigo-500/20">
                          ID
                        </div>
                      ))}
                      <div className="w-12 h-12 rounded-full border-4 border-[#070708] bg-indigo-600 flex items-center justify-center font-black text-[10px]">
                        +200
                      </div>
                   </div>
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-4 ml-2">Telah dipercaya oleh 200+ Pemilik Jaringan</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works - Simple 3 Steps */}
        <section id="how-it-works" className="py-24 bg-white/[0.01] border-y border-white/5">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-black mb-6 italic uppercase">Langkah Kemitraan yang Mudah.</h2>
              <p className="text-white/40 font-medium max-w-2xl mx-auto">Tiga langkah sederhana untuk mulai membangun pendapatan pasif Anda.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { 
                  step: "01", 
                  title: "Daftar Gratis", 
                  desc: "Lengkapi data diri di portal affiliate kami. Gak ada biaya serupiah-pun.",
                  icon: Users,
                  color: "indigo"
                },
                { 
                  step: "02", 
                  title: "Sebar Link Unik", 
                  desc: "Bagiin link referral lu ke grup komunitas, rekan pengusaha ISP, atau via sosmed.",
                  icon: MessageSquare,
                  color: "purple"
                },
                { 
                  step: "03", 
                  title: "Raih Keuntungan!", 
                  desc: "Setiap ada pembayaran transaksi dari mitra Anda, komisi hingga 35% akan otomatis masuk ke saldo Anda.",
                  icon: Wallet,
                  color: "emerald"
                }
              ].map((item, i) => (
                <div key={i} className="group relative p-10 rounded-[48px] bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 transition-all overflow-hidden">
                  <div className="absolute -right-4 -top-4 text-9xl font-black text-white/[0.02] group-hover:text-white/[0.04] transition-all font-mono italic">{item.step}</div>
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-10 shadow-xl", `bg-${item.color}-500/10 border border-${item.color}-500/20`)}>
                    <item.icon className={cn("w-7 h-7", `text-${item.color}-400`)} />
                  </div>
                  <h3 className="text-2xl font-black mb-4 uppercase">{item.title}</h3>
                  <p className="text-white/40 font-medium leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Commission Calculator / Illustration */}
        <section id="commission" className="py-24">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="p-12 md:p-20 rounded-[64px] bg-white/[0.02] border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 hidden md:block">
                 <Coins className="w-32 h-32 text-indigo-500/10 -rotate-12 group-hover:rotate-0 transition-all duration-1000" />
              </div>
              
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-6xl font-black mb-8 italic uppercase tracking-tighter">
                  Potensi Cuan <br /> 
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 underline decoration-indigo-500/50">Tanpa Batas!</span>
                </h2>
                
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 p-8 rounded-3xl bg-white/5 border border-white/10">
                       <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Kelola 5 Mitra Bisnis</p>
                       <p className="text-4xl font-black">Rp 1.050.000 <span className="text-[10px] text-white/40">/ Bulan</span></p>
                    </div>
                    <div className="flex-1 p-8 rounded-3xl bg-indigo-600 shadow-xl shadow-indigo-600/20">
                       <p className="text-[10px] font-black text-white/80 uppercase tracking-widest mb-2">Kelola 20 Mitra Pro</p>
                       <p className="text-4xl font-black text-white">Rp 5.250.000 <span className="text-[10px] text-white/80">/ Bulan</span></p>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-white/40 italic">
                    *Ilustrasi pendapatan pasif bulanan berdasarkan paket langganan aktif. Semakin banyak mitra Anda, persentase komisi akan meningkat hingga <span className="text-indigo-400 font-black">35%</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ - Simple & Relatable */}
        <section id="faq" className="py-24">
          <div className="container mx-auto max-w-3xl px-4">
            <h2 className="text-4xl font-black mb-16 text-center italic uppercase leading-tight">Pertanyaan Umum <br />Sekutar Program Kemitraan.</h2>
            <div className="space-y-6">
              {[
                { q: "Siapa saja yang dapat bergabung?", a: "Program ini terbuka untuk siapa saja, baik Anda teknisi jaringan, pengusaha, maupun pegiat media sosial. Yang terpenting adalah merekomendasikan solusi kami kepada mereka yang membutuhkan." },
                { q: "Bagaimana proses penarikan komisi?", a: "Komisi diberikan setelah transaksi dinyatakan valid. Anda dapat melakukan penarikan ke rekening bank Anda atau menggunakannya sebagai saldo pembayaran layanan." },
                { q: "Apakah data kemitraan saya terjamin?", a: "Tentu. Sistem kami sangat transparan, setiap aktivitas klik dan pendaftaran akan tercatat secara real-time di dashboard pribadi Anda." },
                { q: "Kapan pemberian komisi dihentikan?", a: "Komisi bersifat berkelanjutan selama mitra Anda tetap berlangganan aktif. Jika mitra berhenti berlangganan, maka pemberian komisi untuk mitra tersebut juga akan terhenti." }
              ].map((faq, i) => (
                <div key={i} className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
                  <h4 className="font-extrabold text-xl mb-3 flex items-start gap-4 uppercase italic tracking-tight">
                    <ArrowUpRight className="w-6 h-6 text-indigo-500 shrink-0" />
                    {faq.q}
                  </h4>
                  <p className="text-white/40 font-medium leading-relaxed pl-10 border-l border-white/5">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-12 md:p-24 rounded-[72px] bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none" />
              <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/10 blur-[150px] animate-pulse rounded-full" />
              
              <h2 className="text-5xl md:text-8xl font-black mb-10 italic uppercase leading-none tracking-tighter relative z-10">
                Mulai Kesuksesan <br />Bersama RRNET!
              </h2>
              <p className="text-xl md:text-2xl text-white/80 font-medium mb-16 max-w-2xl mx-auto relative z-10">
                Jangan lewatkan peluang besar ini. Bergabunglah sekarang untuk membangun aset digital Anda di industri jaringan.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
                <Link 
                  href="/affiliate-register" 
                  className="bg-white text-indigo-600 px-16 py-7 rounded-[32px] font-black text-2xl hover:bg-indigo-50 transition-all shadow-3xl hover:shadow-white/10"
                >
                  Bergabung Sebagai Mitra
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
