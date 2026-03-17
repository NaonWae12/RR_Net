"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Rocket, 
  ArrowRight, 
  Check, 
  ShieldCheck, 
  Zap, 
  Building2, 
  Mail, 
  Lock, 
  User,
  CheckCircle2,
  Globe,
  ArrowLeft,
  Key,
  Info,
  RefreshCcw,
  Phone,
  MessageSquare,
  CreditCard,
  Wallet,
  DollarSign,
  Copy,
  CheckCircle,
  Ticket,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";
import { useNotificationStore } from "@/stores/notificationStore";
import { paymentMethodService, PaymentMethod } from "@/lib/api/paymentMethodService";
import { platformDiscountService } from "@/lib/api/platformDiscountService";
import { tenantService } from "@/lib/api/tenantService";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useNotificationStore();
  const { setAuth } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [formData, setFormData] = useState({
    plan: "pro", // default to pro
    billing: "monthly",
    name: "",
    email: "",
    phone: "",
    password: "",
    companyName: "",
    slug: "",
  });
  const [otp, setOtp] = useState("");
  const [regResponse, setRegResponse] = useState<any>(null);
  const [timer, setTimer] = useState(60);
  const [isOAuth, setIsOAuth] = useState(false); // Track if user came from OAuth
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);

  // Fetch payment methods when reaching success step
  useEffect(() => {
    if (step === 5) {
      fetchPaymentMethods();
    }
  }, [step]);

  const fetchPaymentMethods = async () => {
    try {
      const methods = await paymentMethodService.listPublic();
      console.log("Fetched methods:", methods);
      
      if (Array.isArray(methods)) {
        setPaymentMethods(methods.filter(m => m.is_active));
      } else {
        console.error("Payment methods response is not an array:", methods);
        setPaymentMethods([]);
      }
    } catch (error) {
      console.error("Failed to fetch payment methods:", error);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 4 && timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // Handle OAuth pre-fill
  useEffect(() => {
    const oauthEmail = searchParams.get("email");
    const oauthName = searchParams.get("name");
    const oauthProvider = searchParams.get("oauth_provider");
    const oauthId = searchParams.get("oauth_id");
    
    if (oauthEmail && oauthProvider) {
      setIsOAuth(true);
      setFormData(prev => ({
        ...prev,
        email: oauthEmail,
        name: oauthName || prev.name,
        // Set a random password for OAuth users (backend won't use it)
        password: Math.random().toString(36).slice(-10) + "!" + Math.random().toString(36).slice(-10)
      }));
      setStep(3); // Skip to organization details
      showToast("Signed in with Google. Let's complete your organization setup!", "success");
    }
  }, [searchParams, showToast]);

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const handleRegister = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/tenants/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_code: formData.plan,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          company_name: formData.companyName,
          slug: formData.slug,
          is_oauth: isOAuth,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      // Store response for later use
      setRegResponse(data);
      
      // If OAuth user, skip OTP and go directly to success
      if (isOAuth) {
        // Set auth immediately for OAuth users (email already verified by Google)
        setAuth(data.user, data.tenant, data.access_token, data.refresh_token);
        showToast("Registration successful! Welcome aboard!", "success");
        setStep(5); // Go to success step
      } else {
        // Regular users need OTP verification
        showToast("Data registrasi diterima. Silakan cek WhatsApp untuk kode OTP.", "success");
        setStep(4); // Move to OTP step
        setTimer(60);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      showToast(err.message || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/tenants/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          code: otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      showToast("WhatsApp berhasil diverifikasi!", "success");

      // Now we can set auth and move to final step
      if (regResponse) {
        setAuth(regResponse.user, regResponse.tenant, regResponse.access_token, regResponse.refresh_token);
      }
      
      setStep(5);
    } catch (err: any) {
      setError(err.message || "Kode OTP salah");
      showToast(err.message || "Verifikasi gagal", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer > 0) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/tenants/resend-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
        }),
      });

      if (response.ok) {
        showToast("OTP baru telah dikirim ke WhatsApp!", "success");
        setTimer(60);
        setOtp("");
      } else {
        const data = await response.json();
        throw new Error(data.error || "Gagal kirim ulang OTP");
      }
    } catch (err: any) {
      showToast(err.message || "Gagal mengirim ulang OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  // Validate email availability
  const validateEmail = async (email: string) => {
    if (!email || isOAuth) return; // Skip validation for OAuth users
    
    setCheckingEmail(true);
    try {
      const response = await fetch(`${API_URL}/validation/email?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      setEmailAvailable(data.available);
    } catch (err) {
      console.error("Failed to validate email:", err);
      setEmailAvailable(null);
    } finally {
      setCheckingEmail(false);
    }
  };

  // Validate phone availability
  const validatePhone = async (phone: string) => {
    if (!phone) return;
    
    setCheckingPhone(true);
    try {
      const response = await fetch(`${API_URL}/validation/phone?phone=${encodeURIComponent(phone)}`);
      const data = await response.json();
      setPhoneAvailable(data.available);
    } catch (err) {
      console.error("Failed to validate phone:", err);
      setPhoneAvailable(null);
    } finally {
      setCheckingPhone(false);
    }
  };

  const handleUpdatePlan = async (newPlanCode: string, cycle: string) => {
    setLoading(true);
    try {
      const updatedInvoice = await tenantService.updatePlan(newPlanCode, cycle);
      setRegResponse({ ...regResponse, invoice: updatedInvoice });
      setFormData({ ...formData, plan: newPlanCode, billing: cycle as any });
      setIsChangingPlan(false);
      showToast("Layanan berhasil diubah!", "success");
    } catch (error: any) {
      showToast(error.message || "Gagal mengubah layanan", "error");
    } finally {
      setLoading(false);
    }
  };

  // Validate slug availability
  const validateSlug = async (slug: string) => {
    if (!slug) return;
    
    setCheckingSlug(true);
    try {
      const response = await fetch(`${API_URL}/validation/slug?slug=${encodeURIComponent(slug)}`);
      const data = await response.json();
      setSlugAvailable(data.available);
    } catch (err) {
      console.error("Failed to validate slug:", err);
      setSlugAvailable(null);
    } finally {
      setCheckingSlug(false);
    }
  };


  // Debounced email validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.email && step === 2 && !isOAuth) {
        validateEmail(formData.email);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.email, step, isOAuth]);

  // Debounced phone validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.phone && step === 3) {
        validatePhone(formData.phone);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.phone, step]);

  // Debounced slug validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.slug && step === 3) {
        validateSlug(formData.slug);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.slug, step]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansRes, configRes] = await Promise.all([
          fetch(`${API_URL}/plans/public?public=true&active=true`),
          fetch(`${API_URL}/public/site-settings/pricing`)
        ]);

        let fetchedPlans = [];
        let fetchedConfig = null;

        if (plansRes.ok) {
          const data = await plansRes.json();
          fetchedPlans = data.plans || data.data || [];
          setPlans(fetchedPlans);
        }

        if (configRes.ok) {
          fetchedConfig = await configRes.json();
          setConfig(fetchedConfig);
        }

        // Initialize from query params
        const qPlan = searchParams.get("plan");
        const qBilling = searchParams.get("billing") || "monthly";
        
        // Find plan by code or id from URL
        let initialPlan = fetchedPlans.find(p => p.code === qPlan || p.id === qPlan);
        
        // If not found in URL, try popular_plan_id from config
        if (!initialPlan && fetchedConfig?.popular_plan_id) {
          initialPlan = fetchedPlans.find(p => p.id === fetchedConfig.popular_plan_id || p.code === fetchedConfig.popular_plan_id);
        }

        // If still not found, use first available plan
        if (!initialPlan && fetchedPlans.length > 0) {
          initialPlan = fetchedPlans[0];
        }
        
        setFormData(prev => ({
          ...prev,
          plan: initialPlan ? initialPlan.code : "pro",
          billing: qBilling
        }));

      } catch (err) {
        console.error("Failed to fetch register data", err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [searchParams]);

  const steps = [
    { id: 1, title: "Choose Plan", icon: Rocket },
    { id: 2, title: "Account Info", icon: User },
    { id: 3, title: "Organization", icon: Building2 },
    { id: 4, title: "Ready!", icon: CheckCircle2 },
  ];

  // No hardcoded plans needed anymore

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex overflow-hidden relative">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 right-0 w-[50%] h-full bg-gradient-to-l from-purple-600/10 to-transparent -z-10" />
      <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-cyan-500/5 blur-[120px] rounded-full -z-10" />

      {/* Left Sidebar - Marketing/Info (Visible on Desktop) */}
      <div className="hidden lg:flex w-1/3 p-12 flex-col justify-between border-r border-white/5 bg-white/[0.02] backdrop-blur-3xl relative">
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2 mb-16 group">
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
              <Zap className="text-white w-6 h-6 fill-current" />
            </div>
            <span className="text-2xl font-bold tracking-tight">RRNET</span>
          </Link>

          <h2 className="text-4xl font-extrabold leading-tight mb-8">
            Build the future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Connectivity.</span>
          </h2>

          <div className="space-y-8">
            {[
              { 
                title: "Unified Infrastructure", 
                desc: "Manage billing, networking, and clients in one place.",
                icon: ShieldCheck
              },
              { 
                title: "Scale Without Limits", 
                desc: "Designed for providers of all sizes, from local ISPs to large networks.",
                icon: Rocket 
              },
              { 
                title: "Smart Automation", 
                desc: "Focus on growth while we handle the repetitive tasks.",
                icon: Zap 
              }
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:bg-white/10 transition-colors">
                  <item.icon className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">{item.title}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm text-muted-foreground italic border-t border-white/5 pt-8">
          "The most powerful tool for modern network providers." — RRNET Core Team
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-grow flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Zap className="text-white w-5 h-5 fill-current" />
                </div>
                <span className="text-xl font-bold">RRNET</span>
             </div>
          </div>

          {/* Stepper Progress */}
          <div className="flex items-center justify-between mb-12 px-2 relative">
             <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/5 -translate-y-1/2 -z-10" />
             {steps.map((s) => (
               <div key={s.id} className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2",
                    step >= s.id 
                      ? "bg-purple-600 border-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.5)]" 
                      : "bg-[#0a0a0b] border-white/10"
                  )}>
                    {step > s.id ? <Check className="w-6 h-6" /> : <s.icon className="w-5 h-5" />}
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    step >= s.id ? "text-purple-400" : "text-white/30"
                  )}>
                    {s.title}
                  </span>
               </div>
             ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-3xl font-bold mb-2">Pilih Paket</h1>
                  <p className="text-muted-foreground">Sesuaikan dengan kebutuhan bisnis ISP anda.</p>
                </div>

                <div className="space-y-3">
                  {dataLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-20 w-full rounded-[24px] bg-white/[0.02] animate-pulse border border-white/5" />
                    ))
                  ) : (
                    plans
                      .filter(p => !config?.plans?.length || config.plans.includes(p.id))
                      .slice(0, config?.display_count || 6)
                      .map((p) => {
                        const isSelected = formData.plan === p.code || formData.plan === p.id;
                        const isYearly = formData.billing === "yearly";
                        const planDiscount = config?.yearly_discount ?? 20;
                        const price = isYearly 
                          ? (p.price_yearly ? p.price_yearly / 12 : p.price_monthly * (1 - planDiscount / 100)) 
                          : p.price_monthly;
                        
                        const isPopular = config?.popular_plan_id ? p.id === config.popular_plan_id : (p.code === 'pro');

                        return (
                          <button
                            key={p.id}
                            onClick={() => setFormData({...formData, plan: p.code})}
                            className={cn(
                              "w-full p-5 rounded-[24px] border transition-all duration-300 flex items-center justify-between relative overflow-hidden group text-left",
                              isSelected 
                                ? "bg-white/5 border-purple-500 ring-4 ring-purple-500/10" 
                                : "bg-white/[0.02] border-white/5 hover:border-white/20"
                            )}
                          >
                            <div className="relative z-10 flex gap-4 items-center">
                              <div className={cn(
                                "w-12 h-12 rounded-2xl bg-gradient-to-tr flex items-center justify-center shadow-lg", 
                                p.code === 'basic' ? "from-blue-500 to-cyan-500" : 
                                p.code === 'pro' ? "from-purple-600 to-indigo-600" :
                                "from-amber-500 to-orange-600"
                              )}>
                                <Rocket className="text-white w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="font-bold flex items-center gap-2 text-white">
                                  {p.name}
                                  {isPopular && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500 text-white font-black uppercase">BEST SELLER</span>}
                                </h4>
                                <p className="text-xs text-muted-foreground">{p.description}</p>
                              </div>
                            </div>
                            <div className="text-right relative z-10">
                              <span className="text-lg font-black text-white">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price).replace('Rp', '')}k
                              </span>
                              <span className="text-[10px] opacity-40 block">{isYearly ? "/bln (tahunan)" : "/bulan"}</span>
                            </div>

                            {isSelected && (
                              <div className="absolute top-0 right-0 p-2">
                                <CheckCircle2 className="text-purple-500 w-5 h-5" />
                              </div>
                            )}
                          </button>
                        );
                      })
                  )}
                </div>

                <button 
                  onClick={nextStep}
                  disabled={dataLoading || !plans.some(p => p.code === formData.plan || p.id === formData.plan)}
                  className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-xl flex items-center justify-center gap-2 group mt-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Confirm & Continue
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
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
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={prevStep} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h1 className="text-3xl font-bold">Account Info</h1>
                    <p className="text-muted-foreground text-sm">Join the elite network providers today.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* OAuth Options */}
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={() => {
                        const params = new URLSearchParams({
                          plan: formData.plan,
                          billing: formData.billing
                        });
                        window.location.assign(`${API_URL}/auth/google/login?state=${encodeURIComponent(params.toString())}`);
                      }}
                      className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 py-4 rounded-2xl hover:bg-white/10 transition-all font-medium text-sm group"
                    >
                      <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Sign up with Google
                    </button>
                  </div>

                  <div className="flex items-center gap-4 py-2">
                    <div className="h-px bg-white/5 flex-grow" />
                    <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold">OR EMAIL</span>
                    <div className="h-px bg-white/5 flex-grow" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Full Name</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="Johnny Bravo"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Email Address</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        type="email" 
                        placeholder="johnny@awesome.com"
                        className={cn(
                          "w-full bg-white/5 border rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 transition-all text-sm",
                          emailAvailable === false ? "border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50" :
                          emailAvailable === true ? "border-green-500/50 focus:ring-green-500/50 focus:border-green-500/50" :
                          "border-white/10 focus:ring-purple-500/50 focus:border-purple-500/50"
                        )}
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        disabled={isOAuth}
                      />
                      {checkingEmail && (
                        <RefreshCcw className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin" />
                      )}
                      {!checkingEmail && emailAvailable === true && (
                        <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                      )}
                      {!checkingEmail && emailAvailable === false && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          <span className="text-xs text-red-400">Already registered</span>
                        </div>
                      )}
                    </div>
                  </div>



                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        type="password" 
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={nextStep}
                  disabled={
                    !formData.name || 
                    !formData.email || 
                    !formData.password || 
                    formData.password.length < 8 ||
                    emailAvailable === false ||
                    checkingEmail
                  }
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-4 rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-xl shadow-purple-500/20 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Continue
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
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
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={prevStep} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-3xl font-bold font-heading italic uppercase tracking-tighter">Your Organization</h1>
                </div>

                {isOAuth && (
                  <div className="flex items-center gap-3 mb-6 p-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                      <User className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-xs">
                      <p className="text-slate-500 uppercase font-black tracking-widest text-[9px]">Signed in as</p>
                      <p className="text-white font-bold">{formData.email}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Legal Company Name</label>
                    <div className="relative group">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="Acme Wireless Corp"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                        value={formData.companyName}
                        onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Workspace URL  (Tenant Slug)</label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="acme-net"
                        className={cn(
                          "w-full bg-white/5 border rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 transition-all font-mono lowercase text-sm",
                          slugAvailable === false ? "border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50" :
                          slugAvailable === true ? "border-green-500/50 focus:ring-green-500/50 focus:border-green-500/50" :
                          "border-white/10 focus:ring-purple-500/50 focus:border-purple-500/50"
                        )}
                        value={formData.slug}
                        onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/ /g, "-")})}
                      />
                      {checkingSlug && (
                        <RefreshCcw className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin" />
                      )}
                      {!checkingSlug && slugAvailable === true && (
                        <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                      )}
                      {!checkingSlug && slugAvailable === false && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          <span className="text-xs text-red-400 font-sans">Taken</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground ml-1">
                      Your dashboard: <span className="text-purple-400 font-bold">{formData.slug || "slug"}.rrnet.local</span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Phone Number (WhatsApp)</label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                      <input 
                        type="tel" 
                        placeholder="628123456789"
                        className={cn(
                          "w-full bg-white/5 border rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 transition-all text-sm",
                          phoneAvailable === false ? "border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50" :
                          phoneAvailable === true ? "border-green-500/50 focus:ring-green-500/50 focus:border-green-500/50" :
                          "border-white/10 focus:ring-purple-500/50 focus:border-purple-500/50"
                        )}
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                      {checkingPhone && (
                        <RefreshCcw className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin" />
                      )}
                      {!checkingPhone && phoneAvailable === true && (
                        <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                      )}
                      {!checkingPhone && phoneAvailable === false && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          <span className="text-xs text-red-400">Already registered</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground ml-1">
                      Gunakan format internasional (Contoh: 628xxx).
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300 flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <p>Sistem akan menyiapkan infrastruktur terisolasi khusus untuk perusahaan Anda.</p>
                </div>

                <button 
                  onClick={handleRegister}
                  disabled={
                    loading || 
                    !formData.companyName || 
                    !formData.slug || 
                    !formData.phone || 
                    phoneAvailable === false || 
                    slugAvailable === false ||
                    checkingPhone ||
                    checkingSlug
                  }
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-4 rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-xl shadow-purple-500/20 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? "Creating..." : "Create Workspace"}
                  <Rocket className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                </button>

                {error && (
                  <p className="text-red-500 text-sm text-center">{error}</p>
                )}
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="text-center space-y-4 mb-8">
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                     <MessageSquare className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h1 className="text-3xl font-bold">WhatsApp Verification</h1>
                  <p className="text-muted-foreground">
                    Kami telah mengirim kode OTP ke WhatsApp <span className="text-white font-medium">{formData.phone}</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70 text-center block">Enter 6-digit Code</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      placeholder="000000"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-6 text-center text-3xl font-black tracking-[1em] focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                </div>

                <button 
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-xl flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                  <CheckCircle2 className="w-5 h-5" />
                </button>

                {error && (
                  <p className="text-red-500 text-sm text-center font-medium bg-red-500/10 py-3 rounded-xl border border-red-500/20">{error}</p>
                )}

                <p className="text-xs text-center text-muted-foreground">
                  Belum menerima kode WhatsApp? {timer > 0 ? (
                    <span>Tunggu <span className="text-emerald-400 font-bold font-mono">{timer}s</span> untuk kirim ulang.</span>
                  ) : (
                    <button 
                      onClick={handleResendOTP}
                      className="text-emerald-400 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCcw className="w-3 h-3" />
                      Kirim Ulang OTP
                    </button>
                  )}
                </p>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <>
                  {/* Success Header */}
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 bg-gradient-to-tr from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                    <CheckCircle className="w-12 h-12 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-black italic tracking-tighter">REGISTRATION SUCCESS!</h1>
                    <p className="text-xl text-emerald-400 font-bold mt-2">Workspace Created</p>
                  </div>
                </div>

                {/* Invoice Summary */}
                {regResponse?.invoice && (
                  <div className="bg-gradient-to-br from-indigo-950 to-purple-950 border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden text-left">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rotate-45 -mr-16 -mt-16" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Invoice Number</p>
                        <h2 className="text-2xl font-black italic tracking-tighter text-white">{regResponse.invoice.invoice_number}</h2>
                      </div>
                      <div className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/30">
                        PENDING
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/10 relative z-10">
                      {regResponse.invoice.discount_amount > 0 && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400 font-bold uppercase tracking-tighter">Subtotal</span>
                            <span className="text-white/60 line-through">
                              Rp {regResponse.invoice.subtotal?.toLocaleString('id-ID') || '0'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-emerald-400 font-bold uppercase tracking-tighter">Discount</span>
                            <span className="text-emerald-400 font-bold">
                              - Rp {regResponse.invoice.discount_amount?.toLocaleString('id-ID') || '0'}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold uppercase tracking-tighter text-sm">Amount Due</span>
                        <span className="text-white font-black text-2xl italic">
                          Rp {regResponse.invoice.amount?.toLocaleString('id-ID') || '0'}
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
                          <p className="font-bold text-white text-sm uppercase tracking-tighter">{formData.plan} - {formData.billing}</p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4">
                          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Due Date</p>
                          <p className="font-bold text-amber-400 text-sm tracking-tighter">
                            {regResponse.invoice.due_date ? new Date(regResponse.invoice.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                          </p>
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
                          onClick={async () => {
                            if(!discountCode || !regResponse?.invoice?.id) return;
                            setApplyingDiscount(true);
                            try {
                              const updatedInv = await platformDiscountService.apply(regResponse.invoice.id, discountCode);
                              showToast("Discount code applied successfully!", "success");
                              setRegResponse({ ...regResponse, invoice: updatedInv });
                            } catch (err: any) {
                              showToast(err.response?.data?.error || "Invalid discount code", "error");
                            } finally {
                              setApplyingDiscount(false);
                            }
                          }}
                          disabled={applyingDiscount || !discountCode || regResponse?.invoice?.discount_id}
                          className="px-4 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 rounded-xl transition-all"
                        >
                          {applyingDiscount ? <RefreshCcw className="w-4 h-4 animate-spin text-purple-400" /> : <Check className="w-4 h-4 text-purple-400" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Methods */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                      <Wallet className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Available Payment Methods</h3>
                      <p className="text-xs text-muted-foreground">Choose your preferred payment method</p>
                    </div>
                  </div>

                  {paymentMethods.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Loading payment methods...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {paymentMethods.map((method) => {
                        const getCategoryIcon = () => {
                          switch (method.category) {
                            case "bank":
                              return { icon: CreditCard, color: "blue" };
                            case "e-wallet":
                              return { icon: Wallet, color: "emerald" };
                            case "cash":
                              return { icon: DollarSign, color: "amber" };
                            case "pay later":
                              return { icon: Zap, color: "purple" };
                            default:
                              return { icon: CreditCard, color: "blue" };
                          }
                        };

                        const { icon: Icon, color } = getCategoryIcon();
                        const colorClasses = {
                          blue: "bg-blue-500/20 text-blue-400",
                          emerald: "bg-emerald-500/20 text-emerald-400",
                          amber: "bg-amber-500/20 text-amber-400",
                          purple: "bg-purple-500/20 text-purple-400",
                        };

                        const copyToClipboard = (text: string) => {
                          navigator.clipboard.writeText(text);
                          showToast("Copied to clipboard!", "success");
                        };

                        return (
                          <div key={method.id} className="bg-white/5 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colorClasses[color])}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-white">{method.name}</h4>
                                <p className="text-xs text-muted-foreground capitalize">{method.category}</p>
                              </div>
                            </div>

                            <div className="space-y-2 text-sm">
                              {method.provider && (
                                <div className="flex justify-between items-center py-2 border-b border-white/5">
                                  <span className="text-muted-foreground">
                                    {method.category === "bank" ? "Bank" : "Provider"}
                                  </span>
                                  <span className="font-bold text-white">{method.provider}</span>
                                </div>
                              )}
                              {method.account_number && (
                                <div className="flex justify-between items-center py-2 border-b border-white/5">
                                  <span className="text-muted-foreground">
                                    {method.category === "bank" ? "Account Number" : "Phone"}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-white">{method.account_number}</span>
                                    <button
                                      onClick={() => copyToClipboard(method.account_number!)}
                                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                      title="Copy to clipboard"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                    </button>
                                  </div>
                                </div>
                              )}
                              {method.account_name && (
                                <div className="flex justify-between items-center py-2">
                                  <span className="text-muted-foreground">Account Name</span>
                                  <span className="font-bold text-white">{method.account_name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl text-left space-y-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Info className="w-4 h-4 text-purple-400" />
                    </span>
                    Next Steps
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-3">
                    <li className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400 shrink-0 mt-0.5">1</div>
                      <span>Complete payment using one of the methods above</span>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400 shrink-0 mt-0.5">2</div>
                      <span>Our team will verify your payment and company details</span>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400 shrink-0 mt-0.5">3</div>
                      <span>You'll receive notification once your account is approved</span>
                    </li>
                    <li className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400 shrink-0 mt-0.5">4</div>
                      <span>Access your dashboard and start managing your ISP business!</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-purple-400 font-bold hover:text-purple-300 transition-colors"
                >
                  Go to Login
                  <ArrowRight className="w-4 h-4" />
                </Link>
                </>
              </motion.div>
            )}
          </AnimatePresence>

          {step < 3 && (
            <div className="mt-8 text-center text-sm">
               <span className="text-muted-foreground">Already have an account? </span>
               <Link href="/login" className="text-purple-400 font-bold hover:underline">Sign In</Link>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isChangingPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
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
                      onClick={() => setFormData({ ...formData, billing: 'monthly' })}
                      className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative z-10",
                        formData.billing === "monthly" ? "text-white" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Bulanan
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, billing: 'yearly' })}
                      className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative z-10",
                        formData.billing === "yearly" ? "text-white" : "text-slate-500 hover:text-slate-300"
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
                        x: formData.billing === "monthly" ? 0 : "100%",
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
                        const isYearly = formData.billing === "yearly";
                        const planDiscount = config?.yearly_discount ?? 20;
                        const price = isYearly 
                          ? (p.price_yearly ? p.price_yearly / 12 : p.price_monthly * (1 - planDiscount / 100)) 
                          : p.price_monthly;
                        
                        const isPopular = config?.popular_plan_id ? p.id === config.popular_plan_id : (p.code === 'pro');

                        return (
                          <button
                            key={p.id}
                            disabled={loading}
                            onClick={() => handleUpdatePlan(p.code, formData.billing)}
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

                            {loading && p.code === formData.plan && (
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
