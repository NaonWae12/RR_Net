"use client";

import { useEffect, useMemo, useState } from "react";
import { voucherService, VoucherPackage, Voucher } from "@/lib/api/voucherService";
import { useNetworkStore } from "@/stores/networkStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Ticket,
  Plus,
  RotateCw,
  Zap,
  Clock,
  Copy,
  Printer,
  Trash2,
  LayoutGrid,
  Search,
  Router as RouterIcon
} from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";

function formatKbps(kbps: number) {
  if (!kbps) return "-";
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 1)} Mbps`;
  return `${kbps} Kbps`;
}

export default function VouchersPage() {
  const { showToast } = useNotificationStore();
  const { routers, fetchRouters } = useNetworkStore();

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

  const [genForm, setGenForm] = useState({
    package_id: "",
    router_id: "all",
    quantity: 10,
    expires_at: "",
  });

  const [lastGenerated, setLastGenerated] = useState<Voucher[]>([]);

  const packageOptions = useMemo(() => (packages ?? []).map((p) => ({ id: p.id, name: p.name })), [packages]);

  const load = async () => {
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
  }, []);

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
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
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
          <Card className="border-indigo-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-indigo-50/50 border-b">
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

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between text-slate-900">
                <span>Daftar Paket</span>
                <Badge variant="outline">{packages.length}</Badge>
              </CardTitle>
            </CardHeader>
            <div className="max-h-[500px] overflow-y-auto border-t">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Nama</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Speed / Validity</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {packages.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" /> {formatKbps(p.download_speed)} / {formatKbps(p.upload_speed)}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {p.duration_hours ? `${p.duration_hours} Jam` : "Unlimited"}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {packages.length === 0 && (
                    <tr><td colSpan={2} className="p-4 text-center text-slate-400">Belum ada paket.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* RIGHT COMPONENT: GENERATE & LIST */}
        <div className="xl:col-span-8 space-y-6">
          <Card className="border-orange-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-orange-50/50 border-b">
              <CardTitle className="text-orange-900 text-lg flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" /> Generate Voucher Batch
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 leading-none">Paket (Profile)</label>
                  <select
                    className="w-full h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none text-slate-900"
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
                    className="w-full h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none text-slate-900"
                    value={genForm.router_id}
                    onChange={(e) => setGenForm({ ...genForm, router_id: e.target.value })}
                  >
                    <option value="all">Semua Router (Default)</option>
                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Jumlah (Quantity)"
                  type="number"
                  min={1}
                  max={1000}
                  value={genForm.quantity}
                  onChange={(e) => setGenForm({ ...genForm, quantity: Number(e.target.value) })}
                />

                <Button onClick={generate} disabled={loading || !genForm.package_id} className="w-full bg-orange-600 hover:bg-orange-700 h-10">
                  Generate Sekarang
                </Button>
              </div>

              {lastGenerated.length > 0 && (
                <div className="mt-6 rounded-lg border border-orange-200 bg-orange-50/20">
                  <div className="px-4 py-2 border-b border-orange-200 flex items-center justify-between">
                    <span className="text-sm font-semibold text-orange-900">Voucher Berhasil Dibuat</span>
                    <Button variant="ghost" size="sm" onClick={() => copy(lastGenerated.map(v => v.code).join("\n"))} className="h-8 text-orange-700 hover:text-orange-900 hover:bg-orange-100">
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy Semua
                    </Button>
                  </div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[200px] overflow-y-auto">
                    {lastGenerated.map(v => (
                      <div key={v.id} onClick={() => copy(v.code)} className="cursor-pointer bg-white border border-orange-200 rounded px-2 py-1 text-center font-mono text-xs hover:border-orange-400 transition-colors">
                        {v.code}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4 ">
              <CardTitle className="text-lg text-slate-900">Daftar Voucher User</CardTitle>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  placeholder="Cari kode voucher..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-t">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Kode</th>
                    <th className="px-4 py-3 text-left font-medium">Paket</th>
                    <th className="px-4 py-3 text-left font-medium text-center">Router</th>
                    <th className="px-4 py-3 text-left font-medium text-center">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">{v.code}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{v.package_name || "Unknown"}</td>
                      <td className="px-4 py-3 text-center">
                        {v.router_id ? (
                          <Badge variant="secondary" className="font-normal capitalize"><RouterIcon className="w-3 h-3 mr-1" /> {routers.find(r => r.id === v.router_id)?.name || "Router"}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400">All Routers</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${v.status === 'active' ? 'bg-green-100 text-green-800' :
                          v.status === 'used' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => copy(v.code)} className="h-8 w-8 text-slate-500"><Copy className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><Printer className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredVouchers.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Data voucher tidak ditemukan.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}


