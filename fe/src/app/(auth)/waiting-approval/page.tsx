"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { 
  Clock, 
  CreditCard, 
  Wallet, 
  DollarSign, 
  Copy, 
  CheckCircle,
  Info,
  ArrowLeft,
  RefreshCcw,
  Ticket,
  Search,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";
import { useNotificationStore } from "@/stores/notificationStore";
import { paymentMethodService, PaymentMethod } from "@/lib/api/paymentMethodService";
import { tenantService } from "@/lib/api/tenantService";
import { platformDiscountService } from "@/lib/api/platformDiscountService";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { 
  Rocket, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  User as UserIcon, 
  Building2,
  X
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

export default function WaitingApprovalPage() {
  const router = useRouter();
  const { user, tenant, ready, logout } = useAuth();
  const { showToast } = useNotificationStore();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [discountCode, setDiscountCode] = useState("");
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    // Wait until auth is ready before checking redirects
    if (!ready) return;

    // If tenant is already approved, redirect to dashboard
    if (tenant?.status === "active") {
      router.push("/dashboard");
      return;
    }

    // If no user/tenant after ready, redirect to login
    if (!user || !tenant) {
      router.push("/login");
      return;
    }

    fetchData();
  }, [ready, tenant?.status, user, tenant, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPaymentMethods(),
        fetchInvoice(),
        fetchPlans()
      ]);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const methods = await paymentMethodService.listPublic();
      if (Array.isArray(methods)) {
        setPaymentMethods(methods.filter(m => m.is_active));
      } else {
        setPaymentMethods([]);
      }
    } catch (error) {
      console.error("Failed to fetch payment methods:", error);
    }
  };

  const fetchInvoice = async () => {
    try {
      const inv = await tenantService.getPendingInvoice();
      setInvoice(inv);
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
    }
  };

  const fetchPlans = async () => {
    setDataLoading(true);
    try {
      const [plansRes, configRes] = await Promise.all([
        fetch(`${API_URL}/plans/public?public=true&active=true`),
        fetch(`${API_URL}/public/site-settings/pricing`)
      ]);

      if (plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data.plans || data.data || []);
      }

      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data);
      }
    } catch (err) {
      console.error("Failed to fetch plans", err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleUpdatePlan = async (newPlanCode: string, cycle: string) => {
    setLoading(true);
    try {
      const updatedInvoice = await tenantService.updatePlan(newPlanCode, cycle);
      setInvoice(updatedInvoice);
      setBillingCycle(cycle as any);
      setIsChangingPlan(false);
      showToast("Layanan berhasil diubah!", "success");
    } catch (error: any) {
      showToast(error.message || "Gagal mengubah layanan", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim() || !invoice?.id) return;
    setApplyingDiscount(true);
    try {
      const updatedInv = await platformDiscountService.apply(invoice.id, discountCode);
      showToast("Discount code applied successfully!", "success");
      setInvoice(updatedInv);
    } catch (error: any) {
      showToast(error.message || "Invalid discount code", "error");
    } finally {
      setApplyingDiscount(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!", "success");
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!user || !tenant) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8"
        >
          {/* Main Content */}
          <div className="lg:col-span-7 space-y-6">
            {/* Header */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-4 text-center lg:text-left overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full -mr-32 -mt-32 group-hover:bg-amber-500/20 transition-all duration-700" />
              <div className="flex flex-col lg:flex-row items-center gap-6 relative z-10">
                <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.3)] shrink-0 rotate-3">
                  <Clock className="w-10 h-10 text-white -rotate-3" />
                </div>
                <div>
                  <h1 className="text-3xl font-black italic tracking-tighter text-white">AWAITING APPROVAL</h1>
                  <p className="text-amber-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2 justify-center lg:justify-start mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Account Review in Progress
                  </p>
                </div>
              </div>
            </div>


            {/* Account Info */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-5 hover:bg-white/10 transition-colors group">
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1 group-hover:text-amber-400/70 transition-colors">Company</p>
                <p className="font-bold text-white truncate">{tenant.company_name}</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
               <h3 className="font-black italic text-xl flex items-center gap-3 text-white">
                <span className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Info className="w-5 h-5 text-purple-400" />
                </span>
                WHAT'S NEXT?
              </h3>
              <div className="grid gap-4">
                {[
                  { id: 1, text: "Complete payment using available methods" },
                  { id: 2, text: "Our team will verify your payment & company info" },
                  { id: 3, text: "You'll receive WhatsApp/Email notification upon approval" },
                  { id: 4, text: "Start growing your business with RRNET dashboard!" }
                ].map((step) => (
                  <div key={step.id} className="flex gap-4 items-start p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-purple-500/30 transition-all duration-300">
                    <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-purple-400 shrink-0 mt-0.5 border border-white/10">
                      0{step.id}
                    </div>
                    <span className="text-sm text-slate-400 leading-relaxed">{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 text-slate-500 font-black italic uppercase text-xs hover:text-white transition-all group"
              >
                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-hover:border-white/30 group-hover:-translate-x-1 transition-all">
                  <ArrowLeft className="w-3.5 h-3.5" />
                </div>
                Logout
              </button>
              <button
                onClick={fetchData}
                disabled={loading}
                className="inline-flex items-center gap-3 px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black italic tracking-tighter uppercase rounded-2xl shadow-xl shadow-purple-900/20 transition-all active:scale-95 group"
              >
                {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />}
                Refresh Status
              </button>
            </div>
          </div>

          {/* Sidebar - Invoice & Payments */}
          <div className="lg:col-span-5 space-y-6">
            {/* Invoice Detail */}
            {invoice && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gradient-to-br from-indigo-950 to-purple-950 border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rotate-45 -mr-16 -mt-16" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Invoice Number</p>
                    <h2 className="text-2xl font-black italic tracking-tighter text-white">{invoice.invoice_number}</h2>
                  </div>
                  <div className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/30">
                    PENDING
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/10 relative z-10">
                  {invoice.discount_amount > 0 && (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 font-bold uppercase tracking-tighter">Subtotal</span>
                        <span className="text-white/60 line-through">
                          {formatCurrency(invoice.subtotal || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-emerald-400 font-bold uppercase tracking-tighter">Discount</span>
                        <span className="text-emerald-400 font-bold">
                          - {formatCurrency(invoice.discount_amount)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase tracking-tighter text-sm">Amount Due</span>
                    <span className="text-white font-black text-2xl italic">
                      {formatCurrency(invoice.amount)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-2xl p-4">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Plan</p>
                        <button 
                          onClick={() => setIsChangingPlan(true)}
                          className="text-[10px] text-purple-400 font-black hover:text-purple-300 transition-colors uppercase tracking-widest flex items-center gap-1"
                        >
                          <RefreshCcw className="w-2.5 h-2.5" />
                          Change
                        </button>
                      </div>
                      <p className="font-bold text-white text-sm uppercase tracking-tighter">
                        {invoice.plan_name || 'PRIME PLAN'} 
                        {invoice.period_start && invoice.period_end && (
                          <span className="text-purple-400 ml-1">
                            • {new Date(invoice.period_end).getTime() - new Date(invoice.period_start).getTime() > 32 * 24 * 60 * 60 * 1000 ? 'YEARLY' : 'MONTHLY'}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4">
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Due Date</p>
                      <p className="font-bold text-white text-sm uppercase tracking-tighter">{formatDate(invoice.due_date)}</p>
                    </div>
                  </div>
                </div>

                {/* Discount Form */}
                <div className="pt-6 mt-4 border-t border-white/10 relative z-10">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Have a discount code?</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        placeholder="COUPON CODE"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-slate-700"
                      />
                    </div>
                    <button
                      onClick={handleApplyDiscount}
                      disabled={applyingDiscount || !discountCode || invoice.discount_id}
                      className="px-4 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 border border-white/10 rounded-xl transition-all group"
                    >
                      {applyingDiscount ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-purple-400 group-hover:scale-110" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Payment Methods */}
            <div className="bg-black/20 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0">
                  <Wallet className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Payment Methods</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-none mt-1">Select your preferred way to pay</p>
                </div>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-600">
                  <RefreshCcw className="w-8 h-8 animate-spin opacity-20" />
                  <p className="text-xs font-black uppercase tracking-widest">Loading Methods...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentMethods.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm italic bg-white/5 rounded-3xl border border-dashed border-white/10">
                      No payment methods available.
                    </div>
                  ) : (
                    paymentMethods.map((method) => (
                      <div key={method.id} className="bg-white/5 border border-white/5 rounded-3xl p-5 hover:bg-white/[0.07] transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110",
                            method.category === "bank" ? "bg-blue-500/20 text-blue-400" : 
                            method.category === "e-wallet" ? "bg-emerald-500/20 text-emerald-400" : 
                            method.category === "pay later" ? "bg-purple-500/20 text-purple-400" :
                            "bg-amber-500/20 text-amber-400"
                          )}>
                            {method.category === "bank" ? <CreditCard className="w-6 h-6" /> : 
                             method.category === "e-wallet" ? <Wallet className="w-6 h-6" /> : 
                             method.category === "pay later" ? <Zap className="w-6 h-6" /> :
                             <DollarSign className="w-6 h-6" />}
                          </div>
                          <div>
                            <h4 className="font-black italic text-white uppercase tracking-tighter leading-none group-hover:text-purple-400 transition-colors">{method.name}</h4>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">{method.provider}</p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {method.account_number && (
                            <div className="flex justify-between items-center p-3 py-1.5 rounded-xl bg-black/40 border border-white/5">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {method.category === "bank" ? "Account" : "Number"}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-white text-sm">{method.account_number}</span>
                                <button
                                  onClick={() => copyToClipboard(method.account_number!)}
                                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                                </button>
                              </div>
                            </div>
                          )}
                          {method.account_name && (
                            <div className="flex justify-between items-center p-3 py-1.5 hover:bg-black/20 rounded-xl transition-colors">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Name</span>
                              <span className="font-bold text-white text-sm truncate max-w-[150px]">{method.account_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isChangingPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter text-white">GANTI LAYANAN</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Pilih paket yang sesuai untuk bisnis anda</p>
                </div>
                <button 
                  onClick={() => setIsChangingPlan(false)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Billing Toggle */}
                <div className="flex justify-center">
                  <div className="bg-black/40 p-1.5 rounded-2xl border border-white/5 flex gap-1 relative">
                    <button
                      onClick={() => setBillingCycle("monthly")}
                      className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative z-10",
                        billingCycle === "monthly" ? "text-white" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Bulanan
                    </button>
                    <button
                      onClick={() => setBillingCycle("yearly")}
                      className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative z-10",
                        billingCycle === "yearly" ? "text-white" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Tahunan
                      <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] px-1.5 py-0.5 rounded-full animate-bounce">
                        -{config?.yearly_discount || 20}%
                      </span>
                    </button>
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-y-1.5 bg-purple-600 rounded-xl shadow-lg shadow-purple-900/40"
                      initial={false}
                      animate={{
                        x: billingCycle === "monthly" ? 0 : "100%",
                        width: "50%"
                      }}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  </div>
                </div>

                <div className="grid gap-4">
                  {dataLoading ? (
                    <div className="py-20 flex justify-center">
                      <RefreshCcw className="w-8 h-8 animate-spin text-purple-500 opacity-20" />
                    </div>
                  ) : (
                    plans
                      .filter(p => !config?.plans?.length || config.plans.includes(p.id))
                      .map((p) => {
                        const isYearly = billingCycle === "yearly";
                        const planDiscount = config?.yearly_discount ?? 20;
                        const price = isYearly 
                          ? (p.price_yearly ? p.price_yearly / 12 : p.price_monthly * (1 - planDiscount / 100)) 
                          : p.price_monthly;
                        
                        const isPopular = config?.popular_plan_id ? p.id === config.popular_plan_id : (p.code === 'pro');

                        return (
                          <button
                            key={p.id}
                            disabled={loading}
                            onClick={() => handleUpdatePlan(p.code, billingCycle)}
                            className={cn(
                              "w-full p-6 rounded-3xl border transition-all duration-300 flex items-center justify-between relative overflow-hidden group text-left",
                              "bg-white/[0.02] border-white/5 hover:border-purple-500/50 hover:bg-white/5 outline-none focus:ring-2 focus:ring-purple-500/50",
                              loading && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className="relative z-10 flex gap-4 items-center">
                              <div className={cn(
                                "w-14 h-14 rounded-2xl bg-gradient-to-tr flex items-center justify-center shadow-lg", 
                                p.code === 'basic' ? "from-blue-500 to-cyan-500" : 
                                p.code === 'pro' ? "from-purple-600 to-indigo-600" :
                                "from-amber-500 to-orange-600"
                              )}>
                                <Rocket className="text-white w-7 h-7" />
                              </div>
                              <div>
                                <h4 className="font-black italic text-xl tracking-tighter text-white uppercase flex items-center gap-2">
                                  {p.name}
                                  {isPopular && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500 text-white font-black uppercase tracking-widest border border-purple-400/50">TERLARIS</span>}
                                </h4>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">{p.description}</p>
                              </div>
                            </div>
                            <div className="text-right relative z-10">
                              <span className="text-2xl font-black italic tracking-tighter text-white">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price).replace('Rp', '')}k
                              </span>
                              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">{isYearly ? "/bln (tahunan)" : "/bulan"}</span>
                            </div>

                            {loading && p.id === invoice.plan_id && (
                              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                                <RefreshCcw className="w-6 h-6 animate-spin text-purple-400" />
                              </div>
                            )}
                          </button>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="p-8 bg-black/40 border-t border-white/10 text-center">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Harga di atas belum termasuk PPN 11% jika berlaku</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
