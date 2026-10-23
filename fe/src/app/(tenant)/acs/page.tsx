"use client";

import React, { useState, useEffect } from "react";
import { acsService, SetWiFiPayload } from "@/lib/api/acsService";
import { ONTDevice } from "@/lib/api/types";
import { 
  Wifi, 
  RotateCw, 
  Power, 
  Search, 
  Server, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Cpu, 
  Activity, 
  Info, 
  Lock, 
  Copy, 
  Check,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ACSPage() {
  const [devices, setDevices] = useState<ONTDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Modals state
  const [selectedDevice, setSelectedDevice] = useState<ONTDevice | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [wifiModalOpen, setWifiModalOpen] = useState(false);
  const [rebootModalOpen, setRebootModalOpen] = useState(false);

  // WiFi Form
  const [wifiForm, setWifiForm] = useState<SetWiFiPayload>({ ssid: "", password: "" });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await acsService.listDevices();
      setDevices(res.data || []);
    } catch (err: any) {
      console.error("Failed to load ACS devices:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAcsUrl = () => {
    const acsUrl = typeof window !== "undefined" 
      ? `http://${window.location.hostname}:7547` 
      : "http://<IP_SERVER>:7547";
    navigator.clipboard.writeText(acsUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleOpenWifiModal = (dev: ONTDevice) => {
    setSelectedDevice(dev);
    setWifiForm({
      ssid: dev.ssid || "",
      password: "",
    });
    setActionMessage(null);
    setWifiModalOpen(true);
  };

  const handleOpenRebootModal = (dev: ONTDevice) => {
    setSelectedDevice(dev);
    setActionMessage(null);
    setRebootModalOpen(true);
  };

  const handleOpenDetailModal = (dev: ONTDevice) => {
    setSelectedDevice(dev);
    setDetailModalOpen(true);
  };

  const handleSaveWifi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await acsService.setWiFi(selectedDevice.id, wifiForm);
      setActionMessage({ type: "success", text: res.message || "Pengaturan WiFi berhasil dikirim ke ONT!" });
      setTimeout(() => {
        setWifiModalOpen(false);
        fetchDevices();
      }, 1500);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || err.message || "Gagal mengubah WiFi" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReboot = async () => {
    if (!selectedDevice) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await acsService.reboot(selectedDevice.id);
      setActionMessage({ type: "success", text: res.message || "Perintah reboot berhasil dikirim!" });
      setTimeout(() => {
        setRebootModalOpen(false);
        fetchDevices();
      }, 1500);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || err.message || "Gagal me-reboot ONT" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshDevice = async (id: string) => {
    try {
      await acsService.refresh(id);
      fetchDevices();
    } catch (err) {
      console.error("Failed to refresh device:", err);
    }
  };

  // Helper format uptime
  const formatUptime = (seconds: number) => {
    if (!seconds || seconds <= 0) return "-";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}h ${hours}j ${mins}m`;
    if (hours > 0) return `${hours}j ${mins}m`;
    return `${mins}m`;
  };

  // Filtered devices
  const filteredDevices = devices.filter((dev) => {
    const matchesSearch = 
      (dev.serial_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (dev.manufacturer || "").toLowerCase().includes(search.toLowerCase()) ||
      (dev.product_class || "").toLowerCase().includes(search.toLowerCase()) ||
      (dev.ip_address || "").toLowerCase().includes(search.toLowerCase()) ||
      (dev.ssid || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || dev.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Signal badge helper
  const renderSignalBadge = (rx?: number | null) => {
    if (rx === undefined || rx === null) {
      return <Badge variant="outline" className="text-slate-400 font-mono text-xs">N/A</Badge>;
    }
    // Fiber optic attenuation scale
    if (rx >= -24.0) {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-xs gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {rx.toFixed(2)} dBm (Bagus)
        </Badge>
      );
    } else if (rx >= -27.0) {
      return (
        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-mono text-xs gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {rx.toFixed(2)} dBm (Waspada)
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 font-mono text-xs gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
          {rx.toFixed(2)} dBm (Kritis)
        </Badge>
      );
    }
  };

  // Metrics
  const totalCount = devices.length;
  const onlineCount = devices.filter((d) => d.status === "online").length;
  const offlineCount = devices.filter((d) => d.status === "offline").length;
  const criticalSignalCount = devices.filter((d) => d.rx_power_dbm !== null && d.rx_power_dbm !== undefined && d.rx_power_dbm < -27.0).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Server className="w-7 h-7 text-indigo-600" />
              ACS &amp; Manajemen ONT
            </h1>
            <Badge className="bg-indigo-500/20 text-indigo-600 border-indigo-500/30 text-[11px] font-semibold tracking-wider">
              TR-069
            </Badge>
            <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-[11px] font-semibold tracking-wider">
              DEV MODE
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Pusat kontrol terpadu untuk monitoring sinyal redaman FO, ganti WiFi, dan remote reboot modem/ONT pelanggan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDevices}
            disabled={loading}
            className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 gap-2 shadow-sm"
          >
            <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Top Banner: Panduan Koneksi ONT */}
      <Card className="bg-indigo-950 border-indigo-800/60 shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 mt-0.5 md:mt-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                URL Koneksi ACS (TR-069 Inform)
              </h4>
              <p className="text-xs text-indigo-200/80 mt-0.5 max-w-lg">
                Masukkan URL berikut ke menu <strong className="text-indigo-100">Network/Application &gt; TR-069 / CWMP</strong> di web GUI modem ONT (ZTE, Huawei, VSOL, dll):
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs font-mono bg-indigo-900/80 text-indigo-200 px-3 py-1 rounded-md border border-indigo-600/40">
                  {typeof window !== "undefined" ? `http://${window.location.hostname}:7547` : "http://<IP_SERVER>:7547"}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyAcsUrl}
                  className="h-7 px-2 text-xs text-indigo-300 hover:text-white hover:bg-indigo-800/60"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="ml-1">{copiedUrl ? "Tersalin" : "Salin"}</span>
                </Button>
              </div>
            </div>
          </div>
          <div className="text-xs text-indigo-300 border-l border-indigo-700/60 pl-4 space-y-1 shrink-0">
            <div>Periodic Inform: <strong className="text-white">300s</strong></div>
            <div>Auth: <strong className="text-white">None / Optional</strong></div>
          </div>
        </CardContent>
      </Card>


      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Perangkat</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
            </div>
            <div className="p-3 bg-slate-100 rounded-xl text-slate-500 border border-slate-200">
              <Cpu className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Online</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{onlineCount}</h3>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Offline</p>
              <h3 className="text-2xl font-bold text-slate-500 mt-1">{offlineCount}</h3>
            </div>
            <div className="p-3 bg-slate-100 rounded-xl text-slate-400 border border-slate-200">
              <XCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Sinyal Kritis (&lt; -27 dBm)</p>
              <h3 className="text-2xl font-bold text-rose-600 mt-1">{criticalSignalCount}</h3>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl text-rose-500 border border-rose-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">Daftar ONT Terhubung</CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Semua unit modem pelanggan yang terdaftar dan terdeteksi di Auto Configuration Server
              </CardDescription>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari SN, Model, IP, SSID..."
                  className="pl-9 bg-white border-slate-300 text-xs h-9 text-slate-700 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="flex items-center rounded-lg bg-slate-100 border border-slate-200 p-0.5 text-xs">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    statusFilter === "all" ? "bg-indigo-600 text-white font-medium shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setStatusFilter("online")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    statusFilter === "online" ? "bg-emerald-600 text-white font-medium shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Online
                </button>
                <button
                  onClick={() => setStatusFilter("offline")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    statusFilter === "offline" ? "bg-slate-700 text-white font-medium shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Offline
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/80">
                  <th className="py-3 px-4 font-medium">Perangkat &amp; Model</th>
                  <th className="py-3 px-4 font-medium">Serial Number (PON SN)</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Redaman Optik (RX)</th>
                  <th className="py-3 px-4 font-medium">WiFi SSID</th>
                  <th className="py-3 px-4 font-medium">IP &amp; Uptime</th>
                  <th className="py-3 px-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RotateCw className="w-5 h-5 animate-spin text-indigo-500" />
                        <span>Memuat data perangkat ACS...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Tidak ada modem/ONT yang cocok dengan pencarian atau filter.
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((dev) => (
                    <tr key={dev.id} className="hover:bg-slate-50 transition-colors">
                      {/* Perangkat & Model */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                            <Wifi className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{dev.product_class || "Generic ONT"}</div>
                            <div className="text-[11px] text-slate-500">{dev.manufacturer || "TR-069 Device"}</div>
                          </div>
                        </div>
                      </td>

                      {/* Serial Number */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-700 font-medium">{dev.serial_number}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{dev.mac_address || "-"}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {dev.status === "online" ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Online
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-300 text-[11px]">
                            Offline
                          </Badge>
                        )}
                      </td>

                      {/* Redaman Optik */}
                      <td className="py-3 px-4">
                        {renderSignalBadge(dev.rx_power_dbm)}
                      </td>

                      {/* WiFi SSID */}
                      <td className="py-3 px-4">
                        {dev.ssid ? (
                          <div>
                            <div className="text-slate-700 font-medium truncate max-w-[140px]">{dev.ssid}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-emerald-600">2.4 GHz Aktif</span>
                              {dev.ssid_list && dev.ssid_list.length > 1 && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-600 font-semibold border border-indigo-200">
                                  +{dev.ssid_list.length - 1} SSID
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* IP & Uptime */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-700">{dev.ip_address || "-"}</div>
                        <div className="text-[10px] text-slate-400">Up: {formatUptime(dev.uptime_seconds)}</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDetailModal(dev)}
                            className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Detail Parameter"
                          >
                            <Info className="w-3.5 h-3.5 mr-1" />
                            Detail
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenWifiModal(dev)}
                            className="h-7 px-2 text-xs border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                            title="Atur WiFi"
                          >
                            <Wifi className="w-3.5 h-3.5 mr-1" />
                            WiFi
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenRebootModal(dev)}
                            className="h-7 px-2 text-xs border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                            title="Reboot ONT"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Atur WiFi */}
      <Dialog open={wifiModalOpen} onOpenChange={setWifiModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Wifi className="w-5 h-5 text-indigo-400" />
              Atur WiFi ONT Pelanggan
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Ubah Nama SSID dan Password WiFi langsung tanpa login ke modem ONT ({selectedDevice?.serial_number}).
            </DialogDescription>
          </DialogHeader>

          {actionMessage && (
            <div className={`p-3 rounded-lg text-xs border ${
              actionMessage.type === "success" 
                ? "bg-emerald-950/40 border-emerald-800 text-emerald-300" 
                : "bg-rose-950/40 border-rose-800 text-rose-300"
            }`}>
              {actionMessage.text}
            </div>
          )}

          <form onSubmit={handleSaveWifi} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Nama WiFi (SSID)</label>
              <Input
                value={wifiForm.ssid}
                onChange={(e) => setWifiForm({ ...wifiForm, ssid: e.target.value })}
                placeholder="Contoh: WiFi-Rumah-Pelanggan"
                required
                className="bg-slate-950 border-slate-800 text-white text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Password Baru</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  value={wifiForm.password}
                  onChange={(e) => setWifiForm({ ...wifiForm, password: e.target.value })}
                  placeholder="Minimal 8 karakter"
                  required
                  minLength={8}
                  className="pl-9 bg-slate-950 border-slate-800 text-white text-xs h-9 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Password akan otomatis di-push ke modem ONT via TR-069.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setWifiModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
              >
                {actionLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                Terapkan ke ONT
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Reboot ONT */}
      <Dialog open={rebootModalOpen} onOpenChange={setRebootModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Power className="w-5 h-5 text-rose-400" />
              Konfirmasi Reboot ONT
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Apakah Anda yakin ingin me-restart modem pelanggan dengan Serial Number:{" "}
              <strong className="text-white font-mono">{selectedDevice?.serial_number}</strong>?
            </DialogDescription>
          </DialogHeader>

          {actionMessage && (
            <div className={`p-3 rounded-lg text-xs border ${
              actionMessage.type === "success" 
                ? "bg-emerald-950/40 border-emerald-800 text-emerald-300" 
                : "bg-rose-950/40 border-rose-800 text-rose-300"
            }`}>
              {actionMessage.text}
            </div>
          )}

          <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Koneksi internet pelanggan akan terputus sementara selama proses restart (1-2 menit).</span>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRebootModalOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={actionLoading}
              onClick={handleConfirmReboot}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs gap-1.5"
            >
              {actionLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
              Reboot Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Detail ONT */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-400" />
              Detail Informasi Perangkat ONT
            </DialogTitle>
          </DialogHeader>

          {selectedDevice && (
            <div className="space-y-4 py-2 text-xs">
              {/* Device Header */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-white text-sm">{selectedDevice.product_class || "Generic ONT"}</h4>
                  <p className="text-slate-400">{selectedDevice.manufacturer || "TR-069"}</p>
                </div>
                {renderSignalBadge(selectedDevice.rx_power_dbm)}
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Serial Number (PON SN)</span>
                  <span className="font-mono text-slate-100 font-medium text-xs">{selectedDevice.serial_number}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">MAC Address</span>
                  <span className="font-mono text-slate-100 text-xs">{selectedDevice.mac_address || "-"}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">IP Address</span>
                  <span className="font-mono text-slate-100 text-xs">{selectedDevice.ip_address || "-"}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Manufacturer OUI</span>
                  <span className="font-mono text-slate-100 text-xs">{selectedDevice.oui || "-"}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Firmware / Software</span>
                  <span className="font-mono text-slate-100 text-xs">{selectedDevice.software_version || "-"}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Hardware Version</span>
                  <span className="font-mono text-slate-100 text-xs">{selectedDevice.hardware_version || "-"}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Optical TX Power</span>
                  <span className="font-mono text-slate-100 text-xs">
                    {selectedDevice.tx_power_dbm != null ? `${selectedDevice.tx_power_dbm.toFixed(2)} dBm` : <span className="text-slate-500">N/A</span>}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Total Uptime</span>
                  <span className="font-mono text-slate-100 text-xs">{formatUptime(selectedDevice.uptime_seconds)}</span>
                </div>
              </div>

              {/* Multi-SSID List */}
              {selectedDevice.ssid_list && selectedDevice.ssid_list.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-slate-300 block text-[11px] font-semibold">Daftar SSID (Multi-SSID WiFi):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedDevice.ssid_list.map((item) => (
                      <div key={item.index} className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                        <div className="truncate flex-1 min-w-0">
                          <span className="text-[10px] text-slate-500 block">SSID #{item.index}</span>
                          <span className="font-medium text-slate-100 text-xs truncate block">{item.ssid}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${item.enabled ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-slate-700 text-slate-500"}`}>
                          {item.enabled ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected LAN/WLAN Hosts */}
              {selectedDevice.connected_hosts && selectedDevice.connected_hosts.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 block text-[11px] font-semibold">Perangkat Terhubung (LAN / Klien WiFi):</span>
                    <Badge variant="outline" className="text-[10px] border-slate-700 text-indigo-300">
                      {selectedDevice.connected_hosts.length} Perangkat
                    </Badge>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedDevice.connected_hosts.map((host, i) => (
                      <div key={i} className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-100 text-[11px] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            {host.hostname || "Perangkat Klien"}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {host.ip_address} &bull; {host.mac_address}
                          </div>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono">Aktif</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inform Time */}
              <div className="text-slate-400 text-[11px] flex items-center justify-between px-1 pt-1 border-t border-slate-800">
                <span>Terakhir Inform TR-069:</span>
                <span className="text-slate-200">
                  {selectedDevice.last_inform ? new Date(selectedDevice.last_inform).toLocaleString("id-ID") : "-"}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailModalOpen(false)}
              className="border-slate-700 bg-slate-800 text-slate-200"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
