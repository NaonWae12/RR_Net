"use client";

import { motion } from "framer-motion";
import { 
  ArrowRight, 
  Zap, 
  Shield, 
  BarChart3, 
  Globe, 
  MessageSquare, 
  CreditCard,
  CheckCircle2,
  TrendingUp,
  Cpu,
  Layers
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { useEffect, useState } from "react";
import { Plan, LandingPagePricing } from "@/lib/api/types";

export default function LandingPageClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [config, setConfig] = useState<LandingPagePricing | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [randomHeights, setRandomHeights] = useState<number[]>(Array(12).fill(40));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
        
        const [plansRes, configRes] = await Promise.all([
          fetch(`${apiURL}/plans/public?public=true&active=true`),
          fetch(`${apiURL}/public/site-settings/pricing`)
        ]);

        if (plansRes.ok) {
          const data = await plansRes.json();
          // Backend returns { plans: [], total: 0 }, not { data: [] }
          setPlans(data.plans || data.data || []);
        }

        if (configRes.ok) {
          const data = await configRes.json();
          setConfig(data);
        }
      } catch (err) {
        console.error("Failed to fetch landing data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    setRandomHeights(Array.from({ length: 12 }).map(() => 20 + Math.random() * 60));
  }, []);

  // Filter plans based on config
  let displayedPlans = plans;
  if (config?.plans?.length) {
    const filtered = plans.filter(p => config.plans.includes(p.id));
    if (filtered.length > 0) {
      displayedPlans = filtered;
    }
  }
  
  displayedPlans = displayedPlans.slice(0, config?.display_count || 3);

  const showToggle = config ? (config.show_monthly && config.show_yearly) : true;
  const initialYearly = config ? (!config.show_monthly && config.show_yearly) : false;

  // Use effective billing cycle
  const effectiveYearly = showToggle ? isYearly : initialYearly;

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32">
        {/* Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 overflow-hidden">
          <div className="absolute top-[-10%] left-[10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[10%] right-[10%] w-[35%] h-[35%] bg-cyan-500/10 blur-[100px] rounded-full" />
        </div>

        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              Next-Gen ISP Management
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]"
            >
              Scale Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500">ISP Business</span> with Intelligent Automation
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed"
            >
              RRNET provides the ultimate toolkit for network providers. Automated 
              billing, integrated WhatsApp gateway, and advanced network controls 
              all in one premium dashboard.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            >
              <Link 
                href="/register?plan=basic" 
                className="bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-2xl shadow-primary/20 flex items-center justify-center gap-2 group"
              >
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                href="#pricing" 
                className="bg-secondary/50 backdrop-blur-sm border border-border px-8 py-4 rounded-2xl font-bold text-lg hover:bg-secondary transition-colors text-center"
              >
                View Plans
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
            <div className="aspect-[16/9] rounded-3xl overflow-hidden bg-gradient-to-br from-purple-900/40 to-black border border-white/10 shadow-[0_0_50px_-12px_rgba(168,85,247,0.4)] relative group">
              <div className="absolute top-[10%] left-[5%] w-[30%] h-[40%] bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 transform -rotate-3 group-hover:-rotate-1 transition-transform duration-700">
                 <div className="w-12 h-2 bg-white/20 rounded mb-4" />
                 <div className="space-y-3">
                   <div className="h-6 bg-gradient-to-r from-purple-500/40 to-purple-500/10 rounded w-full" />
                   <div className="h-4 bg-white/10 rounded w-[80%]" />
                   <div className="h-4 bg-white/10 rounded w-[60%]" />
                 </div>
              </div>
              
              <div className="absolute bottom-[15%] right-[5%] w-[35%] h-[50%] bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 transform rotate-3 group-hover:rotate-1 transition-transform duration-700 delay-100">
                 <div className="flex items-center gap-2 mb-4">
                   <div className="w-10 h-10 rounded-full bg-cyan-500/20" />
                   <div className="h-3 bg-white/20 rounded w-24" />
                 </div>
                 <div className="h-32 bg-gradient-to-t from-cyan-500/20 to-transparent rounded-xl w-full" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
            </div>
            
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/30 rounded-full blur-[60px]" />
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/30 rounded-full blur-[60px]" />
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 italic tracking-tight uppercase">Platform Capabilities</h2>
            <div className="w-20 h-1.5 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Zap, title: "Edge Automation", desc: "Provision clients instantly on MikroTik, Cisco, and OLT devices with Zero-Touch configuration.", color: "purple" },
              { icon: MessageSquare, title: "WA Gateway", desc: "Reach customers where they are. Automated billing notifications and ticket updates via WhatsApp.", color: "cyan" },
              { icon: CreditCard, title: "LTM Billing", desc: "Lifetime billing cycle management with integrated payment gateways and automated reconnect.", color: "indigo" },
              { icon: BarChart3, title: "Deep Analytics", desc: "Gain insights into network performance, bandwidth saturation, and customer churn metrics.", color: "rose" }
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-8 rounded-[32px] bg-secondary/30 border border-border hover:border-purple-500/50 transition-all duration-300 group"
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-300",
                  f.color === "purple" && "bg-purple-500/10 text-purple-500",
                  f.color === "cyan" && "bg-cyan-500/10 text-cyan-500",
                  f.color === "indigo" && "bg-indigo-500/10 text-indigo-500",
                  f.color === "rose" && "bg-rose-500/10 text-rose-500"
                )}>
                  <f.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-4">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section id="solutions" className="py-24 bg-white/[0.02] border-y border-white/5 relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight uppercase italic">
                Solusi Cerdas untuk <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">ISP Masa Depan.</span>
              </h2>
              <div className="space-y-8">
                {[
                  { title: "Otomasi Tanpa Batas", desc: "Kurangi kerja manual hingga 80% dengan integrasi API MikroTik & OLT yang presisi.", icon: Cpu },
                  { title: "Auto-Isolir & Reconnect", desc: "Pastikan cashflow lancar dengan sistem blokir otomatis bagi pelanggan yang jatuh tempo.", icon: Shield },
                  { title: "Skalabilitas Enterprise", desc: "Kelola dari 100 hingga 100,000 pelanggan tanpa penurunan performa sistem.", icon: Layers }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6 items-start group">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-purple-500/50 transition-all">
                      <item.icon className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                      <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-square rounded-[40px] bg-gradient-to-tr from-purple-600/20 to-cyan-500/20 border border-white/10 overflow-hidden relative group">
                <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:scale-110 transition-transform duration-1000">
                  <Globe className="w-64 h-64 text-white/10 animate-[spin_30s_linear_infinite]" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-8 left-8 right-8 p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                   <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-2">Live Insight</p>
                   <h4 className="text-2xl font-bold mb-4 italic">Visualisasikan Pertumbuhan ISP Anda.</h4>
                   <div className="flex gap-2 items-end h-[80px]">
                     {randomHeights.map((h, i) => (
                       <div key={i} className="flex-1 bg-white/10 rounded-full transition-all duration-1000" style={{ height: `${h}px` }} />
                     ))}
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Affiliate Teaser */}
      <section id="affiliate" className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6">
          <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 rounded-[40px] border border-white/5 p-8 md:p-16 relative">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-6"
                >
                  New Program
                </motion.div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">Join the <span className="text-cyan-500">RRNET Affiliate</span> Program</h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  Earn recurring commission by introducing RRNET to your network. 
                  Help other ISP providers thrive while building your own revenue stream.
                </p>
                <div className="space-y-4 mb-10">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-cyan-500 w-5 h-5 flex-shrink-0" />
                    <span>20% Recurring lifetime commission</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-cyan-500 w-5 h-5 flex-shrink-0" />
                    <span>Real-time dashboard to track your earnings</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-cyan-500 w-5 h-5 flex-shrink-0" />
                    <span>Dedicated support for our partners</span>
                  </div>
                </div>
                <Link 
                  href="/affiliate"
                  className="bg-cyan-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-cyan-500/20 inline-block text-center"
                >
                  Become a Partner
                </Link>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-full bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 flex items-center justify-center p-12">
                   <div className="w-full h-full rounded-full border border-dashed border-cyan-500/30 animate-[spin_60s_linear_infinite]" />
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className="p-8 rounded-3xl bg-secondary backdrop-blur-xl border border-border shadow-2xl relative overflow-hidden">
                       <TrendingUp className="w-20 h-20 text-cyan-500" />
                       <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-purple-500/20 rounded-full blur-xl" />
                     </div>
                   </div>
                   <Globe className="absolute top-10 right-10 text-cyan-500/40 w-8 h-8 animate-bounce" />
                   <Zap className="absolute bottom-20 left-10 text-purple-500/40 w-6 h-6 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black mb-6 italic tracking-tighter uppercase">Transparent Pricing</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
              Choose the tier that fits your network size. No hidden fees, cancel anytime.
            </p>

            {showToggle && (
              <div className="flex items-center justify-center gap-4 mb-8">
                <span className={cn("text-sm font-bold transition-colors", !isYearly ? "text-foreground" : "text-muted-foreground")}>Monthly</span>
                <button 
                  onClick={() => setIsYearly(!isYearly)}
                  className="w-14 h-8 rounded-full bg-secondary border border-border p-1 relative transition-colors hover:border-primary/50"
                >
                  <motion.div 
                    animate={{ x: isYearly ? 24 : 0 }}
                    className="w-6 h-6 rounded-full bg-primary shadow-lg shadow-primary/20" 
                  />
                </button>
                <span className={cn("text-sm font-bold transition-colors text-emerald-500 flex items-center gap-2", isYearly ? "opacity-100" : "opacity-60")}>
                  Yearly
                  <span className="text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest">Save {config?.yearly_discount ?? 20}%</span>
                </span>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[500px] rounded-[40px] bg-secondary/20 animate-pulse border border-border" />
              ))
            ) : (
              displayedPlans.map((p, i) => {
                const planDiscount = config?.yearly_discount ?? 20;
                const price = effectiveYearly ? (p.price_yearly ? p.price_yearly / 12 : p.price_monthly * (1 - planDiscount / 100)) : p.price_monthly;
                const features = p.features || [];
                const isPopular = config?.popular_plan_id ? p.id === config.popular_plan_id : (p.code === 'pro' || p.code === 'business');

                return (
                  <motion.div 
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    viewport={{ once: true }}
                    className={cn(
                      "p-10 rounded-[40px] border relative transition-all duration-300 group",
                      isPopular 
                        ? "bg-foreground text-background md:scale-105 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.3)] z-10" 
                        : "bg-secondary/40 border-border hover:border-foreground/20 hover:bg-secondary/60"
                    )}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                        Most Popular
                      </div>
                    )}
                    <h3 className="text-2xl font-bold mb-2">{p.name}</h3>
                    <div className="mb-2">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50">{p.code}</p>
                    </div>
                    <div className="mb-8 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price).replace('Rp', '')}k
                      </span>
                      <span className="text-sm opacity-60">/mo</span>
                    </div>
                    
                    <ul className="space-y-4 mb-10 min-h-[200px]">
                      {features.slice(0, 6).map((f, j) => (
                        <li key={j} className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className={cn("w-5 h-5 flex-shrink-0", isPopular ? "text-background" : "text-primary")} />
                          <span className="line-clamp-1">{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Link 
                      href={`/register?plan=${p.code}&billing=${effectiveYearly ? 'yearly' : 'monthly'}`}
                      className={cn(
                        "block w-full py-4 rounded-2xl font-bold text-center transition-all active:scale-95",
                        isPopular 
                          ? "bg-background text-foreground hover:opacity-90" 
                          : "bg-foreground text-background hover:bg-foreground/10 hover:text-foreground"
                      )}
                    >
                      Get Started
                    </Link>
                  </motion.div>
                );
              })
            )}

            {!loading && displayedPlans.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-muted-foreground italic">No public plans available at the moment.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 -z-10" />
        <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-4xl md:text-6xl font-bold mb-10">Ready to <span className="text-purple-600">Revolutionize</span> Your ISP?</h2>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link href="/register?plan=pro" className="bg-primary text-primary-foreground px-10 py-5 rounded-3xl font-bold text-xl hover:scale-105 transition-transform flex items-center gap-3">
                Start 14-Day Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/contact" className="text-xl font-medium border-b-2 border-primary/20 hover:border-primary transition-all">
                Talk to Sales
              </Link>
            </div>
            <p className="mt-10 text-muted-foreground">Join 150+ network providers scaling with RRNET.</p>
        </div>
      </section>
    </div>
  );
}
