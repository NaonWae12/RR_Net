"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { Router, CreateRouterRequest, UpdateRouterRequest } from "@/lib/api/types";
import { useEffect, useState } from "react";
import { networkService } from "@/lib/api/networkService";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const routerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["mikrotik", "cisco", "ubiquiti", "other"]),
  connectivity_mode: z.enum(["direct_public", "vpn"]).default("direct_public"),
  host: z.string().min(1, "Host is required"),
  nas_ip: z.string().optional(),
  port: z.coerce.number().min(1).max(65535).default(22),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  api_port: z.coerce.number().min(1).max(65535).optional(),
  api_use_tls: z.boolean().default(false),
  is_default: z.boolean().default(false),
  radius_enabled: z.boolean().default(false).optional(),
  radius_secret: z.string().optional(),
});

type RouterFormValues = z.infer<typeof routerFormSchema>;

type ConnectionMode = "local" | "ngrok" | "production";

interface RouterFormProps {
  initialData?: Router;
  onSubmit: (data: CreateRouterRequest | UpdateRouterRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

// Helper functions
const isNgrokHostname = (host: string): boolean => {
  return /\.ngrok\.(io|dev|app)$/i.test(host) || /\.tcp\.ngrok/i.test(host);
};

const isIPAddress = (host: string): boolean => {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return ipRegex.test(host);
};

const isLocalIP = (ip: string): boolean => {
  return /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(ip);
};

const detectConnectionMode = (host: string): ConnectionMode => {
  if (!host) return "production";
  if (isNgrokHostname(host)) return "ngrok";
  if (isIPAddress(host)) {
    return isLocalIP(host) ? "local" : "production";
  }
  return "production"; // Assume DDNS hostname
};

export function RouterForm({ initialData, onSubmit, onCancel, isLoading }: RouterFormProps) {
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("production");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    identity?: string;
    latency_ms?: number;
    error?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RouterFormValues>({
    resolver: zodResolver(routerFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "mikrotik",
      connectivity_mode: "direct_public",
      host: "",
      nas_ip: "",
      port: 22,
      username: "",
      password: "",
      api_port: 8728,
      api_use_tls: false,
      is_default: false,
      radius_enabled: false,
      radius_secret: "",
    },
  });

  const apiUseTLS = watch("api_use_tls");
  const apiPort = watch("api_port");
  const host = watch("host");
  const type = watch("type");

  // Auto-detect connection mode based on host
  useEffect(() => {
    if (host) {
      setConnectionMode(detectConnectionMode(host));
    }
  }, [host]);

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        description: initialData.description || "",
        type: initialData.type,
        connectivity_mode: initialData.connectivity_mode ?? "direct_public",
        host: initialData.host,
        nas_ip: initialData.nas_ip || "",
        port: initialData.port,
        username: initialData.username,
        password: "", // Don't pre-fill password
        api_port: initialData.api_port || 8728,
        api_use_tls: initialData.api_use_tls ?? false,
        is_default: initialData.is_default,
        radius_enabled: initialData.radius_enabled ?? false,
        radius_secret: "", // Don't pre-fill secret
      });
    }
  }, [initialData, reset]);

  useEffect(() => {
    // Convenience: when toggling TLS, nudge port to the common default if user didn't customize it.
    if (apiUseTLS && apiPort === 8728) {
      setValue("api_port", 8729);
    }
    if (!apiUseTLS && apiPort === 8729) {
      setValue("api_port", 8728);
    }
  }, [apiUseTLS, apiPort, setValue]);

  const handleFormSubmit = async (data: RouterFormValues) => {
    await onSubmit(data);
  };

  const handleTestConnection = async () => {
    const formData = watch();

    if (!formData.host || !formData.username || !formData.password) {
      toast.error("Please fill in Host, Username, and Password first");
      return;
    }

    if (formData.type !== "mikrotik") {
      toast.info("Connection test is only available for MikroTik routers");
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const res = initialData?.id
        ? await networkService.testRouterConnection(initialData.id)
        : await networkService.testRouterConfig({
          type: formData.type,
          host: formData.host,
          api_port: formData.api_port || (formData.api_use_tls ? 8729 : 8728),
          api_use_tls: formData.api_use_tls,
          username: formData.username,
          password: formData.password,
        });

      setTestResult(res);
      if (res.ok) {
        toast.success("Connection OK", {
          description: res.identity
            ? `Router identity: ${res.identity}${res.latency_ms ? ` (${res.latency_ms}ms)` : ""}`
            : res.latency_ms
              ? `Latency: ${res.latency_ms}ms`
              : undefined,
        });
      } else {
        toast.error("Connection failed", { description: res.error ?? "Unknown error" });
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error ?? err?.message ?? "Unknown error";
      setTestResult({ ok: false, error: errorMsg });
      toast.error("Connection failed", { description: errorMsg });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getModeInfo = () => {
    switch (connectionMode) {
      case "local":
        return {
          icon: "🔵",
          title: "Mode: Development (Local Network)",
          description: "Router dan backend berada di jaringan yang sama. Pastikan router dapat diakses via IP lokal ini.",
        };
      case "ngrok":
        return {
          icon: "🟡",
          title: "Mode: Development (ngrok Tunnel)",
          description: "Menggunakan ngrok TCP tunnel untuk development. Pastikan ngrok tunnel aktif dan MikroTik sudah dikonfigurasi untuk allow ngrok IP.",
        };
      default:
        return {
          icon: "🟢",
          title: "Mode: Production (DDNS/IP)",
          description: "Menggunakan DDNS atau public IP. Pastikan port forwarding sudah dikonfigurasi dan firewall MikroTik sudah allow IP backend.",
        };
    }
  };

  const modeInfo = getModeInfo();

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Connection Mode Info Banner */}
      {host && (
        <div
          className={`rounded-lg border p-3 ${connectionMode === "local"
            ? "border-blue-200 bg-blue-50"
            : connectionMode === "ngrok"
              ? "border-yellow-200 bg-yellow-50"
              : "border-green-200 bg-green-50"
            }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">{modeInfo.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold">{modeInfo.title}</p>
              <p className="mt-1 text-xs text-slate-600">{modeInfo.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Test Result Display */}
      {testResult && (
        <div
          className={`rounded-lg border p-3 ${testResult.ok
            ? "border-green-200 bg-green-50"
            : "border-red-200 bg-red-50"
            }`}
        >
          <div className="flex items-start gap-2">
            {testResult.ok ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {testResult.ok ? "Connection Test Successful" : "Connection Test Failed"}
              </p>
              {testResult.ok && testResult.identity && (
                <p className="mt-1 text-xs text-slate-600">
                  Router: {testResult.identity}
                  {testResult.latency_ms && ` • Latency: ${testResult.latency_ms}ms`}
                </p>
              )}
              {!testResult.ok && testResult.error && (
                <p className="mt-1 text-xs text-red-600">{testResult.error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-900">
        <Input label="Router Name" {...register("name")} error={errors.name?.message} />
        <SimpleSelect
          value={watch("type")}
          onValueChange={(value) => setValue("type", value as Router["type"])}
          className="w-full"
        >
          <option value="mikrotik">MikroTik</option>
          <option value="cisco">Cisco</option>
          <option value="ubiquiti">Ubiquiti</option>
          <option value="other">Other</option>
        </SimpleSelect>
        <SimpleSelect
          value={watch("connectivity_mode")}
          onValueChange={(value) => setValue("connectivity_mode", value as RouterFormValues["connectivity_mode"])}
          className="w-full"
        >
          <option value="direct_public">Connectivity: Direct/Public (DDNS+Port Forward)</option>
          <option value="vpn">Connectivity: VPN (Private)</option>
        </SimpleSelect>
        <div className="md:col-span-2">
          <Input
            label="Host (IP or Hostname)"
            {...register("host")}
            error={errors.host?.message}
            placeholder={
              connectionMode === "ngrok"
                ? "e.g. 0.tcp.ngrok.io"
                : connectionMode === "local"
                  ? "e.g. 192.168.1.1"
                  : "e.g. router.ddns.net atau 203.0.113.1"
            }
          />
          {host && (
            <p className="mt-1 text-xs text-slate-500">
              {connectionMode === "ngrok"
                ? "Masukkan hostname ngrok (tanpa port). Port akan diambil dari field Port di bawah."
                : connectionMode === "local"
                  ? "IP lokal router di jaringan yang sama dengan backend"
                  : "DDNS hostname atau public IP router"}
            </p>
          )}
        </div>
        <Input label="SSH Port" type="number" {...register("port")} error={errors.port?.message} />
        <div className="md:col-span-2">
          <Input
            label="API Port"
            type="number"
            {...register("api_port")}
            error={errors.api_port?.message}
          />
          {connectionMode === "ngrok" && (
            <p className="mt-1 text-xs text-yellow-600">
              ⚠️ Gunakan port dari ngrok (bukan 8728). Contoh: jika ngrok forward ke tcp://0.tcp.ngrok.io:12345,
              masukkan 12345
            </p>
          )}
          {connectionMode !== "ngrok" && (
            <p className="mt-1 text-xs text-slate-500">
              Port API MikroTik (default: 8728 untuk non-SSL, 8729 untuk SSL)
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="api_use_tls"
            {...register("api_use_tls")}
            className="rounded border-slate-300"
          />
          <label htmlFor="api_use_tls" className="text-sm font-medium text-slate-700">
            Use TLS (API-SSL)
          </label>
        </div>
        <Input label="Username" {...register("username")} error={errors.username?.message} />
        <Input
          label="Password"
          type="password"
          {...register("password")}
          error={errors.password?.message}
        />
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_default"
            {...register("is_default")}
            className="rounded border-slate-300"
          />
          <label htmlFor="is_default" className="text-sm font-medium text-slate-700">
            Set as default router
          </label>
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700">Description (optional)</label>
          <textarea
            {...register("description")}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
            rows={3}
            placeholder="Router description"
          />
        </div>
      </div>

      {/* DDNS Setup Guide for Production Mode */}
      {connectionMode === "production" && host && watch("connectivity_mode") === "direct_public" && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">📋 Setup Guide: DDNS + Port Forward</p>
          <div className="space-y-2 text-xs text-blue-800">
            <div>
              <p className="font-semibold mb-1">1. Setup DDNS di MikroTik:</p>
              <ul className="list-inside list-disc ml-2 space-y-1">
                <li>Masuk ke <code className="bg-blue-100 px-1 rounded">IP → Cloud</code></li>
                <li>Enable <code className="bg-blue-100 px-1 rounded">DDNS Enabled</code></li>
                <li>Pilih provider (No-IP, DuckDNS, atau custom)</li>
                <li>Masukkan hostname DDNS (contoh: router.ddns.net)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">2. Setup Port Forwarding di Router Upstream:</p>
              <ul className="list-inside list-disc ml-2 space-y-1">
                <li>Forward port {apiPort || (apiUseTLS ? 8729 : 8728)} dari router upstream ke IP lokal MikroTik</li>
                <li>Pastikan firewall router upstream allow koneksi dari IP VPS backend</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">3. Konfigurasi Firewall MikroTik:</p>
              <ul className="list-inside list-disc ml-2 space-y-1">
                <li>Allow IP VPS backend di firewall MikroTik</li>
                <li>Pastikan API port ({apiPort || (apiUseTLS ? 8729 : 8728)}) terbuka untuk IP VPS</li>
                <li>Command: <code className="bg-blue-100 px-1 rounded">/ip firewall filter add chain=input src-address=IP_VPS action=accept</code></li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* VPN Setup Guide */}
      {watch("connectivity_mode") === "vpn" && (
        <div className="rounded-lg border border-purple-300 bg-purple-50 p-4">
          <p className="text-sm font-semibold text-purple-900 mb-2">🔐 Setup Guide: VPN Connection (L2TP/IPSec)</p>
          <div className="space-y-2 text-xs text-purple-800">
            <div>
              <p className="font-semibold mb-1">1. Setup L2TP/IPSec Server di VPS:</p>
              <ul className="list-inside list-disc ml-2 space-y-1">
                <li>Install dan jalankan L2TP/IPSec server di VPS (strongSwan + xl2tpd)</li>
                <li>Buat IP pool VPN (contoh: <code className="bg-purple-100 px-1 rounded">10.10.10.100-10.10.10.200</code>)</li>
                <li>Buat akun VPN per router (username/password) supaya scalable</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">2. Setup VPN Client di MikroTik (NAT-friendly):</p>
              <ul className="list-inside list-disc ml-2 space-y-1">
                <li>Buat interface <code className="bg-purple-100 px-1 rounded">PPP → Interface → L2TP Client</code> connect ke IP public VPS</li>
                <li>Aktifkan <code className="bg-purple-100 px-1 rounded">Use IPSec</code> dan isi IPSec Secret (PSK) yang sama seperti di VPS</li>
                <li>Set username/password VPN sesuai akun router yang dibuat di VPS</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">3. Catatan:</p>
              <ul className="list-inside list-disc ml-2 space-y-1">
                <li>Di ERP, <b>Host</b> pakai <b>IP VPN MikroTik</b> (contoh: <code className="bg-purple-100 px-1 rounded">10.10.10.101</code>), bukan IP public</li>
                <li>Tambahkan firewall rule di MikroTik untuk allow API dari network VPN (mis. <code className="bg-purple-100 px-1 rounded">10.10.10.0/24</code>)</li>
                <li>L2TP/IPSec tersedia di semua MikroTik (termasuk low-end). WireGuard butuh ROS v7</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Warning untuk ngrok mode */}
      {connectionMode === "ngrok" && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3">
          <p className="text-xs font-semibold text-yellow-800">⚠️ Catatan ngrok:</p>
          <ul className="mt-1 list-inside list-disc text-xs text-yellow-700 space-y-1">
            <li>
              Pastikan ngrok TCP tunnel sudah running: <code className="bg-yellow-100 px-1 rounded">ngrok tcp 8728</code>
            </li>
            <li>URL ngrok berubah setiap restart (free plan)</li>
            <li>Konfigurasi MikroTik harus allow IP ngrok (lihat guide)</li>
          </ul>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={isLoading || isTestingConnection || type !== "mikrotik"}
        >
          {isTestingConnection ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : initialData ? "Update Router" : "Create Router"}
        </Button>
      </div>
    </form>
  );
}
