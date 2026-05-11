"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { voucherService, VoucherPackage, Voucher } from "@/lib/api/voucherService";
import { useNetworkStore } from "@/stores/networkStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Ticket,
  Plus,
  RotateCw,
  Zap,
  Clock,
  Copy,
  Printer,
  Trash2,
  Edit,
  LayoutGrid,
  Search,
  Router as RouterIcon,
  Power,
  PowerOff,
  Shield,
  ShieldOff,
  Package as PackageIcon,
  Sparkles,
  CreditCard,
  MoreVertical,
  Settings2,
  Tag,
  X,
  Filter,
  Download,
  Edit2,
  Share2,
  MoreHorizontal,
  Check,
  ShoppingBag
} from "lucide-react";
import { VoucherDesign } from "@/lib/api/types";
import { VOUCHER_TEMPLATES, getTemplateBySlug } from '@/components/vouchers/templates/registry';
import { useNotificationStore } from "@/stores/notificationStore";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { LimitWarningBanner } from "@/components/dashboard/LimitWarningBanner";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type VoucherColumnKey = 'username' | 'password' | 'package' | 'uptime' | 'usage' | 'notes' | 'router' | 'status' | 'created_at' | 'actions';
const VOUCHER_COLUMNS_KEY = 'vouchers_table_columns_v1';

