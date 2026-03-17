"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, 
  Mail, 
  Lock, 
  Globe, 
  ArrowRight, 
  Info,
  ShieldCheck,
  Rocket,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAuthStore } from "@/stores/authStore";
import { useTenantStore } from "@/stores/tenantStore";

const schema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  tenantSlug: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const { showToast } = useNotificationStore();
  const [submitted, setSubmitted] = useState(false);
  const [showTenantInfo, setShowTenantInfo] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      tenantSlug: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setSubmitted(true);
      const tenantSlug = data.tenantSlug?.trim() || undefined;

      await login(
        { email: data.email, password: data.password },
        tenantSlug
      );
      showToast({ title: "Login berhasil", variant: "success" });

      const authState = useAuthStore.getState();
      if (authState.tenant && authState.tenantSlug) {
        useTenantStore.getState().setTenant(authState.tenant, authState.tenantSlug);
      } else {
        useTenantStore.getState().clear();
      }

      const currentUser = useAuthStore.getState().user;
      const currentTenant = authState.tenant;
      const userRole = currentUser?.role || "";

      // Check if tenant is pending approval
      if (currentTenant?.status === "pending" && userRole !== "super_admin") {
        router.push("/waiting-approval");
        return;
      }

      if (userRole === "super_admin") {
        router.push("/superadmin");
      } else if (userRole === "client") {
        router.push("/portal/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || "Terjadi kesalahan saat login";
      
      clearErrors();
      const lowerMessage = errorMessage.toLowerCase();
      
      if (lowerMessage.includes("email tidak terdaftar")) {
        setError("email", { message: "Email tidak terdaftar" });
      } else if (lowerMessage.includes("password salah")) {
        setError("password", { message: "Password salah" });
      } else if (lowerMessage.includes("tenant") || lowerMessage.includes("slug")) {
        setError("tenantSlug", { message: errorMessage });
      }

      showToast({ title: "Login gagal", description: errorMessage, variant: "error" });
      setSubmitted(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Left Side: Marketing / Brand (Desktop Only) */}
      <div className="hidden lg:flex w-2/5 p-16 flex-col justify-between border-r border-white/5 bg-white/[0.01] backdrop-blur-3xl relative">
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2 mb-20 group">
            <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-2xl flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform">
              <Zap className="text-white w-7 h-7 fill-current" />
            </div>
            <span className="text-2xl font-bold tracking-tight">RRNET</span>
          </Link>

          <div className="space-y-6">
            <h2 className="text-5xl font-black leading-tight italic tracking-tighter uppercase">
              Welcome <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Back.</span>
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-sm">
              Manage your entire network ecosystem from one powerful, unified dashboard.
            </p>
          </div>

          <div className="mt-20 grid grid-cols-1 gap-8">
            {[
              { title: "Real-time Monitoring", desc: "Live status of all network points.", icon: Globe },
              { title: "Smart Billing", desc: "Automated revenue management.", icon: Zap },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-3xl bg-white/5 border border-white/10">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20">
                   <item.icon className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                   <h4 className="font-bold">{item.title}</h4>
                   <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm text-muted-foreground border-t border-white/5 pt-8">
          © {new Date().getFullYear()} RRNET Global. Premium ERP by InoVexa.
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex-grow flex flex-col items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="text-white w-6 h-6 fill-current" />
              </div>
              <span className="text-2xl font-bold">RRNET</span>
            </Link>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center lg:text-left">
              <h1 className="text-3xl font-bold mb-2">Sign In</h1>
              <p className="text-muted-foreground">Enter your credentials to access your workspace.</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                  <input 
                    type="email" 
                    placeholder="name@company.com"
                    className={cn(
                      "w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all text-sm",
                      errors.email && "border-red-500/50 ring-2 ring-red-500/10"
                    )}
                    {...registerField("email")}
                  />
                </div>
                {errors.email && <p className="text-[10px] text-red-500 ml-1 italic">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-medium text-white/70">Password</label>
                  <Link href="/forgot-password" size="sm" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    className={cn(
                      "w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all text-sm",
                      errors.password && "border-red-500/50 ring-2 ring-red-500/10"
                    )}
                    {...registerField("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-[10px] text-red-500 ml-1 italic">{errors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                    Tenant Slug <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded uppercase opacity-50 font-normal">Optional</span>
                  </label>
                  <button 
                    type="button"
                    onClick={() => setShowTenantInfo(!showTenantInfo)}
                    className="p-1 hover:bg-white/5 rounded-full transition-colors group"
                  >
                    <Info className="w-3 h-3 text-white/30 group-hover:text-purple-400" />
                  </button>
                </div>
                <div className="relative group">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                  <input 
                    placeholder="acme-net"
                    className={cn(
                      "w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all text-sm font-mono",
                      errors.tenantSlug && "border-red-500/50 ring-2 ring-red-500/10"
                    )}
                    {...registerField("tenantSlug")}
                  />
                </div>
                <AnimatePresence>
                  {showTenantInfo && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 text-[10px] text-purple-300 leading-relaxed italic">
                        Tenant slug adalah ID unik organisasi Anda.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {errors.tenantSlug && <p className="text-[10px] text-red-500 ml-1 italic">{errors.tenantSlug.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading || submitted}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-4 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-purple-500/20 flex items-center justify-center gap-2 group mt-8"
              >
                {isLoading || submitted ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-white/5 flex-grow" />
                <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold">OR LOGIN WITH</span>
                <div className="h-px bg-white/5 flex-grow" />
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  type="button" 
                  onClick={() => window.location.assign(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/auth/google/login`)}
                  className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 py-4 rounded-2xl hover:bg-white/10 transition-all font-medium text-sm group"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </button>
              </div>
            </form>

            <div className="text-center text-sm border-t border-white/5 pt-8">
               <span className="text-muted-foreground">Don't have an account or workspace?</span><br/>
               <Link href="/register" className="text-purple-400 font-bold hover:underline">Create an organization</Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
