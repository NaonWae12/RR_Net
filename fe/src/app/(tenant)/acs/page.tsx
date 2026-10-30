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
  Info, 
  Lock, 
  Copy, 
  Check,
  Plus,
  Edit2,
  Sparkles,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Trash2,
  Clock
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
import { useTenantStore } from "@/stores/tenantStore";

export default function ACSPage() {
  const tenantSlug = useTenantStore((s) => s.slug || s.tenant?.slug);
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
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Forms
  const [registerForm, setRegisterForm] = useState<{ serial_number: string; label: string }>({
    serial_number: "",
    label: "",
  });
  const [editForm, setEditForm] = useState<{ serial_number: string; label: string }>({ serial_number: "", label: "" });
  const [wifiForm, setWifiForm] = useState<SetWiFiPayload>({ ssid: "", password: "" });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

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

  const handleOpenWifiModal = (dev: ONTDevice, initialSlot?: number, initialSsid?: string) => {
    setSelectedDevice(dev);
    const slot = initialSlot || 1;
    let ssidToUse = initialSsid || "";
    if (!ssidToUse) {
      if (dev.ssid_list && dev.ssid_list.length > 0) {
        const found = dev.ssid_list.find((s) => s.index === slot) || dev.ssid_list[0];
        ssidToUse = found.ssid;
      } else {
        ssidToUse = dev.ssid || "";
      }
    }
    setWifiForm({
      slot: slot,
      ssid: ssidToUse,
      password: "",
    });
    setShowCurrentPassword(false);
    setShowNewPassword(false);
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

  const handleOpenRegisterModal = () => {
    setRegisterForm({
      serial_number: "",
      label: "",
    });
    setActionMessage(null);
    setRegisterModalOpen(true);
  };

  const handleOpenEditModal = (dev: ONTDevice) => {
    setSelectedDevice(dev);
    setEditForm({
      serial_number: dev.serial_number || "",
      label: dev.label || "",
    });
    setActionMessage(null);
    setEditModalOpen(true);
  };

  const handleOpenDeleteModal = (dev: ONTDevice) => {
    setSelectedDevice(dev);
    setActionMessage(null);
    setDeleteModalOpen(true);
  };

  // Actions
  const handleSaveWifi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    if (wifiForm.password && wifiForm.password.length < 8) {
      setActionMessage({ type: "error", text: "Password WiFi minimal 8 karakter jika diisi" });
      return;
    }
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sn = registerForm.serial_number.trim();
    if (!sn) {
      setActionMessage({ type: "error", text: "Serial Number modem wajib diisi" });
      return;
    }
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await acsService.register({
        device_id: sn,
        serial_number: sn,
        label: registerForm.label.trim(),
      });
      setActionMessage({ type: "success", text: res.message || "Perangkat berhasil didaftarkan ke tenant!" });
      setTimeout(() => {
        setRegisterModalOpen(false);
        fetchDevices();
      }, 1200);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || err.message || "Gagal mendaftarkan perangkat" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    const sn = editForm.serial_number.trim();
    if (!sn) {
      setActionMessage({ type: "error", text: "Serial Number tidak boleh kosong" });
      return;
    }
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await acsService.updateMetadata(selectedDevice.id, {
        serial_number: sn,
        label: editForm.label.trim(),
      });
      setActionMessage({ type: "success", text: res.message || "Data perangkat berhasil diperbarui!" });
      setTimeout(() => {
        setEditModalOpen(false);
        fetchDevices();
      }, 1200);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || err.message || "Gagal memperbarui data" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedDevice) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await acsService.deleteDevice(selectedDevice.id);
      setActionMessage({ type: "success", text: res.message || "Perangkat berhasil dihapus dari tenant!" });
      setTimeout(() => {
        setDeleteModalOpen(false);
        setEditModalOpen(false);
        setDetailModalOpen(false);
        fetchDevices();
      }, 1200);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || err.message || "Gagal menghapus perangkat" });
    } finally {
      setActionLoading(false);
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
      (dev.label || "").toLowerCase().includes(search.toLowerCase()) ||
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
    if (rx >= -24.0) {
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {rx.toFixed(2)} dBm (Bagus)
        </Badge>
      );
    } else if (rx >= -27.0) {
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-mono text-xs gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {rx.toFixed(2)} dBm (Waspada)
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-mono text-xs gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
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
            <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[11px] font-semibold tracking-wider">
              MULTI-TENANT
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manajemen modem ONT khusus tenant Anda via auto-detect PPPoE atau pendaftaran Serial Number.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDevices}
            disabled={loading}
            className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 gap-2 shadow-sm"
          >
            <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleOpenRegisterModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Daftarkan ONT
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
              <p className="text-xs font-medium text-slate-500">Total ONT Terdaftar</p>
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
              <CardTitle className="text-base font-semibold text-slate-900">Daftar ONT Tenant</CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Unit modem ONT pelanggan yang terdaftar dan ditautkan ke akun tenant Anda
              </CardDescription>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari Label, SN, Model, IP..."
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
                  <th className="py-3 px-4 font-medium">Perangkat &amp; Label</th>
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
                        <span>Memuat data ONT tenant...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                          <Server className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800">
                            {devices.length === 0 ? "Belum Ada ONT Terdaftar" : "Tidak Ada Hasil Pencarian"}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            {devices.length === 0
                              ? "Modem PPPoE akan otomatis terdaftar saat dial. Untuk modem IP Statik atau Hotspot, klik tombol di bawah untuk mendaftarkan Serial Number."
                              : "Coba ubah kata kunci pencarian atau filter status untuk menemukan perangkat."}
                          </p>
                        </div>
                        {devices.length === 0 && (
                          <Button
                            size="sm"
                            onClick={handleOpenRegisterModal}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm mt-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Daftarkan ONT by SN
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((dev) => (
                    <tr key={dev.id} className="hover:bg-slate-50 transition-colors">
                      {/* Perangkat & Label */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                            <Wifi className="w-4 h-4" />
                          </div>
                          <div>
                            {dev.label ? (
                              <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                                <span>{dev.label}</span>
                              </div>
                            ) : null}
                            <div className={`text-slate-700 ${dev.label ? "text-[11px] text-slate-500" : "font-semibold text-xs"}`}>
                              {dev.product_class || "Generic ONT"} &bull; {dev.manufacturer || "TR-069"}
                            </div>
                            {dev.client_name ? (
                              <Badge variant="outline" className="mt-1 text-[10px] bg-slate-50 text-indigo-700 border-indigo-200 px-1.5 py-0">
                                Pelanggan: {dev.client_name}
                              </Badge>
                            ) : null}
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
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDetailModal(dev)}
                            className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Detail Parameter"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditModal(dev)}
                            className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Edit Label"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDeleteModal(dev)}
                            className="h-7 px-2 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Hapus / Lepas Perangkat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal: Daftarkan ONT Baru by Serial Number */}
      <Dialog open={registerModalOpen} onOpenChange={setRegisterModalOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" />
              Daftarkan ONT Baru (by Serial Number)
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Daftarkan modem ONT secara manual untuk koneksi IP Statik, Bridge, Hotspot, atau Pre-Provisioning.
            </DialogDescription>
          </DialogHeader>

          {actionMessage && (
            <div className={`p-3 rounded-lg text-xs border ${
              actionMessage.type === "success" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}>
              {actionMessage.text}
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 py-1">
            <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-xl p-3 text-xs text-indigo-950 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-900">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                Auto-Detect PPPoE Otomatis
              </div>
              <p className="text-[11px] text-indigo-800/90 leading-relaxed">
                Jika pelanggan dial PPPoE dengan format <strong className="font-mono text-indigo-950">username_{tenantSlug || "slug"}</strong>, modem ONT akan <strong>otomatis terikat</strong> ke tenant &amp; profil pelanggan Anda tanpa perlu registrasi SN.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Serial Number (SN) Modem <span className="text-rose-500">*</span>
              </label>
              <Input
                value={registerForm.serial_number}
                onChange={(e) => setRegisterForm({ ...registerForm, serial_number: e.target.value })}
                placeholder="Contoh: ELWRP8LH6803185 atau 78C1A7-F460-..."
                required
                className="bg-white border-slate-300 text-xs font-mono h-9"
              />
              <p className="text-[11px] text-slate-500">
                Tercetak pada stiker fisik di bawah modem ONT.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Label / Catatan Lokasi (Opsional)</label>
              <Input
                value={registerForm.label}
                onChange={(e) => setRegisterForm({ ...registerForm, label: e.target.value })}
                placeholder="Contoh: ONT Rumah Pak Budi - Blok A3 (atau IP Statik Kantor)"
                className="bg-white border-slate-300 text-xs h-9"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRegisterModalOpen(false)}
                className="text-slate-600 hover:text-slate-900"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
              >
                {actionLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                Simpan &amp; Daftarkan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Metadata / Label & SN */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-indigo-600" />
              Edit Informasi &amp; SN Perangkat
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Koreksi Serial Number atau ubah label penamaan modem ONT.
            </DialogDescription>
          </DialogHeader>

          {actionMessage && (
            <div className={`p-3 rounded-lg text-xs border ${
              actionMessage.type === "success" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}>
              {actionMessage.text}
            </div>
          )}

          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Serial Number (SN) *</label>
              <Input
                value={editForm.serial_number}
                onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })}
                placeholder="Contoh: ELWRP8LH6803185 atau 48575443260C42A8"
                required
                className="bg-white border-slate-300 text-xs font-mono h-9"
              />
              <p className="text-[11px] text-slate-500">
                Ubah jika terdapat salah ketik saat input pendaftaran awal.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Label / Catatan Lokasi (Opsional)</label>
              <Input
                value={editForm.label}
                onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                placeholder="Contoh: ONT Rumah Budi - RT 02"
                className="bg-white border-slate-300 text-xs h-9"
              />
            </div>

            <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between w-full">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditModalOpen(false);
                  if (selectedDevice) handleOpenDeleteModal(selectedDevice);
                }}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs gap-1.5 px-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Perangkat
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditModalOpen(false)}
                  className="text-slate-600 hover:text-slate-900 text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
                >
                  {actionLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Atur WiFi */}
      <Dialog open={wifiModalOpen} onOpenChange={setWifiModalOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-indigo-600" />
              Atur WiFi ONT Pelanggan
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Ubah Nama SSID dan Password WiFi langsung tanpa login ke modem ONT ({selectedDevice?.serial_number}).
            </DialogDescription>
          </DialogHeader>

          {actionMessage && (
            <div className={`p-3 rounded-lg text-xs border ${
              actionMessage.type === "success" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}>
              {actionMessage.text}
            </div>
          )}

          <form onSubmit={handleSaveWifi} className="space-y-4 py-2">
            {/* Slot selector if multi-SSID is present */}
            {selectedDevice?.ssid_list && selectedDevice.ssid_list.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Pilih SSID yang Ingin Diubah</label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedDevice.ssid_list.map((s) => {
                    const isSelected = (wifiForm.slot || 1) === s.index;
                    return (
                      <button
                        key={s.index}
                        type="button"
                        onClick={() => {
                          setWifiForm({
                            ...wifiForm,
                            slot: s.index,
                            ssid: s.ssid,
                            password: "",
                          });
                        }}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-1 ring-indigo-500 shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="font-semibold">SSID #{s.index}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            s.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {s.enabled ? "Aktif" : "Nonaktif"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 truncate mt-1 font-mono">
                          {s.ssid}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Nama WiFi (SSID {wifiForm.slot ? `#${wifiForm.slot}` : ""})
              </label>
              <Input
                value={wifiForm.ssid}
                onChange={(e) => setWifiForm({ ...wifiForm, ssid: e.target.value })}
                placeholder="Contoh: WiFi-Rumah-Pelanggan"
                required
                className="bg-white border-slate-300 text-slate-900 text-xs h-9 focus-visible:ring-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
                <span>Password Baru WiFi</span>
                <span className="text-[10px] text-slate-400 font-normal">(Opsional)</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  value={wifiForm.password}
                  onChange={(e) => setWifiForm({ ...wifiForm, password: e.target.value })}
                  placeholder="Kosongkan jika hanya ingin ganti nama SSID"
                  className="pl-9 bg-white border-slate-300 text-slate-900 text-xs h-9 font-mono focus-visible:ring-indigo-500"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Isi minimal 8 karakter jika ingin mengganti password WiFi. Jika dikosongkan, password lama tetap dipertahankan.
              </p>
            </div>

            <div className="bg-amber-50/90 border border-amber-200/90 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Sinkronisasi Otomatis:</strong> Perubahan akan diterapkan ke modem ONT dalam <strong>~60 detik</strong> (sesuai siklus Periodic Inform TR-069) tanpa perlu restart modem.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setWifiModalOpen(false)}
                className="text-slate-600 hover:text-slate-900 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
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
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Power className="w-5 h-5 text-rose-600" />
              Konfirmasi Reboot ONT
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Apakah Anda yakin ingin me-restart modem pelanggan dengan Serial Number:{" "}
              <strong className="text-slate-900 font-mono">{selectedDevice?.serial_number}</strong>?
            </DialogDescription>
          </DialogHeader>

          {actionMessage && (
            <div className={`p-3 rounded-lg text-xs border ${
              actionMessage.type === "success" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}>
              {actionMessage.text}
            </div>
          )}

          <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>Koneksi internet pelanggan akan terputus sementara selama proses restart (1-2 menit).</span>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRebootModalOpen(false)}
              className="text-slate-600 hover:text-slate-900"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={actionLoading}
              onClick={handleConfirmReboot}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
            >
              {actionLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
              Reboot Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Hapus / Lepas Perangkat ONT */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" />
              Hapus / Lepas Perangkat ONT
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Apakah Anda yakin ingin melepas perangkat ini dari tenant Anda?
            </DialogDescription>
          </DialogHeader>

          {actionMessage && (
            <div className={`p-3 rounded-lg text-xs border ${
              actionMessage.type === "success" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}>
              {actionMessage.text}
            </div>
          )}

          <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-lg text-xs text-rose-800 space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Perangkat: {selectedDevice?.label || selectedDevice?.product_class || "ONT"}</span>
            </div>
            <div className="font-mono text-[11px] text-rose-700">
              SN: {selectedDevice?.serial_number}
            </div>
            <p className="pt-1 text-[11px] text-rose-600 leading-relaxed">
              Perangkat tidak akan dihapus dari fisik modem, namun tidak akan dikelola lagi oleh tenant Anda sampai didaftarkan kembali.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteModalOpen(false)}
              className="text-slate-600 hover:text-slate-900 text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={actionLoading}
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
            >
              {actionLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
              Hapus Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Detail Parameter ONT */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="shrink-0 pb-2 border-b border-slate-100">
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" />
              Detail Informasi Parameter ONT
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Data telemetri lengkap yang diekstrak dari Auto Configuration Server (TR-069 CWMP).
            </DialogDescription>
          </DialogHeader>

          {selectedDevice && (
            <div className="space-y-4 py-2 overflow-y-auto pr-1 flex-1">
              {/* Primary Identity Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                      {selectedDevice.product_class || "ONT Device"}
                      <span className="text-xs font-normal text-slate-500">({selectedDevice.manufacturer || "Generic"})</span>
                    </div>
                    {selectedDevice.label && (
                      <div className="text-xs text-indigo-700 font-medium mt-0.5">
                        Label: {selectedDevice.label}
                      </div>
                    )}
                    <div className="text-xs font-mono text-indigo-600 font-semibold mt-0.5">
                      SN: {selectedDevice.serial_number}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {selectedDevice.status === "online" ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                        Online
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500 border-slate-300 text-xs">
                        Offline
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRefreshDevice(selectedDevice.id)}
                      className="h-6 px-2 text-[10px] text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                    >
                      <RotateCw className="w-3.5 h-3.5 mr-1" />
                      Refresh TR-069
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">GenieACS Device ID</span>
                    <span className="font-mono text-slate-800 break-all text-[11px]">{selectedDevice.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">IP Address (WAN)</span>
                    <span className="font-mono text-slate-800 font-medium">{selectedDevice.ip_address || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">MAC Address</span>
                    <span className="font-mono text-slate-800">{selectedDevice.mac_address || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Hardware Version</span>
                    <span className="text-slate-800 font-medium">{selectedDevice.hardware_version || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Software / Firmware</span>
                    <span className="text-slate-800 font-medium">{selectedDevice.software_version || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">OUI</span>
                    <span className="font-mono text-slate-800">{selectedDevice.oui || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Optical & Link Telemetry */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-600 block text-[11px] font-medium">Optical RX Power (Redaman)</span>
                  <div className="mt-1">
                    {renderSignalBadge(selectedDevice.rx_power_dbm)}
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-600 block text-[11px] font-medium">Optical TX Power</span>
                  <span className="font-mono text-slate-900 font-semibold text-xs block mt-1">
                    {selectedDevice.tx_power_dbm != null ? `${selectedDevice.tx_power_dbm.toFixed(2)} dBm` : <span className="text-slate-400">N/A</span>}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-600 block text-[11px] font-medium">Total Uptime</span>
                  <span className="font-mono text-slate-900 font-semibold text-xs block mt-1">{formatUptime(selectedDevice.uptime_seconds)}</span>
                </div>
              </div>

              {/* Multi-SSID List */}
              {selectedDevice.ssid_list && selectedDevice.ssid_list.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-slate-800 block text-[11px] font-semibold">Daftar SSID (Multi-SSID WiFi):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedDevice.ssid_list.map((item) => (
                      <div key={item.index} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                        <div className="truncate flex-1 min-w-0">
                          <span className="text-[10px] text-slate-500 font-medium block">SSID #{item.index}</span>
                          <span className="font-semibold text-slate-900 text-xs truncate block font-mono">{item.ssid}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className={`text-[10px] font-semibold shrink-0 ${item.enabled ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-rose-200 text-rose-700 bg-rose-50"}`}>
                            {item.enabled ? "Aktif" : "Nonaktif"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleOpenWifiModal(selectedDevice, item.index, item.ssid);
                            }}
                            className="h-6 px-2 text-[10px] border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 gap-1 font-medium"
                            title={`Atur SSID #${item.index}`}
                          >
                            <Edit2 className="w-3 h-3" />
                            Ubah
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected LAN/WLAN Hosts */}
              {selectedDevice.connected_hosts && selectedDevice.connected_hosts.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 block text-[11px] font-semibold">Perangkat Terhubung (LAN / Klien WiFi):</span>
                    <Badge variant="outline" className="text-[10px] border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold">
                      {selectedDevice.connected_hosts.length} Perangkat
                    </Badge>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedDevice.connected_hosts.map((host, i) => (
                      <div key={i} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900 text-[11px] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            {host.hostname || "Perangkat Klien"}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {host.ip_address} &bull; {host.mac_address}
                          </div>
                        </div>
                        <span className="text-[10px] text-emerald-700 font-semibold font-mono bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Aktif</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inform Time */}
              <div className="text-slate-500 text-[11px] flex items-center justify-between px-1 pt-2 border-t border-slate-200">
                <span>Terakhir Inform TR-069:</span>
                <span className="text-slate-800 font-medium">
                  {selectedDevice.last_inform ? new Date(selectedDevice.last_inform).toLocaleString("id-ID") : "-"}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 pt-2 border-t border-slate-200 flex items-center justify-between sm:justify-between w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDetailModalOpen(false);
                if (selectedDevice) handleOpenDeleteModal(selectedDevice);
              }}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs gap-1.5 px-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Perangkat
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailModalOpen(false)}
              className="border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
