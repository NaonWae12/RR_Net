"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Router, CreateRouterRequest, UpdateRouterRequest, ProvisionResponse, RouterStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils/styles";
import { useState } from "react";
import React from "react";
import { networkService } from "@/lib/api/networkService";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, Copy, Terminal, ShieldCheck, Activity } from "lucide-react";

const routerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["mikrotik", "cisco", "ubiquiti", "other"]),
  connectivity_mode: z.enum(["direct_public", "vpn"]).default("vpn"),
  host: z.string().optional(),
  nas_ip: z.string().optional(),
  port: z.coerce.number().min(1).max(65535).default(22),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  api_port: z.coerce.number().min(1).max(65535).default(8728),
  api_use_tls: z.boolean().default(false),
  is_default: z.boolean().default(false),
  vpn_username: z.string().optional(),
  vpn_password: z.string().optional(),
  vpn_ipsec_psk: z.string().optional(),
  remote_access_port: z.coerce.number().optional(),
});

type RouterFormValues = z.infer<typeof routerFormSchema>;

interface RouterFormProps {
  initialData?: Router;
  onSubmit: (data: CreateRouterRequest | UpdateRouterRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function RouterForm({ initialData, onSubmit, onCancel, isLoading }: RouterFormProps) {
  const [provisionedId, setProvisionedId] = useState<string | null>(initialData?.id || null);
  const [provisioningData, setProvisioningData] = useState<ProvisionResponse | null>(initialData ? {
    router_id: initialData.id,
    vpn_username: initialData.vpn_username || "",
    vpn_password: initialData.vpn_password || "",
    vpn_ipsec_psk: "RRNetSecretPSK",
    vpn_script: initialData.vpn_script || "",
    remote_access_port: initialData.remote_access_port || 0,
    tunnel_ip: initialData.host || "",
    public_ip: "72.60.74.209"
  } : null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(!!initialData?.host);
  const [step, setStep] = useState(initialData?.host ? 3 : 1);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RouterFormValues>({
    resolver: zodResolver(routerFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      type: initialData?.type || "mikrotik",
      connectivity_mode: (initialData?.connectivity_mode as any) || "vpn",
      host: initialData?.host || "",
      nas_ip: initialData?.nas_ip || "",
      port: initialData?.port || 22,
      username: initialData?.username || "",
      password: initialData?.password || "",
      api_port: initialData?.api_port || 8728,
      api_use_tls: initialData?.api_use_tls || false,
      is_default: initialData?.is_default || false,
      vpn_username: initialData?.vpn_username || "",
      vpn_password: initialData?.vpn_password || "",
      vpn_ipsec_psk: "rrnet123",
      remote_access_port: initialData?.remote_access_port || 10500,
    },
  });

  const connectivityMode = watch("connectivity_mode");

  const handleFormSubmit = async (values: RouterFormValues) => {
    try {
      // If we already have a provisioned ID, we should UPDATE the router instead of creating it
      if (provisionedId) {
        await onSubmit({
          ...values,
          status: "offline", // Reset status from provisioning to offline/online after full save
        } as any);
      } else {
        await onSubmit(values as CreateRouterRequest);
      }
    } catch (error) {
      // Handled by parent
    }
  };

  const handleProvision = async () => {
    const name = watch("name");
    if (!name) {
      toast.error("Please enter a router name first");
      return;
    }

    setIsProvisioning(true);
    try {
      const res = await networkService.provisionRouter({
        name: watch("name"),
        connectivity_mode: "vpn",
      });
      setProvisioningData(res);
      setProvisionedId(res.router_id);
      setValue("host", res.tunnel_ip);
      setValue("vpn_username", res.vpn_username);
      setValue("vpn_password", res.vpn_password);
      setValue("vpn_ipsec_psk", res.vpn_ipsec_psk);
      setValue("remote_access_port", res.remote_access_port);
      setStep(2);
      toast.success("Router provisioned and saved! Apply the script now.");
    } catch (err: any) {
      toast.error("Provisioning failed: " + (err.response?.data?.error || err.message));
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleVerifyConnection = async () => {
    setIsVerifying(true);
    try {
      const res = await networkService.testRouterConfig({
        type: "mikrotik",
        host: watch("host") || "",
        api_port: watch("api_port"),
        api_use_tls: watch("api_use_tls"),
        username: watch("username") || "admin",
        password: watch("password") || "",
      });

      if (res.ok) {
        setIsVerified(true);
        toast.success(`✅ Connected! MikroTik Identity: ${res.identity || 'Unknown'}`);
      } else {
        toast.error("Connection failed. Check your credentials and ensure MikroTik is reachable.");
      }
    } catch (err: any) {
      toast.error("Connection failed: " + (err.response?.data?.error || err.message || "Unknown error"));
    } finally {
      setIsVerifying(false);
    }
  };

  const copyScript = () => {
    if (provisioningData?.vpn_script) {
      navigator.clipboard.writeText(provisioningData.vpn_script);
      toast.success("Script copied to clipboard!");
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Activity className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Step 1: Router Identity</h3>
            <p className="text-xs text-slate-500">Beri nama router Anda untuk identifikasi di dashboard.</p>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label="Router Name"
            {...register("name")}
            error={errors.name?.message}
            placeholder="Contoh: Kantor Pusat, Cabang Malang, dll"
            className="text-base"
          />
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <p className="font-bold">Pro-Tip:</p>
              <p>Gunakan nama yang unik. Sistem akan otomatis menyiapkan tunnel VPN L2TP/IPSec yang aman untuk Anda.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={handleProvision}
          disabled={isProvisioning}
          className="bg-indigo-600 hover:bg-indigo-700 h-11 px-8 rounded-full shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
        >
          {isProvisioning ? (
            <>
              <Loader2 className="animate-spin h-4 w-4 mr-2" />
              Preparing Tunnel...
            </>
          ) : "Generate VPN Script"}
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Terminal className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-indigo-900">Step 2: Jalankan Script di MikroTik</h3>
            <p className="text-xs text-indigo-700">Script ini akan menghubungkan MikroTik ke VPN Server secara otomatis.</p>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -top-3 left-4 bg-indigo-600 text-[10px] text-white px-2 py-0.5 rounded font-bold z-10">
            MIKROTIK TERMINAL SCRIPT
          </div>
          <pre className="bg-slate-950 text-emerald-400 p-5 rounded-lg text-[10px] font-mono overflow-auto max-h-[250px] border-2 border-indigo-200 group-hover:border-indigo-400 transition-colors">
            {provisioningData?.vpn_script}
          </pre>
          <Button
            type="button"
            size="sm"
            className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white border border-white/20"
            onClick={copyScript}
          >
            <Copy className="h-3.5 w-3.5 mr-2" /> Copy Script
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white/60 p-3 rounded-lg border border-indigo-100 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Tunnel Destination</p>
            <p className="text-sm font-mono font-bold text-indigo-700">{provisioningData?.public_ip}</p>
          </div>
          <div className="bg-white/60 p-3 rounded-lg border border-indigo-100 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">VPN Username</p>
            <p className="text-sm font-mono font-bold text-indigo-700">{provisioningData?.vpn_username}</p>
          </div>
          <div className="bg-white/60 p-3 rounded-lg border border-indigo-100 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">VPN Password</p>
            <p className="text-sm font-mono font-bold text-indigo-700">{provisioningData?.vpn_password}</p>
          </div>
          <div className="bg-white/60 p-3 rounded-lg border border-indigo-100 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">IPsec PSK</p>
            <p className="text-sm font-mono font-bold text-indigo-700">{provisioningData?.vpn_ipsec_psk}</p>
          </div>
          <div className="bg-white/60 p-3 rounded-lg border border-indigo-100 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Remote Winbox Port</p>
            <p className="text-sm font-mono font-bold text-indigo-700">{provisioningData?.remote_access_port}</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-white/40 rounded-lg text-[10px] text-indigo-800 italic flex gap-2 items-center">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Silakan copy script di atas dan jalankan di "New Terminal" Winbox. Setelah itu, <b>lanjut ke Step 3</b> untuk verifikasi koneksi.</span>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2">
        <Button type="button" variant="ghost" onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-800">
          &larr; Ubah Nama
        </Button>
        <Button
          type="button"
          onClick={() => setStep(3)}
          className="bg-indigo-600 hover:bg-indigo-700 h-11 px-8 rounded-full shadow-lg shadow-indigo-200 transition-all hover:scale-105"
        >
          Next: Input Credentials & Verify &rarr;
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-emerald-600 p-2 rounded-lg shadow-md shadow-emerald-200">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-emerald-900">Step 3: Access Credentials</h3>
            <p className="text-xs text-emerald-700">Link VPN Aktif! Sekarang masukkan kredensial login MikroTik.</p>
          </div>
        </div>

        {isVerified && (
          <div className="mb-4 p-3 bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-800">Connection Test Passed! You can now complete the setup.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-700 border-b pb-1">MikroTik Credentials (Final)</h4>
            <Input label="Winbox Username" {...register("username")} error={errors.username?.message} placeholder="e.g. admin" />
            <Input label="Winbox Password" type="password" {...register("password")} error={errors.password?.message} placeholder="••••••••" />
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-700 border-b pb-1">Backend Connectivity</h4>
            <Input label="Tunnel Connection IP (Host)" {...register("host")} error={errors.host?.message} />
            <Input label="Remote Access Port" type="number" {...register("remote_access_port")} error={errors.remote_access_port?.message} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-700 border-b pb-1">VPN Credentials (Advanced)</h4>
            <Input label="VPN L2TP Username" {...register("vpn_username")} />
            <Input label="VPN L2TP Password" {...register("vpn_password")} />
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-700 border-b pb-1">API Settings</h4>
            <Input label="Router API Port" type="number" {...register("api_port")} error={errors.api_port?.message} />
            <div className="flex items-center space-x-3 bg-white/50 p-3 rounded-lg border border-emerald-100">
              <input type="checkbox" id="api_use_tls" {...register("api_use_tls")} className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500" />
              <label htmlFor="api_use_tls" className="text-sm font-semibold text-emerald-900 cursor-pointer">Use SSL (API-SSL)</label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4">
        <Button type="button" variant="ghost" onClick={() => setStep(2)} className="text-slate-500">
          &larr; Lihat Script Lagi
        </Button>
        <div className="flex gap-3">
          <Button
            type="button"
            onClick={handleVerifyConnection}
            disabled={isVerifying}
            className="bg-emerald-600 hover:bg-emerald-700 h-12 px-6 rounded-full shadow-lg transition-all hover:scale-105"
          >
            {isVerifying ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Testing...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !isVerified}
            className="bg-slate-900 hover:bg-black text-white px-10 h-12 rounded-full shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            {isLoading ? "Saving Data..." : "Complete Setup"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8 px-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === s ? "bg-indigo-600 text-white" :
              step > s ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
              }`}>
              {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
            </div>
            {s < 3 && <div className={`h-1 w-16 md:w-24 mx-2 rounded ${step > s ? "bg-emerald-500" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(async (data) => {
        const finalData = {
          ...data,
          auto_create_vpn: connectivityMode === 'vpn',
          enable_remote_access: true,
          vpn_username: data.vpn_username,
          vpn_password: data.vpn_password,
          remote_access_port: data.remote_access_port,
        };
        await onSubmit(finalData as any);
      })}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </form>
    </div>
  );
}