function formatDuration(seconds: number = 0) {
  if (seconds === 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}j ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function calculateUptime(v: Voucher) {
  // Jika status sudah expired atau revoked, clock BERHENTI berdetak, gunakan total waktu beku
  if (v.status === 'expired' || v.status === 'revoked') {
    if (v.expiration_mode === 'wall_clock' && v.expires_at && v.used_at) {
      const expiresAt = new Date(v.expires_at).getTime();
      const usedAt = new Date(v.used_at).getTime();
      const cappedSeconds = Math.floor((expiresAt - usedAt) / 1000);
      return cappedSeconds > 0 ? cappedSeconds : 0;
    }
    return v.total_uptime_seconds || 0;
  }

  // Jika wall_clock mode dan voucher masih aktif, hitung selisih waktu
  if (v.expiration_mode === 'wall_clock' && v.used_at) {
    const usedAt = new Date(v.used_at).getTime();

    // Meskipun status belum "expired", tahan (cap) display counter jika waktu sekarang melewati batas expiry
    if (v.expires_at) {
      const expiresAt = new Date(v.expires_at).getTime();
      if (Date.now() >= expiresAt) {
        const cappedSeconds = Math.floor((expiresAt - usedAt) / 1000);
        return cappedSeconds > 0 ? cappedSeconds : 0;
      }
    }

    // Voucher masih jalan → tampilkan timer asli detik ini
    const elapsedSeconds = Math.floor((Date.now() - usedAt) / 1000);
    return elapsedSeconds > 0 ? elapsedSeconds : 0;
  }

  // uptime_limit mode → selalu ambil angka statis dari DB (dari accounting updates)
  return v.total_uptime_seconds || 0;
}

function formatBytes(bytes: number = 0) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatKbps(kbps: number) {
  if (!kbps) return "-";
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 1)} Mbps`;
  return `${kbps} Kbps`;
}

function formatDisplayPrice(price: number | string) {
  if (price === "" || price === undefined) return "";
  const numeric = typeof price === 'string' ? price.replace(/\D/g, '') : price.toString();
  if (numeric === "") return "";
  return new Intl.NumberFormat("id-ID").format(parseInt(numeric));
}

function parseDisplayPrice(formatted: string): number {
  return parseInt(formatted.replace(/\D/g, '')) || 0;
}

export default function VouchersPage() {
  const router = useRouter();
  const { showToast } = useNotificationStore();
  const { routers, fetchRouters, updateRouter } = useNetworkStore();
  const { isAuthenticated, tenant } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<'packages' | 'generate' | 'vouchers' | 'cards'>('packages');
  const [cardDesignMode, setCardDesignMode] = useState<string>('simple');
  const [ownedDesigns, setOwnedDesigns] = useState<VoucherDesign[]>([]);

  const [brandingDialog, setBrandingDialog] = useState<{
    isOpen: boolean;
    routerId: string;
    dnsNames: string[];
    labels: string[];
    selectedDesignSlug: string;
  }>({
    isOpen: false,
    routerId: "",
    dnsNames: [],
    labels: [],
    selectedDesignSlug: "simple",
  });


  const [selectedBranding, setSelectedBranding] = useState<{
    dnsName: string;
    label: string;
  }>({
    dnsName: "",
    label: "",
  });

  const [packages, setPackages] = useState<VoucherPackage[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'kadaluarsa'>('active');

  const [visibleColumns, setVisibleColumns] = useState<Record<VoucherColumnKey, boolean>>({
    username: true,
    password: true,
    package: true,
    uptime: true,
    usage: true,
    notes: true,
    router: true,
    status: true,
    created_at: true,
    actions: true,
  });

  const [voucherPage, setVoucherPage] = useState(1);
  const [voucherTotal, setVoucherTotal] = useState(0);
  const [isLoadingMoreVouchers, setIsLoadingMoreVouchers] = useState(false);

  // Mikhmon-ish state
  const [pkgForm, setPkgForm] = useState<{
    name: string;
    download_speed: number | "";
    upload_speed: number | "";
    validity: string;
    price: number | "";
    rate_limit_mode: string;
    expiration_mode: 'wall_clock' | 'uptime_limit';
  }>({
    name: "",
    download_speed: 2048,
    upload_speed: 1024,
    validity: "2h",
    price: "",
    rate_limit_mode: "full_radius",
    expiration_mode: "wall_clock",
  });

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    voucher: Voucher | null;
    isEditMode: boolean;
  }>({ open: false, voucher: null, isEditMode: false });

  const [editVoucherForm, setEditVoucherForm] = useState({
    code: "",
    password: "",
    package_id: "",
    router_id: "" as string | "all",
    shared_users: 1,
    notes: ""
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    voucher: { id: string; code: string } | null;
  }>({ open: false, voucher: null });

  const [deletePackageDialog, setDeletePackageDialog] = useState<{
    open: boolean;
    pkg: { id: string; name: string } | null;
  }>({ open: false, pkg: null });

  const [editPackageDialog, setEditPackageDialog] = useState<{
    open: boolean;
    pkg: VoucherPackage | null;
  }>({ open: false, pkg: null });
  const [editPkgForm, setEditPkgForm] = useState<{
    name: string;
    download_speed: number | "";
    upload_speed: number | "";
    validity: string;
    price: number | "";
    rate_limit_mode: string;
    expiration_mode: 'wall_clock' | 'uptime_limit';
  }>({
    name: "",
    download_speed: 2048,
    upload_speed: 1024,
    validity: "2h",
    price: "",
    rate_limit_mode: "full_radius",
    expiration_mode: "wall_clock",
  });

  const handleDeletePackageClick = (id: string, name: string) => {
    setDeletePackageDialog({ open: true, pkg: { id, name } });
  };

  const confirmDeletePackage = async () => {
    if (!deletePackageDialog.pkg) return;
    setLoading(true);
    try {
      await voucherService.deletePackage(deletePackageDialog.pkg.id);
      showToast({ title: "Paket dihapus", description: `Paket "${deletePackageDialog.pkg.name}" berhasil dihapus`, variant: "success" });
      setDeletePackageDialog({ open: false, pkg: null });
      await load();
    } catch (err: any) {
      console.log('[DELETE PACKAGE ERROR]', {
        err,
        message: err?.message,
        details: err?.details,
        data: err?.data,
      });

      const errorMessage = err?.message || "";
      const backendError = err?.details?.error || err?.data?.error || "";
      const fullErrorText = errorMessage + " " + backendError;
      if (fullErrorText.includes("voucher(s) are still using this package")) {
        const match = fullErrorText.match(/(\d+) voucher\(s\)/);
        const voucherCount = match ? match[1] : "beberapa";

        showToast({
          title: "Tidak dapat menghapus paket",
          description: `Paket "${deletePackageDialog.pkg.name}" masih digunakan oleh ${voucherCount} voucher. Silakan hapus voucher tersebut terlebih dahulu atau pilih paket lain.`,
          variant: "warning"
        });
      } else {
        showToast({ title: "Gagal menghapus", description: errorMessage || "Error", variant: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  const [genForm, setGenForm] = useState<{
    package_id: string;
    router_id: string;
    quantity: number | "";
    expires_at: string;
    user_mode: string;
    character_mode: string;
    code_length: number | "";
  }>({
    package_id: "",
    router_id: "all",
    quantity: 1,
    expires_at: "",
    user_mode: "up",
    character_mode: "abcd",
    code_length: 4,
  });

  const [lastGenerated, setLastGenerated] = useState<Voucher[]>([]);
  const [successDialog, setSuccessDialog] = useState<{
    open: boolean;
    count: number;
  }>({ open: false, count: 0 });

  const packageOptions = useMemo(() => (packages ?? []).map((p) => ({ id: p.id, name: p.name })), [packages]);

  // O(1) router lookup — hindari O(n×m) routers.find() per baris tabel
  const routerMap = useMemo(() => new Map(routers.map(r => [r.id, r])), [routers]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [vData, pData, owned] = await Promise.all([
        voucherService.listVouchers({ 
          limit: Math.max(vouchers.length, 10),
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: debouncedSearch || undefined,
        }),
        voucherService.listPackages(),
        voucherService.listOwnedDesigns(),
      ]);
      setVouchers(vData.data || []);
      setVoucherTotal(vData.total || 0);
      setPackages(pData || []);
      setOwnedDesigns(owned);
    } catch (error) {
      showToast({ title: "Gagal memuat data", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const load = async () => {
    if (!isAuthenticated) return;
    await loadAllData();
  };

  // Sync cardDesignMode with tenant default if it's currently 'simple' or not in defaults
  useEffect(() => {
    if (tenant?.default_voucher_design_slug) {
      const defaults = Array.isArray(tenant.default_voucher_design_slug) 
        ? tenant.default_voucher_design_slug 
        : [tenant.default_voucher_design_slug as unknown as string];
      
      if (defaults.length > 0) {
        // If current mode is 'simple' (default state) or not in the allowed list, pick the first one
        if (cardDesignMode === 'simple' || !defaults.includes(cardDesignMode)) {
          setCardDesignMode(defaults[0]);
        }
      }
    }
  }, [tenant?.default_voucher_design_slug, cardDesignMode]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeTab, statusFilter, debouncedSearch]);

  // Debounce search input 400ms sebelum trigger server-side search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    // Load column preferences
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(VOUCHER_COLUMNS_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        setVisibleColumns(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) { /* ignore */ }
  }, []);

  const toggleColumn = (key: VoucherColumnKey) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(VOUCHER_COLUMNS_KEY, JSON.stringify(next));
      } catch (e) { /* ignore */ }
      return next;
    });
  };

  const handleLoadMoreVouchers = async () => {
    try {
      setIsLoadingMoreVouchers(true);
      // Gunakan panjang data saat ini sebagai offset — mencegah duplikat
      const offset = vouchers.length;
      const vres = await voucherService.listVouchers({
        limit: 100,
        offset,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: debouncedSearch || undefined,
      });
      
      const newVouchers = Array.isArray(vres?.data) ? vres.data : [];
      setVouchers(prev => [...prev, ...newVouchers]);
      setVoucherPage(prev => prev + 1);
    } catch (err: any) {
      console.error("Failed to load more vouchers", err);
    } finally {
      setIsLoadingMoreVouchers(false);
    }
  };

  const createPackage = async () => {
    setLoading(true);
    try {
      await voucherService.createPackage({
        name: pkgForm.name,
        download_speed: Number(pkgForm.download_speed),
        upload_speed: Number(pkgForm.upload_speed),
        validity: pkgForm.validity,
        price: Number(pkgForm.price || 0),
        rate_limit_mode: pkgForm.rate_limit_mode,
      });
      showToast({ title: "Paket dibuat", description: "Paket voucher berhasil ditambahkan", variant: "success" });
      setPkgForm({ name: "", download_speed: 2048, upload_speed: 1024, validity: "2h", price: "", rate_limit_mode: "full_radius", expiration_mode: "wall_clock" });
      await load();
    } catch (err: any) {
      showToast({ title: "Gagal", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditPackageClick = (pkg: VoucherPackage) => {
    setEditPkgForm({
      name: pkg.name,
      download_speed: pkg.download_speed,
      upload_speed: pkg.upload_speed,
      validity: pkg.validity || "2h",
      price: pkg.price || "",
      rate_limit_mode: pkg.rate_limit_mode || "full_radius",
      expiration_mode: pkg.expiration_mode || "wall_clock",
    });
    setEditPackageDialog({ open: true, pkg });
  };

  const confirmUpdatePackage = async () => {
    if (!editPackageDialog.pkg) return;
    setLoading(true);
    try {
      await voucherService.updatePackage(editPackageDialog.pkg.id, {
        name: editPkgForm.name,
        download_speed: Number(editPkgForm.download_speed),
        upload_speed: Number(editPkgForm.upload_speed),
        validity: editPkgForm.validity,
        price: Number(editPkgForm.price),
        rate_limit_mode: editPkgForm.rate_limit_mode,
      });
      showToast({ title: "Paket diperbarui", description: "Perubahan paket berhasil disimpan", variant: "success" });
      setEditPackageDialog({ open: false, pkg: null });
      await load();
    } catch (err: any) {
      showToast({ title: "Gagal memperbarui", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const syncPackage = async (packageId: string) => {
    setLoading(true);
    try {
      const activeRouters = routers.filter(r => r.status === "online" && r.type === "mikrotik");
      const routerIds = activeRouters.map(r => r.id);

      if (routerIds.length === 0) {
        showToast({ title: "Tidak ada router", description: "Tidak ada router MikroTik yang aktif", variant: "warning" });
        return;
      }

      await voucherService.syncPackageToRouters(packageId, routerIds);
      showToast({ title: "Sync berhasil", description: `Paket berhasil disinkronkan ke ${routerIds.length} router`, variant: "success" });
      await load();
    } catch (err: any) {
      showToast({ title: "Sync gagal", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    if (Number(genForm.quantity) > 10000) {
      showToast({ title: "Input tidak valid", description: "Maksimal generate adalah 10.000 voucher", variant: "error" });
      return;
    }
    setLoading(true);
    try {
      const res = await voucherService.generate({
        package_id: genForm.package_id,
        router_id: genForm.router_id === "all" ? undefined : genForm.router_id,
        quantity: Number(genForm.quantity) || 1,
        expires_at: genForm.expires_at || undefined,
        user_mode: genForm.user_mode,
        character_mode: genForm.character_mode,
        code_length: Number(genForm.code_length) || 4,
      });
      const gen = Array.isArray(res?.data) ? res.data : [];
      setLastGenerated(gen);
      setSuccessDialog({ open: true, count: gen.length });
      showToast({ title: "Voucher dibuat", description: `${gen.length} voucher berhasil digenerate`, variant: "success" });
      await load();
    } catch (err: any) {
      showToast({ title: "Gagal generate", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditVoucher = (voucher: Voucher) => {
    setEditVoucherForm({
      code: voucher.code,
      password: voucher.password || "",
      package_id: voucher.package_id,
      router_id: voucher.router_id || "all",
      shared_users: voucher.shared_users || 1,
      notes: voucher.notes || ""
    });
    setEditDialog({ open: true, voucher, isEditMode: false });
  };

  const confirmUpdateVoucher = async () => {
    if (!editDialog.voucher) return;
    setLoading(true);
    try {
      await voucherService.updateVoucher(editDialog.voucher.id, {
        package_id: editVoucherForm.package_id,
        router_id: editVoucherForm.router_id === "all" ? undefined : editVoucherForm.router_id,
        code: editVoucherForm.code,
        password: editVoucherForm.password,
        shared_users: editVoucherForm.shared_users,
        notes: editVoucherForm.notes
      });
      showToast({ title: "Voucher diperbarui", description: `Voucher "${editVoucherForm.code}" berhasil diperbarui`, variant: "success" });
      setEditDialog({ open: false, voucher: null, isEditMode: false });
      await load();
    } catch (err: any) {
      showToast({ title: "Gagal memperbarui", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBranding = async () => {
    try {
      if (!brandingDialog.routerId) {
        showToast({ title: "Gagal", description: "Router harus dipilih", variant: "error" });
        return;
      }
      setLoading(true);

      const router = routers.find(r => r.id === brandingDialog.routerId);
      const newBrandingConfig = {
        ...router?.branding_config,
        dns_names: brandingDialog.dnsNames,
        labels: brandingDialog.labels,
        selected_design_slug: brandingDialog.selectedDesignSlug,
      };

      await updateRouter(brandingDialog.routerId, { 
        branding_config: newBrandingConfig
      });

      showToast({ title: "Branding disimpan", description: "Konfigurasi branding berhasil diperbarui", variant: "success" });
      setBrandingDialog(prev => ({ ...prev, isOpen: false }));
      await fetchRouters();
      
      // Update preview immediately if no selection was made
      if (!selectedBranding.dnsName && brandingDialog.dnsNames.length > 0) {
        setSelectedBranding(prev => ({ ...prev, dnsName: brandingDialog.dnsNames[0] }));
      }
      if (!selectedBranding.label && brandingDialog.labels.length > 0) {
        setSelectedBranding(prev => ({ ...prev, label: brandingDialog.labels[0] }));
      }
    } catch (error: any) {
      showToast({ title: "Gagal menyimpan", description: error.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, code: string) => {
    setDeleteDialog({ open: true, voucher: { id, code } });
  };

  const confirmDeleteVoucher = async () => {
    if (!deleteDialog.voucher) return;
    setLoading(true);
    try {
      await voucherService.deleteVoucher(deleteDialog.voucher.id);
      showToast({ title: "Voucher dihapus", description: `Voucher "${deleteDialog.voucher.code}" berhasil dihapus`, variant: "success" });
      setDeleteDialog({ open: false, voucher: null });
      await load();
    } catch (err: any) {
      showToast({ title: "Gagal menghapus", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (voucher: Voucher) => {
    if (voucher.status !== "active" && voucher.status !== "revoked") {
      showToast({
        title: "Tidak dapat diubah",
        description: `Status voucher "${voucher.status}" tidak dapat diubah`,
        variant: "error"
      });
      return;
    }

    setLoading(true);
    try {
      await voucherService.toggleStatus(voucher.id);
      const newStatus = voucher.status === "revoked" ? "active" : "revoked";
      showToast({
        title: "Status diubah",
        description: `Voucher "${voucher.code}" sekarang berstatus ${newStatus}`,
        variant: "success"
      });
      await load();
    } catch (err: any) {
      showToast({ title: "Gagal mengubah status", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleIsolate = async (voucher: Voucher) => {
    setLoading(true);
    try {
      await voucherService.toggleIsolate(voucher.id);
      const newStatus = voucher.isolated ? "aktif" : "terisolir";
      showToast({
        title: "Status isolir diubah",
        description: `Voucher "${voucher.code}" sekarang ${newStatus}`,
        variant: "success"
      });
      await load();
    } catch (err: any) {
      showToast({ title: "Gagal mengubah status isolir", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editDialog.voucher) return;
    showToast({
      title: "Info",
      description: "Fitur edit voucher akan segera tersedia",
      variant: "info"
    });
    setEditDialog({ open: false, voucher: null });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ title: "Copied!", description: "Voucher code copied to clipboard", variant: "success" });
    } catch {
      showToast({ title: "Copy failed", variant: "error" });
    }
  };

  // Search dilakukan di server-side via debouncedSearch, tidak perlu filter di client
  const filteredVouchers = vouchers;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-slate-900">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Ticket className="w-8 h-8 text-indigo-600" /> Voucher Management
          </h1>
          <p className="text-slate-500 mt-1">Manage hotspot packages and generate batch vouchers.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync Data
        </Button>
      </div>
      
      <LimitWarningBanner resource="vouchers" />

      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex gap-1 shadow-sm">
        <button
          onClick={() => setActiveTab('packages')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === 'packages'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <PackageIcon className="w-4 h-4" />
          Paket Voucher
        </button>
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === 'generate'
              ? 'bg-orange-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Generate Batch
        </button>
        <button
          onClick={() => setActiveTab('vouchers')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === 'vouchers'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Ticket className="w-4 h-4" />
          Daftar Voucher
          <Badge variant="secondary" className="ml-1 bg-white/20 text-white border-0">{vouchers.length}</Badge>
        </button>
        <button
          onClick={() => setActiveTab('cards')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === 'cards'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Desain Kartu
          {lastGenerated.length > 0 && (
            <Badge variant="secondary" className="ml-1 bg-white/20 text-white border-0">{lastGenerated.length}</Badge>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        {activeTab === 'packages' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Package Form */}
            <Card className="border-indigo-100 shadow-sm overflow-hidden">
              <CardHeader className="bg-indigo-50/50 border-b border-indigo-200">
                <CardTitle className="text-indigo-900 text-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Tambah Paket Baru
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <Input
                  label="Nama Paket (Profile)"
                  placeholder="PROMO 2 JAM"
                  value={pkgForm.name}
                  onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Download (Kbps)"
                    type="number"
                    value={pkgForm.download_speed}
                    onChange={(e) => setPkgForm({ ...pkgForm, download_speed: e.target.value === "" ? "" : Number(e.target.value) })}
                  />
                  <Input
                    label="Upload (Kbps)"
                    type="number"
                    value={pkgForm.upload_speed}
                    onChange={(e) => setPkgForm({ ...pkgForm, upload_speed: e.target.value === "" ? "" : Number(e.target.value) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Batas Waktu (Validity)"
                    placeholder="Contoh: 2h, 1J"
                    value={pkgForm.validity}
                    onChange={(e) => setPkgForm({ ...pkgForm, validity: e.target.value })}
                    info="Format: H=Hari, J=Jam, M=Minggu, B=Bulan"
                  />
                  <Input
                    label="Harga (IDR)"
                    type="text"
                    placeholder="0"
                    value={formatDisplayPrice(pkgForm.price)}
                    onChange={(e) => setPkgForm({ ...pkgForm, price: e.target.value === "" ? "" : parseDisplayPrice(e.target.value) })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Rate Limit Mode</label>
                  <select
                    value={pkgForm.rate_limit_mode}
                    onChange={(e) => setPkgForm({ ...pkgForm, rate_limit_mode: e.target.value })}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  >
                    <option value="radius_auth_only">MikroTik Profile</option>
                    <option value="full_radius">Full RADIUS</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Sistem Waktu (Timer)</label>
                  <select
                    value={pkgForm.expiration_mode || "wall_clock"}
                    onChange={(e) => setPkgForm({ ...pkgForm, expiration_mode: e.target.value })}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  >
                    <option value="wall_clock">Jalan Terus (Wall-Clock)</option>
                    <option value="uptime_limit">Pause/Play (Uptime-Only)</option>
                  </select>
                  <span className="text-xs text-slate-500">
                    {pkgForm.expiration_mode === "uptime_limit" ? "Timer hanya jalan saat user online" : "Timer jalan terus sejak login pertama"}
                  </span>
                </div>
                <Button onClick={createPackage} disabled={loading || !pkgForm.name} className="w-full bg-indigo-600 hover:bg-indigo-700">
                  Simpan Paket Baru
                </Button>
              </CardContent>
            </Card>

            {/* Package List */}
            <div className="lg:col-span-2">
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-200">
                  <CardTitle className="text-lg flex items-center justify-between text-slate-900">
                    <span>Daftar Paket Tersedia</span>
                    <Badge variant="outline" className="border-slate-200">{packages.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-slate-500 font-semibold">Nama</th>
                        <th className="px-4 py-3 text-left text-slate-500 font-semibold">Speed / Mode</th>
                        <th className="px-4 py-3 text-left text-slate-500 font-semibold">Harga</th>
                        <th className="px-4 py-3 text-right text-slate-500 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {packages.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-200">
                          <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="flex flex-col gap-1">
                              <span className="flex items-center gap-1 font-semibold text-slate-700"><Zap className="w-3 h-3 text-amber-500" /> {formatKbps(p.download_speed)} / {formatKbps(p.upload_speed)}</span>
                              <Badge variant="outline" className="w-fit text-xs">
                                {p.rate_limit_mode === "radius_auth_only" ? "MikroTik Profile" : "Full RADIUS"}
                              </Badge>
                              <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3 text-slate-400" /> {p.duration_hours ? `${p.duration_hours} Jam` : "Unlimited"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-emerald-600">
                              {p.price ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(p.price) : "Gratis"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {p.rate_limit_mode === "radius_auth_only" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => syncPackage(p.id)}
                                  disabled={loading}
                                  title="Sync ke Router"
                                >
                                  <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPackageClick(p)}
                                disabled={loading}
                                title="Edit Paket"
                                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePackageClick(p.id, p.name)}
                                disabled={loading}
                                title="Hapus Paket"
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {packages.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Belum ada paket tersedia.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'generate' && (
          <Card className="border-orange-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-orange-50/50 border-b border-orange-200">
              <CardTitle className="text-orange-900 text-lg flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" /> Generate Voucher Batch
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 leading-none">Mode Pengguna</label>
                  <select
                    className="w-full h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 border-slate-200"
                    value={genForm.user_mode}
                    onChange={(e) => setGenForm({ ...genForm, user_mode: e.target.value })}
                  >
                    <option value="up">Username & Password</option>
                    <option value="vc">Username = Password</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 leading-none">Karakter</label>
                  <select
                    className="w-full h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 border-slate-200"
                    value={genForm.character_mode}
                    onChange={(e) => setGenForm({ ...genForm, character_mode: e.target.value })}
                  >
                    <option value="abcd">abcd</option>
                    <option value="ABCD">ABCD</option>
                    <option value="aBcD">aBcD</option>
                    <option value="5ab2">5ab2c34d</option>
                    <option value="5AB2">5AB2C34D</option>
                    <option value="5aB2">5aB2c34D</option>
                  </select>
                </div>

                <Input
                  label="Panjang Kode"
                  type="number"
                  min={3}
                  max={20}
                  className="h-10 border-slate-200"
                  value={genForm.code_length}
                  onChange={(e) => setGenForm({ ...genForm, code_length: e.target.value === "" ? "" : Number(e.target.value) })}
                />

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 leading-none">Paket (Profile)</label>
                  <select
                    className="w-full h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 border-slate-200"
                    value={genForm.package_id}
                    onChange={(e) => setGenForm({ ...genForm, package_id: e.target.value })}
                  >
                    <option value="">Pilih Paket</option>
                    {packageOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 leading-none">Router</label>
                  <select
                    className="w-full h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 border-slate-200"
                    value={genForm.router_id}
                    onChange={(e) => setGenForm({ ...genForm, router_id: e.target.value })}
                  >
                    <option value="all">Semua Router</option>
                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Input
                    label="Batch Qty"
                    type="number"
                    min={1}
                    max={10000}
                    className={`h-10 ${Number(genForm.quantity) > 10000 ? 'border-red-500 focus:ring-red-500' : 'border-slate-200'}`}
                    value={genForm.quantity}
                    onChange={(e) => setGenForm({ ...genForm, quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                  />
                  {Number(genForm.quantity) > 10000 && (
                    <p className="text-[10px] text-red-500 font-medium animate-pulse">
                      Maksimal generate adalah 10.000 voucher dalam satu batch
                    </p>
                  )}
                </div>

                <div className="lg:col-span-2">
                  <Button 
                    onClick={generate} 
                    disabled={loading || !genForm.package_id || Number(genForm.quantity) > 10000} 
                    className="w-full bg-orange-600 hover:bg-orange-700 h-10 text-white font-bold shadow-md shadow-orange-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
                  >
                    Generate Batch Sekarang
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'vouchers' && (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50/50 border-b border-slate-200 py-4 px-6 gap-4">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg font-bold text-slate-900 px-0">Daftar Voucher User</CardTitle>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 text-slate-600 border-slate-200">
                      <Settings2 className="w-4 h-4" />
                      Kolom
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 bg-white">
                    <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(Object.entries({
                      username: 'Username',
                      password: 'Password',
                      package: 'Paket',
                      uptime: 'Uptime',
                      usage: 'Usage',
                      notes: 'Notes',
                      router: 'Router',
                      status: 'Status',
                      created_at: 'Tgl Generate',
                      actions: 'Aksi'
                    }) as [VoucherColumnKey, string][]).map(([key, label]) => (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={visibleColumns[key]}
                        onCheckedChange={() => toggleColumn(key)}
                      >
                        {label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      statusFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      statusFilter === 'active' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Aktif
                  </button>
                  <button
                    onClick={() => setStatusFilter('kadaluarsa')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      statusFilter === 'kadaluarsa' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Kadaluarsa
                  </button>
                </div>
              </div>

              <div className="relative w-full max-w-xs text-slate-900">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  placeholder="Cari kode voucher..."
                  className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    {visibleColumns.username && <th className="px-6 py-4 text-left font-semibold">Username</th>}
                    {visibleColumns.password && <th className="px-6 py-4 text-left font-semibold">Password</th>}
                    {visibleColumns.package && <th className="px-6 py-4 text-left font-semibold">Paket</th>}
                    {visibleColumns.uptime && <th className="px-6 py-4 text-center font-semibold">Uptime</th>}
                    {visibleColumns.usage && <th className="px-6 py-4 text-center font-semibold">Usage</th>}
                    {visibleColumns.notes && <th className="px-6 py-4 text-center font-semibold">Notes</th>}
                    {visibleColumns.router && <th className="px-6 py-4 text-center font-semibold">Router</th>}
                    {visibleColumns.status && <th className="px-6 py-4 text-center font-semibold">Status</th>}
                    {visibleColumns.created_at && <th className="px-6 py-4 text-center font-semibold">Tgl Generate</th>}
                    {visibleColumns.actions && <th className="px-6 py-4 text-right font-semibold">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors group border-b border-slate-200">
                      {visibleColumns.username && (
                        <td className="px-6 py-4 text-slate-900">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 group-hover:scale-105 transition-transform origin-left inline-block">
                            {v.code}
                          </span>
                        </td>
                      )}
                      {visibleColumns.password && (
                        <td className="px-6 py-4 text-slate-900">
                          {v.password && v.password !== v.code ? (
                            <span className="font-mono font-semibold text-orange-700 bg-orange-50 px-2.5 py-1 rounded border border-orange-200 inline-block">
                              {v.password}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic font-medium">= Username</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.package && (
                        <td className="px-6 py-4 text-slate-600 font-medium">{v.package_name || "Unknown"}</td>
                      )}
                      {visibleColumns.uptime && (
                        <td className="px-6 py-4 text-center text-slate-600 font-mono text-xs">
                          {formatDuration(calculateUptime(v))}
                        </td>
                      )}
                      {visibleColumns.usage && (
                        <td className="px-6 py-4 text-center text-slate-600 font-mono text-xs">
                          {formatBytes(v.total_bytes_used)}
                        </td>
                      )}
                      {visibleColumns.notes && (
                        <td className="px-6 py-4 text-center">
                          <Badge variant="outline" className="font-mono text-xs bg-purple-50 text-purple-700 border-purple-200">
                            {v.notes || 'N/A'}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.router && (
                        <td className="px-6 py-4 text-center">
                          {v.router_id ? (
                            <Badge variant="secondary" className="font-medium capitalize bg-slate-100 text-slate-700 border-slate-200"><RouterIcon className="w-3 h-3 mr-1.5" /> {routerMap.get(v.router_id)?.name || "Router"}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 font-normal">Global / All</Badge>
                          )}
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize shadow-sm ${v.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' :
                              v.status === 'used' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                v.status === 'revoked' ? 'bg-red-100 text-red-700 border border-red-200' :
                                  v.status === 'expired' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                    'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                              {v.status}
                            </span>
                            {v.isolated && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 shadow-sm">
                                <ShieldOff className="w-3 h-3 mr-1" />
                                ISOLATED
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.created_at && (
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">
                          {v.created_at ? new Date(v.created_at).toLocaleDateString("id-ID", {
                            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                          }) : "-"}
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-white">
                              <DropdownMenuLabel>Aksi Voucher</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              
                              {(v.status === "active" || v.status === "revoked") && (
                                <DropdownMenuItem onClick={() => handleToggleStatus(v)} className="gap-2">
                                  {v.status === "revoked" ? (
                                    <>
                                      <Power className="w-4 h-4 text-green-600" />
                                      <span>Enable Voucher</span>
                                    </>
                                  ) : (
                                    <>
                                      <PowerOff className="w-4 h-4 text-orange-600" />
                                      <span>Disable Voucher</span>
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem onClick={() => handleToggleIsolate(v)} className="gap-2">
                                {v.isolated ? (
                                  <>
                                    <Shield className="w-4 h-4 text-green-600" />
                                    <span>Un-Isolir (Aktifkan)</span>
                                  </>
                                ) : (
                                  <>
                                    <ShieldOff className="w-4 h-4 text-red-600" />
                                    <span>Isolir (Blokir)</span>
                                  </>
                                )}
                              </DropdownMenuItem>

                              <DropdownMenuItem onClick={() => router.push('/vouchers/print')} className="gap-2">
                                <Printer className="w-4 h-4 text-purple-600" />
                                <span>Print Management</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem onClick={() => handleEditVoucher(v)} className="gap-2">
                                <Edit className="w-4 h-4 text-blue-600" />
                                <span>Edit Voucher</span>
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem 
                                onClick={() => handleDeleteClick(v.id, v.code)} 
                                className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Hapus Voucher</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredVouchers.length === 0 && (
                    <tr><td colSpan={Object.values(visibleColumns).filter(v => v).length} className="p-12 text-center text-slate-400 italic font-medium">Data voucher tidak ditemukan atau kosong.</td></tr>
                  )}
                </tbody>
              </table>
              
              {vouchers.length < voucherTotal && (
                <div className="p-6 flex justify-center border-t border-slate-200 bg-white items-center gap-3">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                     Showing {vouchers.length} of {voucherTotal}
                   </span>
                   <button 
                     onClick={handleLoadMoreVouchers}
                     disabled={isLoadingMoreVouchers}
                     className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                   >
                     {isLoadingMoreVouchers ? <RotateCw className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                     View More
                   </button>
                </div>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'cards' && (
          <div className="space-y-6">
            {/* Info Banner */}
            <Card className="border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Sparkles className="w-8 h-8 text-purple-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-slate-900 mb-2">Galeri Template Kartu Voucher</h3>
                    <p className="text-slate-600 text-sm mb-4">
                      Berikut adalah contoh desain kartu voucher yang tersedia. Pilih template yang sesuai dengan kebutuhan bisnis Anda.
                      Untuk mencetak voucher, silakan gunakan halaman <strong>Print Management</strong>.
                    </p>
                    <Button onClick={() => router.push('/vouchers/print')} className="bg-purple-600 hover:bg-purple-700 gap-2">
                      <Printer className="w-4 h-4" />
                      Buka Print Management
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Template Selector */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="font-bold text-slate-900">Pilih Template untuk Preview</h3>
                  <p className="text-xs text-slate-500">Lihat contoh desain kartu voucher</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mr-2">
                  {(() => {
                    const designSlugs = Array.isArray(tenant?.default_voucher_design_slug)
                      ? tenant.default_voucher_design_slug
                      : (tenant?.default_voucher_design_slug ? [tenant.default_voucher_design_slug as unknown as string] : []);
                    
                    if (designSlugs.length > 0) {
                      return designSlugs.map(slug => {
                        const design = ownedDesigns.find(d => d.slug === slug);
                        return (
                          <button
                            key={slug}
                            onClick={() => setCardDesignMode(slug)}
                            className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${
                              cardDesignMode === slug
                                ? 'bg-white text-purple-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {design?.name || slug}
                          </button>
                        );
                      });
                    }

                    // Fallback to owned designs or defaults if nothing selected
                    const fallbackSource = ownedDesigns.length > 0 ? ownedDesigns.map(d => ({id: d.id, slug: d.slug, name: d.name})) : Object.values(VOUCHER_TEMPLATES).slice(0, 3).map(t => ({id: t.id, slug: t.id, name: t.name}));
                    
                    return fallbackSource.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setCardDesignMode(item.slug)}
                        className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${
                          cardDesignMode === item.slug
                            ? 'bg-white text-purple-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {item.name}
                      </button>
                    ));
                  })()}
                </div>

                <Button 
                  variant="outline" 
                  className="rounded-2xl border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold gap-2 px-6 h-12 shadow-sm shadow-amber-200/50"
                  onClick={() => router.push('/vouchers/design')}
                >
                  <ShoppingBag className="w-5 h-5" />
                  Design Management
                </Button>
                <div className="w-[1px] h-6 bg-slate-200 mx-1 self-center" />
                <Button
                  onClick={() => {
                    const defaultRouter = routers.find(r => r.is_default) || routers[0];
                    setBrandingDialog({
                      isOpen: true,
                      routerId: defaultRouter?.id || "",
                      dnsNames: defaultRouter?.branding_config?.dns_names || (defaultRouter?.dns_name ? [defaultRouter.dns_name] : []),
                      labels: defaultRouter?.branding_config?.labels || [],
                    });
                  }}
                  variant="outline"
                  className="rounded-xl border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 h-[38px] gap-2 px-4 font-bold text-xs"
                >
                  <Plus className="w-4 h-4" />
                  Manage Branding
                </Button>
              </div>
            </div>

            {/* Sample Cards Preview */}
            <Card className="border-slate-200">
              <CardHeader className="bg-slate-50/50 border-b border-slate-200">
                <CardTitle className="text-lg">
                  Preview Template - {getTemplateBySlug(cardDesignMode).name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                 {(() => {
                    const template = getTemplateBySlug(cardDesignMode);
                    const TemplateComponent = template.component;
                    const gridCols = template.gridCols || 3;
                    const gridClass = gridCols === 5 
                      ? "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2" 
                      : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";

                    // Realistic random codes for preview
                    const generateRandomCode = (len = 4) => Math.random().toString(36).substring(2, 2 + len).toUpperCase();

                    return (
                      <div className={gridClass}>
                        {Array.from({ length: gridCols === 5 ? 8 : 3 }).map((_, idx) => {
                          const code = generateRandomCode(4);
                          return (
                            <TemplateComponent 
                              key={idx}
                              voucher={{
                                id: `dummy-${idx}`,
                                code: code,
                                password: code, // most common case same as code
                                package_id: "pkg-1",
                              } as Voucher}
                              index={idx}
                              pkg={{
                                name: "PROMO 2 JAM",
                                price: 5000,
                                duration_hours: 2,
                              } as VoucherPackage}
                              headerTitle="WIFI VOUCHER"
                            />
                          );
                        })}
                      </div>
                    );
                 })()}
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* Dialogs (unchanged) */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, voucher: editDialog.voucher, isEditMode: editDialog.isEditMode })}>
        <DialogContent className="sm:max-w-[500px] bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center justify-between pr-8">
              {editDialog.isEditMode ? "Edit Voucher" : "Detail Voucher"}
              {!editDialog.isEditMode && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setEditDialog(prev => ({ ...prev, isEditMode: true }))}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-2 h-8"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit
                </Button>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-sm">
              {editDialog.isEditMode ? "Ubah informasi voucher." : "Informasi lengkap penggunaan voucher."}
            </DialogDescription>
          </DialogHeader>

          {editDialog.voucher && (
            <div className="space-y-5 py-4">
              {editDialog.isEditMode ? (
                // EDIT MODE FORM
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 leading-none">Username</label>
                      <Input 
                        value={editVoucherForm.code} 
                        onChange={(e) => setEditVoucherForm({ ...editVoucherForm, code: e.target.value })}
                        className="h-10 border-slate-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 leading-none">Password</label>
                      <Input 
                        value={editVoucherForm.password} 
                        onChange={(e) => setEditVoucherForm({ ...editVoucherForm, password: e.target.value })}
                        className="h-10 border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 leading-none">Paket (Profile)</label>
                    <select
                      className="w-full h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 border-slate-200"
                      value={editVoucherForm.package_id}
                      onChange={(e) => setEditVoucherForm({ ...editVoucherForm, package_id: e.target.value })}
                    >
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 leading-none">Router</label>
                      <select
                        className="w-full h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 border-slate-200"
                        value={editVoucherForm.router_id}
                        onChange={(e) => setEditVoucherForm({ ...editVoucherForm, router_id: e.target.value })}
                      >
                        <option value="all">Semua Router (All)</option>
                        {routers.map((r) => (
                          <option key={r.id} value={r.id}>{r.name} ({r.host})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 leading-none">Shared Users</label>
                      <Input
                        type="number"
                        min={1}
                        className="h-10 border-slate-200"
                        value={editVoucherForm.shared_users}
                        onChange={(e) => setEditVoucherForm({ ...editVoucherForm, shared_users: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 leading-none">Catatan (Notes)</label>
                    <Input
                      className="h-10 border-slate-200"
                      value={editVoucherForm.notes}
                      onChange={(e) => setEditVoucherForm({ ...editVoucherForm, notes: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                // DETAIL MODE VIEW
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Username</label>
                      <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between group">
                        <span className="font-mono font-black text-indigo-700 text-lg">{editDialog.voucher.code}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => copy(editDialog.voucher?.code || "")}><Copy className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        {editDialog.voucher.password && editDialog.voucher.password !== editDialog.voucher.code ? (
                          <span className="font-mono font-bold text-slate-700 text-lg">{editDialog.voucher.password}</span>
                        ) : (
                          <span className="text-slate-400 italic font-medium">= Username</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
                      <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${editDialog.voucher.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="font-bold text-slate-700 capitalize">{editDialog.voucher.status}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Router</label>
                      <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2">
                        <RouterIcon className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-700">{routerMap.get(editDialog.voucher?.router_id || '')?.name || "Global"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 bg-slate-900 rounded-2xl text-white shadow-lg shadow-slate-200">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-emerald-400" /> Total Uptime
                      </p>
                      <p className="text-xl font-mono font-black text-emerald-50">
                        {formatDuration(editDialog.voucher.uptime_seconds)}
                      </p>
                    </div>
                    <div className="space-y-1 border-l border-white/10 pl-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-indigo-400" /> Data Usage
                      </p>
                      <p className="text-xl font-mono font-black text-indigo-50">
                        {formatBytes(editDialog.voucher.total_bytes_used)}
                      </p>
                    </div>
                  </div>
                  
                  {editDialog.voucher.notes && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catatan</label>
                      <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-sm text-purple-700 font-medium italic">
                        "{editDialog.voucher.notes}"
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            {editDialog.isEditMode ? (
              <>
                <Button variant="outline" onClick={() => setEditDialog(prev => ({ ...prev, isEditMode: false }))} className="flex-1 font-bold">
                  Batal
                </Button>
                <Button onClick={confirmUpdateVoucher} disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 font-bold shadow-md shadow-indigo-100">
                  {loading ? <RotateCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Simpan Perubahan
                </Button>
              </>
            ) : (
              <Button variant="outline" className="w-full font-bold text-slate-600 h-11 rounded-xl" onClick={() => setEditDialog({ open: false, voucher: null, isEditMode: false })}>
                Tutup Detail
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, voucher: deleteDialog.voucher })}>
        <DialogContent className="sm:max-w-[400px] bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Hapus Voucher
            </DialogTitle>
            <DialogDescription className="py-3 text-slate-600 block">
              Apakah Anda yakin ingin menghapus voucher <span className="font-mono font-bold text-slate-900">{deleteDialog.voucher?.code}</span>?
              <br />
              <span className="text-slate-500 text-sm mt-2 block">Tindakan ini tidak dapat dibatalkan.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, voucher: null })}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDeleteVoucher} disabled={loading} className="bg-red-600 hover:bg-red-700">
              {loading ? "Menghapus..." : "Ya, Hapus Voucher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletePackageDialog.open} onOpenChange={(open) => setDeletePackageDialog({ open, pkg: deletePackageDialog.pkg })}>
        <DialogContent className="sm:max-w-[400px] bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Hapus Paket
            </DialogTitle>
            <DialogDescription className="py-3 text-slate-600 block">
              Apakah Anda yakin ingin menghapus paket <span className="font-mono font-bold text-slate-900">{deletePackageDialog.pkg?.name}</span>?
              <br />
              <span className="text-slate-500 text-sm mt-2 block">Voucher yang sudah dibuat dengan paket ini TETAP ADA, namun pembuatan voucher baru dengan paket ini tidak bisa dilakukan lagi.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeletePackageDialog({ open: false, pkg: null })}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDeletePackage} disabled={loading} className="bg-red-600 hover:bg-red-700">
              {loading ? "Menghapus..." : "Ya, Hapus Paket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPackageDialog.open} onOpenChange={(open) => setEditPackageDialog({ open, pkg: editPackageDialog.pkg })}>
        <DialogContent className="sm:max-w-[500px] bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Edit className="w-5 h-5 text-indigo-600" /> Edit Paket Voucher
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-sm">
              Perbarui informasi paket voucher ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              label="Nama Paket"
              value={editPkgForm.name}
              onChange={(e) => setEditPkgForm({ ...editPkgForm, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Download (Kbps)"
                type="number"
                value={editPkgForm.download_speed}
                onChange={(e) => setEditPkgForm({ ...editPkgForm, download_speed: e.target.value === "" ? "" : Number(e.target.value) })}
              />
              <Input
                label="Upload (Kbps)"
                type="number"
                value={editPkgForm.upload_speed}
                onChange={(e) => setEditPkgForm({ ...editPkgForm, upload_speed: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Batas Waktu"
                value={editPkgForm.validity}
                onChange={(e) => setEditPkgForm({ ...editPkgForm, validity: e.target.value })}
              />
              <Input
                label="Harga (IDR)"
                type="text"
                placeholder="0"
                value={formatDisplayPrice(editPkgForm.price)}
                onChange={(e) => setEditPkgForm({ ...editPkgForm, price: e.target.value === "" ? "" : parseDisplayPrice(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Rate Limit Mode</label>
              <select
                value={editPkgForm.rate_limit_mode}
                onChange={(e) => setEditPkgForm({ ...editPkgForm, rate_limit_mode: e.target.value })}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <option value="radius_auth_only">MikroTik Profile</option>
                <option value="full_radius">Full RADIUS</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Sistem Waktu (Timer)</label>
              <select
                value={editPkgForm.expiration_mode || "wall_clock"}
                onChange={(e) => setEditPkgForm({ ...editPkgForm, expiration_mode: e.target.value as 'wall_clock' | 'uptime_limit' })}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <option value="wall_clock">Jalan Terus (Wall-Clock)</option>
                <option value="uptime_limit">Pause/Play (Uptime-Only)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPackageDialog({ open: false, pkg: null })}>
              Batal
            </Button>
            <Button onClick={confirmUpdatePackage} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={successDialog.open} onOpenChange={(open) => setSuccessDialog({ open, count: successDialog.count })}>
        <DialogContent className="sm:max-w-[400px] bg-white text-slate-900 text-center border-emerald-100 shadow-2xl">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <Ticket className="w-8 h-8" />
            </div>
            <DialogTitle className="text-2xl font-black text-slate-900 text-center">
              Generate Sukses!
            </DialogTitle>
            <DialogDescription className="py-2 text-slate-600 font-medium text-center text-sm">
              Sebanyak <span className="font-bold text-slate-900 text-base bg-emerald-50 px-2 py-0.5 rounded">{successDialog.count}</span> voucher telah berhasil digenerate dan tersimpan di sistem.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-3 mt-4">
            <Button variant="outline" className="flex-1 font-bold text-slate-600" onClick={() => setSuccessDialog({ open: false, count: 0 })}>
              Tutup Modal
            </Button>
            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 font-bold gap-2" onClick={() => {
              setSuccessDialog({ open: false, count: 0 });
              router.push('/vouchers/print');
            }}>
              <Printer className="w-4 h-4" /> Buka Print Management
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:grid-cols-3, .print\\:grid-cols-3 * { visibility: visible; }
          .print\\:break-inside-avoid { break-inside: avoid; }
          .no-print { display: none !important; }
          @page { margin: 1cm; }
        }
      `}} />

      {/* Branding & Label Management Dialog */}
      <Dialog open={brandingDialog.isOpen} onOpenChange={(open) => setBrandingDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[28px] border-none shadow-2xl bg-white">
          <div className="bg-gradient-to-b from-slate-50 to-white">
            <DialogHeader className="p-8 pb-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-100">
                  <Tag className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Router Branding Config
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 text-sm font-medium mt-1">
                    Kelola label voucher dan DNS portal per router
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="px-8 py-4 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Router Selector */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Pilih Router</label>
                <div className="relative group">
                  <select
                    className="w-full flex h-12 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all cursor-pointer hover:border-purple-300"
                    value={brandingDialog.routerId}
                    onChange={(e) => {
                      const r = routers.find(router => router.id === e.target.value);
                      setBrandingDialog(prev => ({
                        ...prev,
                        routerId: e.target.value,
                        dnsNames: r?.branding_config?.dns_names || (r?.dns_name ? [r.dns_name] : []),
                        labels: r?.branding_config?.labels || [],
                        selectedDesignSlug: r?.branding_config?.selected_design_slug || "simple",
                      }));
                    }}
                  >
                    <option value="" disabled>Pilih Router...</option>
                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {r.host}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Settings2 className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Template Selection */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Desain Kartu Voucher</label>
                <div className="relative group">
                  <select
                    className="w-full flex h-12 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all cursor-pointer hover:border-purple-300"
                    value={brandingDialog.selectedDesignSlug}
                    onChange={(e) => setBrandingDialog(prev => ({ ...prev, selectedDesignSlug: e.target.value }))}
                  >
                    {ownedDesigns.length > 0 ? (
                      ownedDesigns.map((d) => (
                        <option key={d.id} value={d.slug}>{d.name}</option>
                      ))
                    ) : (
                      Object.values(VOUCHER_TEMPLATES).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))
                    )}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Voucher Labels Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">List Voucher Labels</label>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100">{brandingDialog.labels.length} Label</Badge>
                </div>
                
                <div className="flex gap-2">
                  <Input 
                    id="new-label-input"
                    placeholder="Contoh: WiFi Warkop barokah" 
                    className="h-11 rounded-xl border-slate-200 focus:ring-purple-500/10"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          setBrandingDialog(prev => ({ ...prev, labels: [...prev.labels, val] }));
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                  <Button 
                    className="h-11 w-11 p-0 rounded-xl bg-purple-600 hover:bg-purple-700 shrink-0"
                    onClick={() => {
                      const input = document.getElementById('new-label-input') as HTMLInputElement;
                      if (input.value.trim()) {
                        setBrandingDialog(prev => ({ ...prev, labels: [...prev.labels, input.value.trim()] }));
                        input.value = "";
                      }
                    }}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 min-h-[44px] p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  {brandingDialog.labels.length === 0 ? (
                    <span className="text-[10px] text-slate-400 italic font-medium p-1">Belum ada label marketing...</span>
                  ) : (
                    brandingDialog.labels.map((lbl, i) => (
                      <Badge key={i} className="bg-white text-slate-700 border-slate-200 px-2 py-1 pr-1 gap-1 group hover:border-purple-300 transition-colors">
                        <span className="text-xs font-bold">{lbl}</span>
                        <button 
                          onClick={() => setBrandingDialog(prev => ({ ...prev, labels: prev.labels.filter((_, idx) => idx !== i) }))}
                          className="p-0.5 rounded-md hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* DNS Names Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">List DNS Hotspot</label>
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100">{brandingDialog.dnsNames.length} DNS</Badge>
                </div>
                
                <div className="flex gap-2">
                  <Input 
                    id="new-dns-input"
                    placeholder="Contoh: portal.net" 
                    className="h-11 rounded-xl border-slate-200 focus:ring-indigo-500/10"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          setBrandingDialog(prev => ({ ...prev, dnsNames: [...prev.dnsNames, val] }));
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                  <Button 
                    className="h-11 w-11 p-0 rounded-xl bg-indigo-600 hover:bg-indigo-700 shrink-0"
                    onClick={() => {
                      const input = document.getElementById('new-dns-input') as HTMLInputElement;
                      if (input.value.trim()) {
                        setBrandingDialog(prev => ({ ...prev, dnsNames: [...prev.dnsNames, input.value.trim()] }));
                        input.value = "";
                      }
                    }}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 min-h-[44px] p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  {brandingDialog.dnsNames.length === 0 ? (
                    <span className="text-[10px] text-slate-400 italic font-medium p-1">Belum ada list DNS name...</span>
                  ) : (
                    brandingDialog.dnsNames.map((dns, i) => (
                      <Badge key={i} className="bg-white text-slate-700 border-slate-200 px-2 py-1 pr-1 gap-1 group hover:border-indigo-300 transition-colors">
                        <span className="text-xs font-bold">{dns}</span>
                        <button 
                          onClick={() => setBrandingDialog(prev => ({ ...prev, dnsNames: prev.dnsNames.filter((_, idx) => idx !== i) }))}
                          className="p-0.5 rounded-md hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="p-8 pt-2 grid grid-cols-2 gap-3 pb-8 bg-slate-50 border-t border-slate-100">
              <Button
                variant="ghost"
                onClick={() => setBrandingDialog(prev => ({ ...prev, isOpen: false }))}
                className="rounded-2xl h-12 font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all"
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveBranding}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-100 h-12 font-bold transition-all active:scale-[0.98]"
              >
                {loading ? <LoadingSpinner /> : "Simpan Branding"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
