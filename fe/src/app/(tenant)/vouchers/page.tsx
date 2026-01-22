"use client";

import { useEffect, useMemo, useState } from "react";
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
  Router as RouterIcon
} from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useAuth } from "@/lib/hooks/useAuth";

function formatKbps(kbps: number) {
  if (!kbps) return "-";
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 1)} Mbps`;
  return `${kbps} Kbps`;
}

export default function VouchersPage() {
  const { showToast } = useNotificationStore();
  const { routers, fetchRouters } = useNetworkStore();
  const { isAuthenticated } = useAuth();

  const [packages, setPackages] = useState<VoucherPackage[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Mikhmon-ish state
  const [pkgForm, setPkgForm] = useState({
    name: "",
    download_speed: 2048,
    upload_speed: 1024,
    validity: "2h",
    price: 0,
  });

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    voucher: Voucher | null;
  }>({ open: false, voucher: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    voucher: { id: string; code: string } | null;
  }>({ open: false, voucher: null });

  const [genForm, setGenForm] = useState({
    package_id: "",
    router_id: "all",
    quantity: 1,
    expires_at: "",
    user_mode: "up",
    character_mode: "abcd",
    code_length: 4,
  });

  const [lastGenerated, setLastGenerated] = useState<Voucher[]>([]);

  const packageOptions = useMemo(() => (packages ?? []).map((p) => ({ id: p.id, name: p.name })), [packages]);

  const load = async () => {
    // Only load if authenticated
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      await fetchRouters();
      const [pkgs, vres] = await Promise.all([
        voucherService.listPackages(),
        voucherService.listVouchers({ limit: 500 }),
      ]);

      const safePkgs = Array.isArray(pkgs) ? pkgs : [];
      const safeVouchers = Array.isArray(vres?.data) ? vres.data : [];

      setPackages(safePkgs);
      setVouchers(safeVouchers);

      if (!genForm.package_id && safePkgs[0]) {
        setGenForm((g) => ({ ...g, package_id: safePkgs[0].id }));
      }
    } catch (err: any) {
      showToast({ title: "Load failed", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const createPackage = async () => {
    setLoading(true);
    try {
      await voucherService.createPackage({
        name: pkgForm.name,
        download_speed: Number(pkgForm.download_speed),
        upload_speed: Number(pkgForm.upload_speed),
        validity: pkgForm.validity,
        price: Number(pkgForm.price || 0),
      });
      showToast({ title: "Paket dibuat", description: "Paket voucher berhasil ditambahkan", variant: "success" });
      setPkgForm({ name: "", download_speed: 2048, upload_speed: 1024, validity: "2H", price: 0 });
      await load();
    } catch (err: any) {
      showToast({ title: "Gagal", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    setLoading(true);
    try {
      const res = await voucherService.generate({
        package_id: genForm.package_id,
        router_id: genForm.router_id === "all" ? undefined : genForm.router_id,
        quantity: Number(genForm.quantity),
        expires_at: genForm.expires_at || undefined,
        user_mode: genForm.user_mode,
        character_mode: genForm.character_mode,
        code_length: Number(genForm.code_length),
      });
      const gen = Array.isArray(res?.data) ? res.data : [];
      setLastGenerated(gen);
      showToast({ title: "Voucher dibuat", description: `${gen.length} voucher berhasil digenerate`, variant: "success" });
      await load();
    } catch (err: any) {
      showToast({ title: "Gagal generate", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditVoucher = (voucher: Voucher) => {
    setEditDialog({ open: true, voucher });
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

  const handleSaveEdit = async () => {
    if (!editDialog.voucher) return;
    // Untuk saat ini hanya tampilkan info, bisa dikembangkan nanti
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

  const filteredVouchers = useMemo(() => {
    if (!searchTerm) return vouchers;
    return vouchers.filter(v => v.code.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [vouchers, searchTerm]);

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto text-slate-900">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Ticket className="w-8 h-8 text-indigo-600" /> Voucher Management
          </h1>
          <p className="text-slate-500 mt-1">Manage hotspot packages and generate batch vouchers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync Data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

        {/* LEFT COMPONENT: PACKAGE MANAGEMENT */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="border-indigo-100 shadow-sm overflow-hidden text-slate-900">
            <CardHeader className="bg-indigo-50/50 border-b border-indigo-200">
              <CardTitle className="text-indigo-900 text-lg flex items-center gap-2">
                <Plus className="w-4 h-4" /> Tambah Paket
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
                  onChange={(e) => setPkgForm({ ...pkgForm, download_speed: Number(e.target.value) })}
                />
                <Input
                  label="Upload (Kbps)"
                  type="number"
                  value={pkgForm.upload_speed}
                  onChange={(e) => setPkgForm({ ...pkgForm, upload_speed: Number(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Batas Waktu (Validity)"
                  placeholder="Contoh: 2H, 1J"
                  value={pkgForm.validity}
                  onChange={(e) => setPkgForm({ ...pkgForm, validity: e.target.value })}
                  info="Format: H=Hari, J=Jam, M=Minggu, B=Bulan"
                />
                <Input
                  label="Harga (IDR)"
                  type="number"
                  value={pkgForm.price}
                  onChange={(e) => setPkgForm({ ...pkgForm, price: Number(e.target.value) })}
                />
              </div>
              <Button onClick={createPackage} disabled={loading || !pkgForm.name} className="w-full bg-indigo-600 hover:bg-indigo-700">
                Simpan Paket Baru
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200">
              <CardTitle className="text-lg flex items-center justify-between text-slate-900">
                <span>Daftar Paket</span>
                <Badge variant="outline" className="border-slate-200">{packages.length}</Badge>
              </CardTitle>
            </CardHeader>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-500 font-semibold">Nama</th>
                    <th className="px-4 py-3 text-left text-slate-500 font-semibold">Speed / Validity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {packages.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1 font-semibold text-slate-700"><Zap className="w-3 h-3 text-amber-500" /> {formatKbps(p.download_speed)} / {formatKbps(p.upload_speed)}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3 text-slate-400" /> {p.duration_hours ? `${p.duration_hours} Jam` : "Unlimited"}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {packages.length === 0 && (
                    <tr><td colSpan={2} className="p-8 text-center text-slate-400 italic">Belum ada paket tersedia.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* RIGHT COMPONENT: GENERATE & LIST */}
        <div className="xl:col-span-8 space-y-6 text-slate-900">
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
                  onChange={(e) => setGenForm({ ...genForm, code_length: Number(e.target.value) })}
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

                <Input
                  label="Batch Qty"
                  type="number"
                  min={1}
                  max={1000}
                  className="h-10 border-slate-200"
                  value={genForm.quantity}
                  onChange={(e) => setGenForm({ ...genForm, quantity: Number(e.target.value) })}
                />

                <div className="lg:col-span-2">
                  <Button onClick={generate} disabled={loading || !genForm.package_id} className="w-full bg-orange-600 hover:bg-orange-700 h-10 text-white font-bold shadow-md shadow-orange-100 transition-all active:scale-[0.98]">
                    Generate Batch Sekarang
                  </Button>
                </div>
              </div>

              {lastGenerated.length > 0 && (
                <div className="mt-6 rounded-lg border border-orange-200 bg-orange-50/20 overflow-hidden">
                  <div className="px-4 py-2 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
                    <span className="text-sm font-bold text-orange-900">Voucher Berhasil Dibuat</span>
                    <Button variant="ghost" size="sm" onClick={() => copy(lastGenerated.map(v => v.password && v.password !== v.code ? `${v.code} | ${v.password}` : v.code).join("\n"))} className="h-8 text-orange-700 hover:text-orange-900 hover:bg-orange-100 font-semibold">
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Semua
                    </Button>
                  </div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[250px] overflow-y-auto text-slate-900">
                    {lastGenerated.map(v => (
                      <div key={v.id} onClick={() => copy(v.code)} className="group relative cursor-pointer bg-white border border-orange-200 rounded-md p-2 text-center font-mono text-xs hover:border-orange-400 hover:shadow-sm transition-all">
                        <div className="font-bold text-slate-800">{v.code}</div>
                        {v.password && v.password !== v.code && (
                          <div className="text-[9px] text-orange-600 mt-0.5 border-t border-orange-50 pt-0.5">{v.password}</div>
                        )}
                        <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-md" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50/50 border-b border-slate-200 py-4 px-6 gap-4">
              <CardTitle className="text-lg font-bold text-slate-900 px-0">Daftar Voucher User</CardTitle>
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
                    <th className="px-6 py-4 text-left font-semibold">Username</th>
                    <th className="px-6 py-4 text-left font-semibold">Password</th>
                    <th className="px-6 py-4 text-left font-semibold">Paket</th>
                    <th className="px-6 py-4 text-center font-semibold">Router</th>
                    <th className="px-6 py-4 text-center font-semibold">Status</th>
                    <th className="px-6 py-4 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors group border-b border-slate-200">
                      <td className="px-6 py-4 text-slate-900">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 group-hover:scale-105 transition-transform origin-left inline-block">
                          {v.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-900">
                        {v.password && v.password !== v.code ? (
                          <span className="font-mono font-semibold text-orange-700 bg-orange-50 px-2.5 py-1 rounded border border-orange-200 inline-block">
                            {v.password}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic font-medium">= Username</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{v.package_name || "Unknown"}</td>
                      <td className="px-6 py-4 text-center">
                        {v.router_id ? (
                          <Badge variant="secondary" className="font-medium capitalize bg-slate-100 text-slate-700 border-slate-200"><RouterIcon className="w-3 h-3 mr-1.5" /> {routers.find(r => r.id === v.router_id)?.name || "Router"}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 font-normal">Global / All</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize shadow-sm ${v.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' :
                          v.status === 'used' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                            'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => handleEditVoucher(v)} className="h-9 w-9 text-slate-500 hover:text-blue-600 hover:bg-blue-50" title="Edit voucher"><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(v.id, v.code)} className="h-9 w-9 text-slate-500 hover:text-red-600 hover:bg-red-50" title="Hapus voucher"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredVouchers.length === 0 && (
                    <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic font-medium">Data voucher tidak ditemukan atau kosong.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

      </div>

      {/* Edit Voucher Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, voucher: editDialog.voucher })}>
        <DialogContent className="sm:max-w-[500px] bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Detail Voucher</DialogTitle>
            <DialogDescription className="text-slate-600 text-sm">
              Informasi detail dan opsi untuk voucher ini.
            </DialogDescription>
          </DialogHeader>
          {editDialog.voucher && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Username</label>
                  <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="font-mono font-bold text-indigo-700">{editDialog.voucher.code}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Password</label>
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    {editDialog.voucher.password && editDialog.voucher.password !== editDialog.voucher.code ? (
                      <p className="font-mono font-bold text-orange-700">{editDialog.voucher.password}</p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">= Username</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Paket</label>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-medium text-slate-900">{editDialog.voucher.package_name || "Unknown"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Status</label>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <Badge className={`${editDialog.voucher.status === 'active' ? 'bg-green-100 text-green-700' : editDialog.voucher.status === 'used' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                      {editDialog.voucher.status}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Router</label>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    {editDialog.voucher.router_id ? (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                        <RouterIcon className="w-3 h-3 mr-1.5" />
                        {routers.find(r => r.id === editDialog.voucher?.router_id)?.name || "Router"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-400">Global</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-2">
                <Button
                  onClick={() => copy(editDialog.voucher?.password && editDialog.voucher.password !== editDialog.voucher.code ? `${editDialog.voucher.code}|${editDialog.voucher.password}` : editDialog.voucher?.code || "")}
                  variant="outline"
                  className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  📋 Copy Voucher
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, voucher: null })}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
    </div>
  );
}


