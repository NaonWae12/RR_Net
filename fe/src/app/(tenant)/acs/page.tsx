"use client";

import React, { useState, useEffect } from "react";
import { acsService } from "@/lib/api/acsService";
import { ONTDevice, SetWiFiPayload, SetWANPayload, WANConfig } from "@/lib/api/types";
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
  Clock,
  Thermometer,
  Zap,
  User,
  Globe,
  Shield,
  Radio,
  Sliders,
  CheckSquare,
  Square
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
  const [wanModalOpen, setWanModalOpen] = useState(false);
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
  const [wifiForm, setWifiForm] = useState<SetWiFiPayload>({
    slot: 1,
    ssid: "",
    password: "",
    security_mode: "11i",
    encryption: "AESEncryption",
    channel: 0,
    tx_power: 100,
    enabled: true,
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // WAN Form
  const [wanForm, setWanForm] = useState<SetWANPayload>({
    mode: "PPPoE",
    username: "",
    password: "",
    vlan_id: 0,
    service_list: "INTERNET",
    nat_enabled: true,
    connection_index: 1,
  });
  const [showWanPassword, setShowWanPassword] = useState(false);

  // Inform Interval
  const [informInterval, setInformInterval] = useState<number>(300);
  const [informIntervalLoading, setInformIntervalLoading] = useState(false);

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
    let isEnabled = true;
    if (dev.ssid_list && dev.ssid_list.length > 0) {
      const found = dev.ssid_list.find((s) => s.index === slot) || dev.ssid_list[0];
      if (!ssidToUse) ssidToUse = found.ssid;
      isEnabled = found.enabled;
    } else {
      if (!ssidToUse) ssidToUse = dev.ssid || "";
    }
    setWifiForm({
      slot: slot,
      ssid: ssidToUse,
      password: "",
      security_mode: dev.security_mode || "11i",
      encryption: "AESEncryption",
      channel: dev.wifi_channel || 0,
      tx_power: dev.wifi_tx_power || 100,
      enabled: isEnabled,
    });
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setActionMessage(null);
    setWifiModalOpen(true);
  };

  const handleOpenWanModal = (dev: ONTDevice, wanIndex?: number) => {
    setSelectedDevice(dev);
    const currentWan = (dev.wan_list && dev.wan_list.length > 0)
      ? (dev.wan_list.find(w => w.index === (wanIndex || 1)) || dev.wan || dev.wan_list[0])
      : dev.wan;
    setWanForm({
      mode: currentWan?.mode || "PPPoE",
      username: currentWan?.username || "",
      password: "",
      vlan_id: currentWan?.vlan_id || 0,
      service_list: currentWan?.service_list || "INTERNET",
      nat_enabled: currentWan?.nat_enabled ?? true,
      connection_index: wanIndex || currentWan?.index || 1,
    });
    setShowWanPassword(false);
    setActionMessage(null);
    setWanModalOpen(true);
  };

  const handleOpenRebootModal = (dev: ONTDevice) => {
    setSelectedDevice(dev);
    setActionMessage(null);
    setRebootModalOpen(true);
  };

  const handleOpenDetailModal = (dev: ONTDevice) => {
    setSelectedDevice(dev);
    setInformInterval(dev.inform_interval || 300);
    setActionMessage(null);
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
    if (wifiForm.password && wifiForm.password.length < 8 && wifiForm.security_mode !== "None") {
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

  const handleSaveWan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    if (wanForm.mode === "PPPoE" && !wanForm.username?.trim()) {
      setActionMessage({ type: "error", text: "Username PPPoE wajib diisi" });
      return;
    }
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await acsService.setWAN(selectedDevice.id, wanForm);
      setActionMessage({ type: "success", text: res.message || "Konfigurasi WAN berhasil dikirim ke ONT!" });
      setTimeout(() => {
        setWanModalOpen(false);
        fetchDevices();
      }, 1500);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || err.message || "Gagal mengatur WAN" });
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

  const handleSetInformInterval = async () => {
    if (!selectedDevice) return;
    setInformIntervalLoading(true);
    setActionMessage(null);
    try {
      const res = await acsService.setInformInterval(selectedDevice.id, informInterval);
      setActionMessage({ type: "success", text: res.message || `Interval berhasil diset ke ${informInterval}s` });
      setSelectedDevice((prev) => (prev ? { ...prev, inform_interval: informInterval } : null));
      fetchDevices();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || err.message || "Gagal mengatur interval" });
    } finally {
      setInformIntervalLoading(false);
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

  // Helper format time ago
  const formatTimeAgo = (dateStr?: string | Date) => {
    if (!dateStr) return "-";
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 0) return "baru saja";
    if (diffSec < 60) return `${diffSec} dtk lalu`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} jam lalu`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} hr lalu`;
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
            <div>Periodic Inform: <strong className="text-white">{informInterval}s</strong></div>
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
                  <th className="py-3 px-4 font-medium">WAN</th>
                  <th className="py-3 px-4 font-medium">IP &amp; Uptime</th>
                  <th className="py-3 px-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RotateCw className="w-5 h-5 animate-spin text-indigo-500" />
                        <span>Memuat data ONT tenant...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center">
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
                          <div>
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Online
                            </Badge>
                            <div className="text-[10px] text-emerald-600 font-medium mt-0.5" title={dev.online_at ? `Online sejak: ${new Date(dev.online_at).toLocaleString("id-ID")}` : undefined}>
                              Aktif: {formatUptime(dev.uptime_seconds)}
                            </div>
                            {dev.last_inform && (
                              <div className="text-[9px] text-slate-400" title={`Heartbeat TR-069: ${new Date(dev.last_inform).toLocaleString("id-ID")}`}>
                                Sync: {formatTimeAgo(dev.last_inform)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <Badge variant="outline" className="text-rose-600 bg-rose-50 border-rose-200 text-[11px] gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Offline
                            </Badge>
                            <div className="text-[10px] text-rose-600 font-medium mt-0.5" title={dev.offline_at ? `Mati sejak: ${new Date(dev.offline_at).toLocaleString("id-ID")}` : (dev.last_inform ? `Terakhir lapor: ${new Date(dev.last_inform).toLocaleString("id-ID")}` : undefined)}>
                              Mati: {formatUptime(dev.uptime_seconds)}
                            </div>
                            {(dev.offline_at || dev.last_inform) && (
                              <div className="text-[9px] text-slate-400">
                                Sejak: {formatTimeAgo(dev.offline_at || dev.last_inform)}
                              </div>
                            )}
                          </div>
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

                      {/* WAN */}
                      <td className="py-3 px-4">
                        {dev.wan ? (
                          <div>
                            <Badge
                              className={`text-[10px] font-semibold ${
                                dev.wan.mode === "PPPoE"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : dev.wan.mode === "Bridge"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-50 text-slate-700 border-slate-200"
                              }`}
                            >
                              {dev.wan.mode || "PPPoE"}
                            </Badge>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {dev.wan.connection_status === "Connected" ? (
                                <span className="text-emerald-600 font-medium">Connected</span>
                              ) : (
                                <span className="text-rose-500">{dev.wan.connection_status || "–"}</span>
                              )}
                              {dev.wan.vlan_id && dev.wan.vlan_id > 0 ? (
                                <span className="ml-1 font-mono text-slate-400">VLAN {dev.wan.vlan_id}</span>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">–</span>
                        )}
                      </td>

                      {/* IP & Uptime */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-700 font-medium">{dev.ip_address || "-"}</div>
                        <div className="text-[10px]">
                          {dev.status === "online" ? (
                            <span className="text-emerald-600 font-medium">Up: {formatUptime(dev.uptime_seconds)}</span>
                          ) : (
                            <span className="text-rose-500 font-medium">Down: {formatUptime(dev.uptime_seconds)}</span>
                          )}
                        </div>
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
                            onClick={() => handleOpenWanModal(dev)}
                            className="h-7 px-2 text-xs border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                            title="Atur WAN"
                          >
                            <Globe className="w-3.5 h-3.5 mr-1" />
                            WAN
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

          {/* Info Kepemilikan Pelanggan */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-indigo-600 text-white rounded-lg shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-indigo-700 font-semibold">Pelanggan Pemilik</div>
                <div className="font-bold text-slate-900 text-sm truncate">
                  {selectedDevice?.client_name ? (
                    selectedDevice.client_name
                  ) : selectedDevice?.label ? (
                    selectedDevice.label
                  ) : (
                    <span className="text-slate-400 font-normal italic">Belum terhubung ke data pelanggan</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0 pl-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">SN Perangkat</div>
              <div className="font-mono text-xs font-bold text-slate-800">
                {selectedDevice?.serial_number || selectedDevice?.id}
              </div>
            </div>
          </div>

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

            {/* Security Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                Mode Keamanan WiFi
              </label>
              <select
                value={wifiForm.security_mode || "11i"}
                onChange={(e) => {
                  const mode = e.target.value;
                  setWifiForm({
                    ...wifiForm,
                    security_mode: mode,
                    password: mode === "None" ? "" : wifiForm.password,
                  });
                }}
                className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                <option value="11i">WPA2-PSK (Paling Aman - Disarankan)</option>
                <option value="WPAand11i">WPA/WPA2 Mixed (Kompatibel lama)</option>
                <option value="None">Open / Tanpa Password</option>
              </select>
            </div>

            {/* Password - hanya tampil jika bukan Open */}
            {wifiForm.security_mode !== "None" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
                  <span>Password Baru WiFi</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Opsional, kosongkan untuk tidak ubah)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={wifiForm.password}
                    onChange={(e) => setWifiForm({ ...wifiForm, password: e.target.value })}
                    placeholder="Min 8 karakter"
                    className="pl-9 pr-9 bg-white border-slate-300 text-slate-900 text-xs h-9 font-mono focus-visible:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Channel & Tx Power */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-indigo-600" />
                  Channel WiFi
                </label>
                <select
                  value={wifiForm.channel ?? 0}
                  onChange={(e) => setWifiForm({ ...wifiForm, channel: Number(e.target.value) })}
                  className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value={0}>Auto</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(ch => (
                    <option key={ch} value={ch}>CH {ch}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  Daya Pancar (Tx)
                </label>
                <select
                  value={wifiForm.tx_power ?? 100}
                  onChange={(e) => setWifiForm({ ...wifiForm, tx_power: Number(e.target.value) })}
                  className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value={100}>100% (Maksimal)</option>
                  <option value={75}>75%</option>
                  <option value={50}>50%</option>
                  <option value={20}>20% (Hemat)</option>
                </select>
              </div>
            </div>

            <div className="bg-amber-50/90 border border-amber-200/90 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Sinkronisasi Otomatis:</strong> Perubahan akan diterapkan ke modem ONT dalam <strong>~{informInterval} detik</strong> (sesuai siklus Periodic Inform TR-069 yang dikonfigurasi) tanpa perlu restart modem.
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

      {/* Modal: Atur WAN */}
      <Dialog open={wanModalOpen} onOpenChange={setWanModalOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-600" />
              Atur Koneksi WAN ONT
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Konfigurasi mode WAN, kredensial PPPoE, VLAN, dan NAT untuk ONT ({selectedDevice?.serial_number}).
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

          <form onSubmit={handleSaveWan} className="space-y-4 py-2">
            {/* Mode WAN */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Mode WAN</label>
              <div className="grid grid-cols-3 gap-2">
                {(["PPPoE", "IPoE", "Bridge"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWanForm({ ...wanForm, mode: m })}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                      wanForm.mode === m
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {m === "IPoE" ? "IPoE (DHCP)" : m}
                  </button>
                ))}
              </div>
            </div>

            {/* PPPoE Credentials */}
            {wanForm.mode === "PPPoE" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Username PPPoE <span className="text-rose-500">*</span></label>
                  <Input
                    value={wanForm.username || ""}
                    onChange={(e) => setWanForm({ ...wanForm, username: e.target.value })}
                    placeholder="Contoh: pelanggan@isp"
                    required
                    className="bg-white border-slate-300 text-xs h-9 font-mono focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
                    <span>Password PPPoE</span>
                    <span className="text-[10px] text-slate-400">(Kosongkan jika tidak ubah)</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={showWanPassword ? "text" : "password"}
                      value={wanForm.password || ""}
                      onChange={(e) => setWanForm({ ...wanForm, password: e.target.value })}
                      placeholder="Password PPPoE"
                      className="pl-9 pr-9 bg-white border-slate-300 text-xs h-9 font-mono focus-visible:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWanPassword(!showWanPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showWanPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* VLAN ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">VLAN ID <span className="text-slate-400 font-normal">(0 = Untagged)</span></label>
              <Input
                type="number"
                min={0}
                max={4094}
                value={wanForm.vlan_id ?? 0}
                onChange={(e) => setWanForm({ ...wanForm, vlan_id: Number(e.target.value) })}
                placeholder="0"
                className="bg-white border-slate-300 text-xs h-9 font-mono focus-visible:ring-emerald-500"
              />
            </div>

            {/* Service List */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Service List</label>
              <select
                value={wanForm.service_list || "INTERNET"}
                onChange={(e) => setWanForm({ ...wanForm, service_list: e.target.value })}
                className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <option value="INTERNET">INTERNET</option>
                <option value="TR069,INTERNET">TR069 + INTERNET</option>
                <option value="VOIP,INTERNET">VOIP + INTERNET</option>
              </select>
            </div>

            {/* NAT Enable - hanya untuk PPPoE/IPoE */}
            {wanForm.mode !== "Bridge" && (
              <div className="flex items-center gap-2.5 py-1">
                <button
                  type="button"
                  onClick={() => setWanForm({ ...wanForm, nat_enabled: !wanForm.nat_enabled })}
                  className="shrink-0"
                >
                  {wanForm.nat_enabled
                    ? <CheckSquare className="w-4 h-4 text-emerald-600" />
                    : <Square className="w-4 h-4 text-slate-400" />
                  }
                </button>
                <label className="text-xs font-medium text-slate-700 cursor-pointer" onClick={() => setWanForm({ ...wanForm, nat_enabled: !wanForm.nat_enabled })}>
                  NAT Enabled (Internet Sharing)
                </label>
              </div>
            )}

            <div className="bg-amber-50/90 border border-amber-200/90 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Catatan:</strong> Perubahan WAN akan diterapkan saat modem kontak ACS berikutnya (~{selectedDevice?.inform_interval || 300} detik). Koneksi internet mungkin akan terputus sebentar saat rekonfigurasi WAN.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setWanModalOpen(false)}
                className="text-slate-600 hover:text-slate-900 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
              >
                {actionLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                Terapkan WAN
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
                    {selectedDevice.client_name && (
                      <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <User className="w-3.5 h-3.5 text-indigo-600" />
                        Pelanggan: {selectedDevice.client_name}
                      </div>
                    )}
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
                      <div className="text-right">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </Badge>
                        <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                          Aktif: {formatUptime(selectedDevice.uptime_seconds)}
                        </div>
                        {selectedDevice.online_at && (
                          <div className="text-[9px] text-slate-500">
                            Sejak {new Date(selectedDevice.online_at).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-right">
                        <Badge variant="outline" className="text-rose-600 bg-rose-50 border-rose-200 text-xs gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Offline
                        </Badge>
                        <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                          Mati: {formatUptime(selectedDevice.uptime_seconds)}
                        </div>
                        {(selectedDevice.offline_at || selectedDevice.last_inform) && (
                          <div className="text-[9px] text-slate-500">
                            Sejak {new Date(selectedDevice.offline_at || selectedDevice.last_inform).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
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

              {/* Telemetri Optik, Daya & Hardware */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-600 block text-[11px] font-medium">Optical RX Power</span>
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
                  <span className="text-slate-600 flex items-center gap-1 text-[11px] font-medium">
                    <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                    Suhu Transceiver
                  </span>
                  <span className="font-mono text-slate-900 font-semibold text-xs block mt-1">
                    {selectedDevice.temperature_celsius != null ? (
                      <span className={selectedDevice.temperature_celsius > 70 ? "text-rose-600 font-bold" : selectedDevice.temperature_celsius > 55 ? "text-amber-600 font-semibold" : "text-emerald-700 font-semibold"}>
                        {selectedDevice.temperature_celsius.toFixed(1)} °C
                      </span>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-600 flex items-center gap-1 text-[11px] font-medium">
                    <Zap className="w-3.5 h-3.5 text-blue-500" />
                    Voltase Transceiver
                  </span>
                  <span className="font-mono text-slate-900 font-semibold text-xs block mt-1">
                    {selectedDevice.voltage_volts != null ? (
                      <span className="text-slate-900 font-semibold">
                        {selectedDevice.voltage_volts.toFixed(2)} V
                      </span>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </span>
                </div>
              </div>

              {/* WAN Info */}
              {(selectedDevice.wan || (selectedDevice.wan_list && selectedDevice.wan_list.length > 0)) && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 block text-[11px] font-semibold flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-600" />
                      Informasi WAN:
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDetailModalOpen(false);
                        handleOpenWanModal(selectedDevice);
                      }}
                      className="h-6 px-2 text-[10px] border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 gap-1 font-medium"
                    >
                      <Globe className="w-3 h-3" />
                      Atur WAN
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(selectedDevice.wan_list && selectedDevice.wan_list.length > 0
                      ? selectedDevice.wan_list
                      : selectedDevice.wan ? [selectedDevice.wan] : []
                    ).map((w, i) => (
                      <div key={i} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-500 font-medium">WAN #{w.index || i + 1}</span>
                          <Badge
                            className={`text-[10px] font-semibold ${
                              w.mode === "PPPoE"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : w.mode === "Bridge"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-50 text-slate-700 border-slate-200"
                            }`}
                          >
                            {w.mode}
                          </Badge>
                        </div>
                        <div className="space-y-0.5 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Status</span>
                            <span className={`font-medium font-mono ${w.connection_status === "Connected" ? "text-emerald-600" : "text-rose-500"}`}>
                              {w.connection_status || "–"}
                            </span>
                          </div>
                          {w.external_ip && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">IP Publik</span>
                              <span className="font-mono text-slate-800">{w.external_ip}</span>
                            </div>
                          )}
                          {w.default_gateway && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Gateway</span>
                              <span className="font-mono text-slate-800">{w.default_gateway}</span>
                            </div>
                          )}
                          {w.vlan_id && w.vlan_id > 0 ? (
                            <div className="flex justify-between">
                              <span className="text-slate-500">VLAN ID</span>
                              <span className="font-mono text-indigo-700 font-semibold">{w.vlan_id}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Periodic Inform Interval Control */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-indigo-800 text-[11px] font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Periodic Inform Interval (TR-069)
                  </span>
                  <span className="text-[10px] font-mono text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded border border-indigo-200">
                    Aktif: {selectedDevice.inform_interval ? `${selectedDevice.inform_interval}s` : "300s"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={informInterval}
                    onChange={(e) => setInformInterval(Number(e.target.value))}
                    className="flex-1 text-xs bg-white border border-indigo-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                  >
                    <option value={30}>30 detik (Ultra Cepat)</option>
                    <option value={60}>60 detik (1 menit - Disarankan)</option>
                    <option value={120}>120 detik (2 menit)</option>
                    <option value={300}>300 detik (5 menit - Standar Pabrik)</option>
                    <option value={600}>600 detik (10 menit)</option>
                    <option value={900}>900 detik (15 menit)</option>
                  </select>
                  <Button
                    size="sm"
                    onClick={handleSetInformInterval}
                    disabled={informIntervalLoading || selectedDevice.status !== "online"}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shrink-0 h-7 px-3"
                  >
                    {informIntervalLoading ? (
                      <RotateCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Terapkan
                  </Button>
                </div>
                {selectedDevice.status !== "online" && (
                  <p className="text-[10px] text-slate-500 italic">Modem harus online untuk mengubah interval.</p>
                )}
              </div>

              {/* Inform Time */}
              <div className="text-slate-500 text-[11px] flex items-center justify-between px-1 pt-2 border-t border-slate-200">
                <span>Terakhir Inform TR-069:</span>
                <span className="text-slate-800 font-medium">
                  {selectedDevice.last_inform ? (
                    <span>
                      {new Date(selectedDevice.last_inform).toLocaleString("id-ID")}{" "}
                      <span className="text-slate-500 font-normal">({formatTimeAgo(selectedDevice.last_inform)})</span>
                    </span>
                  ) : "-"}
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
