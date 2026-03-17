"use client";

import { useEffect, useState, useCallback } from "react";
import { PageLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities";
import { superAdminService } from "@/lib/api/superAdminService";
import { 
  MessageSquare, 
  RefreshCcw, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone,
  QrCode,
  LogOut,
  Zap,
  ShieldCheck,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notificationStore";
import QRCodeComponent from "react-qr-code";

export default function WhatsAppSetupPage() {
  const [status, setStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [qrExpiryTime, setQrExpiryTime] = useState<number | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const { showToast } = useNotificationStore();

  // Load state from localStorage on mount
  useEffect(() => {
    const savedQr = localStorage.getItem("wa_platform_qr");
    const savedExpiry = localStorage.getItem("wa_platform_qr_expiry");
    
    if (savedQr && savedExpiry) {
      const expiry = parseInt(savedExpiry);
      if (Date.now() < expiry) {
        setQrCode(savedQr);
        setQrExpiryTime(expiry);
        setQrExpired(false);
      } else {
        setQrCode(savedQr);
        setQrExpiryTime(expiry);
        setQrExpired(true);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (qrCode) localStorage.setItem("wa_platform_qr", qrCode);
    if (qrExpiryTime) localStorage.setItem("wa_platform_qr_expiry", qrExpiryTime.toString());
  }, [qrCode, qrExpiryTime]);

  const fetchStatus = useCallback(async () => {
    console.log("[WA Setup] Fetching WhatsApp status...");
    try {
      const data = await superAdminService.getWhatsAppStatus();
      console.log("[WA Setup] Status received:", data);
      setStatus(data);
    } catch (error: any) {
      console.error("[WA Setup] Failed to fetch WA status:", error);
      console.error("[WA Setup] Error details:", {
        message: error.message,
        response: error.response,
        stack: error.stack
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQR = useCallback(async (isManual = false) => {
    // If not manual call, and we already have a valid/expired QR in state, don't auto-fetch
    if (!isManual && qrCode) return;

    console.log("[WA Setup] Fetching QR code...");
    try {
      const data = await superAdminService.getWhatsAppQR();
      console.log("[WA Setup] QR response:", data);
      if (data.qr) {
        console.log("[WA Setup] QR code received, length:", data.qr?.length);
        setQrCode(data.qr);
        // Set expiry time to 1 minute from now
        const newExpiry = Date.now() + 1 * 60 * 1000;
        setQrExpiryTime(newExpiry);
        setQrExpired(false);
        localStorage.setItem("wa_platform_qr", data.qr);
        localStorage.setItem("wa_platform_qr_expiry", newExpiry.toString());
      } else {
        console.warn("[WA Setup] No QR code in response");
      }
    } catch (error: any) {
      console.error("[WA Setup] Failed to fetch QR:", error);
      console.error("[WA Setup] Error details:", {
        message: error.message,
        response: error.response,
        stack: error.stack
      });
    }
  }, [qrCode]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Check QR expiry every second
  useEffect(() => {
    if (!qrExpiryTime) return;
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((qrExpiryTime - Date.now()) / 1000));
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
        console.log("[WA Setup] QR code expired");
        setQrExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [qrExpiryTime]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    // Only poll status if QR hasn't expired
    if (!qrExpired && (status?.status === "qr_ready" || status?.status === "needs_qr" || status?.status === "not_connected")) {
      // Poll status only (not QR) to check if user scanned
      interval = setInterval(() => {
        fetchStatus();
      }, 5000); // Poll every 5s to check connection status
    } else if (status?.status === "connecting") {
        interval = setInterval(fetchStatus, 5000);
    }
    return () => clearInterval(interval);
  }, [status?.status, qrExpired, fetchStatus]);

  const handleConnect = async () => {
    console.log("[WA Setup] Initiating WhatsApp connection...");
    setActionLoading(true);
    try {
      const resp = await superAdminService.connectWhatsApp();
      console.log("[WA Setup] Connect response:", resp);
      setStatus(resp);
      if (resp.qr) {
        console.log("[WA Setup] QR code received in connect response");
        setQrCode(resp.qr);
      }
      showToast("Memulai koneksi WhatsApp...", "info");
    } catch (error: any) {
      console.error("[WA Setup] Failed to connect WhatsApp:", error);
      console.error("[WA Setup] Error details:", {
        message: error.message,
        response: error.response,
        data: error.response?.data,
        stack: error.stack
      });
      showToast(error.response?.data?.error || error.message || "Gagal inisialisasi koneksi", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case "connected":
        return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      case "qr_ready":
      case "needs_qr":
        return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "connecting":
        return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      default:
        return "text-slate-400 bg-slate-400/10 border-slate-400/20";
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case "connected":
        return "Terhubung";
      case "qr_ready":
      case "needs_qr":
        return "Menunggu Scan QR";
      case "connecting":
        return "Menghubungkan...";
      case "not_connected":
        return "Tidak Terhubung";
      default:
        return s || "Unknown";
    }
  };

  return (
    <PageLayout
      title="Platform WhatsApp Setup"
      subtitle="Konfigurasi WhatsApp utama untuk pengiriman OTP & notifikasi sistem."
      breadcrumbs={[{ label: "Super Admin", href: "/superadmin" }, { label: "WhatsApp Setup" }]}
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Status Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden border-none shadow-xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="space-y-4 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <div className="p-3 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/10">
                      <MessageSquare className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight">System WhatsApp Service</h2>
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border mt-2",
                        status ? getStatusColor(status.status) : "text-white/40 bg-white/5 border-white/10"
                      )}>
                        <div className={cn("h-2 w-2 rounded-full", status?.status === "connected" ? "bg-emerald-500 animate-pulse" : "bg-current")} />
                        {getStatusLabel(status?.status)}
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-400 max-w-md text-sm leading-relaxed">
                    Pastikan nomor ini aktif dan terhubung ke internet agar pengiriman OTP registrasi tidak terhambat bre.
                  </p>
                </div>

                <div className="flex gap-3">
                   <Button 
                    variant="outline" 
                    className="bg-white/5 border-white/10 text-white hover:bg-white/10 font-bold px-6 py-6 rounded-2xl"
                    onClick={() => {
                        setLoading(true);
                        fetchStatus();
                    }}
                   >
                     <RefreshCcw className={cn("h-5 w-5 mr-2", loading && "animate-spin")} />
                     Refresh
                   </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Connection Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="h-full border-none shadow-lg overflow-hidden group">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <Smartphone className="h-5 w-5" />
                  Bagaimana Cara Konek?
                </CardTitle>
                <CardDescription>Ikuti langkah simpel ini bre.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  {[
                    { step: 1, text: "Buka WhatsApp di HP utama lu.", icon: Smartphone },
                    { step: 2, text: "Masuk ke menu 'Linked Devices' / 'Perangkat Tertaut'.", icon: Zap },
                    { step: 3, text: "Klik 'Link a Device' dan scan QR code disamping.", icon: QrCode },
                  ].map((s) => (
                    <div key={s.step} className="flex gap-4 items-start group/step">
                      <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm shrink-0 group-hover/step:bg-indigo-600 group-hover/step:text-white transition-colors duration-300">
                        {s.step}
                      </div>
                      <p className="text-slate-600 text-sm font-medium mt-1.5">{s.text}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-amber-800 text-xs shadow-sm">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p>OTP tidak akan terkirim jika sesi WhatsApp ini terputus atau HP mati bre. Selalu pantau status di dashboard admin.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* QR Code Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="h-full border-none shadow-lg overflow-hidden flex flex-col items-center justify-center text-center p-8 bg-white relative">
                {status?.status === "connected" ? (
                    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="w-48 h-48 rounded-full bg-emerald-50 flex items-center justify-center mx-auto shadow-inner border border-emerald-100">
                            <CheckCircle2 className="h-24 w-24 text-emerald-500" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-900">Sistem Berjalan Lancar</h3>
                            <p className="text-slate-500 text-sm max-w-[250px] mx-auto">WhatsApp Platform sudah terhubung. Siap kirim ribuan OTP! 🚀</p>
                        </div>
                        <Button variant="outline" className="text-red-500 border-red-100 hover:bg-red-50 font-bold px-8 rounded-2xl">
                            <LogOut className="h-4 w-4 mr-2" />
                            Putuskan Koneksi
                        </Button>
                    </div>
                ) : (status?.status === "qr_ready" || status?.status === "needs_qr" || status?.status === "not_connected") && qrCode ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="relative">
                            <div className={cn(
                                "p-4 bg-white rounded-3xl shadow-2xl border border-slate-100 ring-4 ring-slate-50 transition-all duration-300",
                                qrExpired && "opacity-30 grayscale"
                            )}>
                                <QRCodeComponent 
                                  value={qrCode} 
                                  size={256}
                                  level="H"
                                  className="mx-auto"
                                />
                            </div>
                            
                            {/* Expired Overlay */}
                            {qrExpired && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-3xl animate-in fade-in zoom-in">
                                    <div className="text-center space-y-4">
                                        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                                            <AlertCircle className="h-8 w-8 text-red-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-900">QR Code Expired</h4>
                                            <p className="text-xs text-slate-500 mt-1">Klik tombol di bawah untuk generate ulang</p>
                                        </div>
                                        <Button 
                                            onClick={() => {
                                                setQrCode(null);
                                                setQrExpired(false);
                                                setQrExpiryTime(null);
                                                fetchQR(true);
                                            }}
                                            className="bg-indigo-600 hover:bg-indigo-700 font-bold px-6 py-3 rounded-xl"
                                        >
                                            <RefreshCcw className="h-4 w-4 mr-2" />
                                            Generate QR Baru
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="space-y-2">
                           <h3 className="text-lg font-black text-slate-900">Scan QR Code Ini</h3>
                           {!qrExpired && qrExpiryTime && (
                               <div className="flex items-center justify-center gap-2 text-xs">
                                   <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                   <p className="text-amber-600 font-bold">
                                       Expired dalam {timeRemaining} detik
                                   </p>
                               </div>
                           )}
                           {qrExpired && (
                               <p className="text-red-500 text-xs font-bold">QR Code sudah tidak valid</p>
                           )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                         <LoadingSpinner size={48} className="text-indigo-600" />
                         <p className="text-slate-500 font-bold animate-pulse text-sm">Menyiapkan Sesi WhatsApp...</p>
                         <Button 
                            onClick={handleConnect} 
                            disabled={actionLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 font-black px-8 py-6 rounded-2xl mt-4"
                         >
                             Mulai Koneksi Baru
                         </Button>
                    </div>
                )}
            </Card>
          </motion.div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
                { title: "Real-time OTP", desc: "Kirim kode verifikasi instan via WA.", icon: Zap },
                { title: "Secure Access", desc: "Data terenkripsi end-to-end.", icon: ShieldCheck },
                { title: "No Extra Fees", desc: "Pake nomor sendiri, tanpa biaya.", icon: MessageSquare },
            ].map((f, i) => (
                <motion.div 
                    key={f.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + (i * 0.1) }}
                    className="p-6 rounded-3xl bg-white shadow-sm border border-slate-100 flex items-start gap-4 hover:shadow-md transition-shadow"
                >
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <f.icon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-900 text-sm">{f.title}</h4>
                        <p className="text-xs text-slate-500 mt-1">{f.desc}</p>
                    </div>
                </motion.div>
            ))}
        </div>
      </div>
    </PageLayout>
  );
}
