"use client";

import { useEffect, useMemo, useState } from "react";
import { voucherService, VoucherPackage, Voucher } from "@/lib/api/voucherService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNotificationStore } from "@/stores/notificationStore";

function formatKbps(kbps: number) {
  if (!kbps) return "-";
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 1)} Mbps`;
  return `${kbps} Kbps`;
}

export default function VouchersPage() {
  const { showToast } = useNotificationStore();
  const [packages, setPackages] = useState<VoucherPackage[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);

  // Mikhmon-ish: left side = package mgmt; right side = generate + voucher list
  const [pkgForm, setPkgForm] = useState({
    name: "",
    download_speed: 2048,
    upload_speed: 1024,
    price: 0,
  });
  const [genForm, setGenForm] = useState({
    package_id: "",
    quantity: 10,
    expires_at: "",
  });
  const [lastGenerated, setLastGenerated] = useState<Voucher[]>([]);

  const packageOptions = useMemo(() => (packages ?? []).map((p) => ({ id: p.id, name: p.name })), [packages]);

  const load = async () => {
    setLoading(true);
    try {
      const [pkgs, vres] = await Promise.all([
        voucherService.listPackages(),
        voucherService.listVouchers({ limit: 200 }),
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
        price: Number(pkgForm.price || 0),
      });
      showToast({ title: "Paket dibuat", description: "Paket voucher berhasil ditambahkan", variant: "success" });
      setPkgForm({ name: "", download_speed: 2048, upload_speed: 1024, price: 0 });
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
      showToast({ title: "Copied", description: text, variant: "success" });
    } catch {
      showToast({ title: "Copy failed", description: "Clipboard permission blocked", variant: "error" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Voucher Hotspot</h1>
          <p className="text-sm text-slate-500">Paket → Generate → Pakai voucher (mirip flow Mikhmon)</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Paket */}
        <div className="lg:col-span-4 space-y-4">
          <div className="border rounded-lg bg-white">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold">Paket Voucher</h2>
              <p className="text-xs text-slate-500">Speed profile untuk voucher</p>
            </div>
            <div className="p-4 space-y-3">
              <Input
                label="Nama paket"
                placeholder="Contoh: HOTSPOT 2M"
                value={pkgForm.name}
                onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
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
              <Input
                label="Harga (opsional)"
                type="number"
                value={pkgForm.price}
                onChange={(e) => setPkgForm({ ...pkgForm, price: Number(e.target.value) })}
              />
              <Button onClick={createPackage} disabled={loading || !pkgForm.name} className="w-full">
                Simpan Paket
              </Button>
            </div>
          </div>

          <div className="border rounded-lg bg-white overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">Daftar Paket</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Paket</th>
                    <th className="px-3 py-2 text-left">Speed</th>
                  </tr>
                </thead>
                <tbody>
                  {(packages ?? []).map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {formatKbps(p.download_speed)} / {formatKbps(p.upload_speed)}
                      </td>
                    </tr>
                  ))}
                  {(packages ?? []).length === 0 && (
                    <tr>
                      <td className="px-3 py-3 text-slate-500" colSpan={2}>
                        Belum ada paket.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: Generate + Vouchers */}
        <div className="lg:col-span-8 space-y-4">
          <div className="border rounded-lg bg-white">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold">Generate Voucher</h2>
              <p className="text-xs text-slate-500">Buat kode voucher batch</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Paket</label>
                  <select
                    className="w-full border rounded px-2 py-2"
                    value={genForm.package_id}
                    onChange={(e) => setGenForm({ ...genForm, package_id: e.target.value })}
                  >
                    <option value="">Pilih Paket</option>
                    {packageOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Qty"
                  type="number"
                  value={genForm.quantity}
                  onChange={(e) => setGenForm({ ...genForm, quantity: Number(e.target.value) })}
                />
                <Input
                  label="Expires (ISO, optional)"
                  placeholder="2026-12-31T23:59:59Z"
                  value={genForm.expires_at}
                  onChange={(e) => setGenForm({ ...genForm, expires_at: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={generate} disabled={loading || !genForm.package_id}>
                  Generate
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copy(lastGenerated.map((v) => v.code).join("\n"))}
                  disabled={lastGenerated.length === 0}
                >
                  Copy hasil (newline)
                </Button>
              </div>

              {lastGenerated.length > 0 && (
                <div className="border rounded mt-2 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 text-sm font-medium">Hasil Generate Terakhir</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white">
                        <tr>
                          <th className="px-3 py-2 text-left">Code</th>
                          <th className="px-3 py-2 text-left">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastGenerated.map((v) => (
                          <tr key={v.id} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs">{v.code}</td>
                            <td className="px-3 py-2">
                              <Button variant="outline" onClick={() => copy(v.code)}>
                                Copy
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-lg bg-white overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold">Daftar Voucher</h2>
              <span className="text-xs text-slate-500">Terbaru di atas</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">Paket</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Expires</th>
                    <th className="px-3 py-2 text-left">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(vouchers ?? []).map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{v.code}</td>
                      <td className="px-3 py-2">{v.package_name || v.package_id}</td>
                      <td className="px-3 py-2">{v.status}</td>
                      <td className="px-3 py-2">{v.expires_at || "-"}</td>
                      <td className="px-3 py-2">
                        <Button variant="outline" onClick={() => copy(v.code)}>
                          Copy
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(vouchers ?? []).length === 0 && (
                    <tr>
                      <td className="px-3 py-3 text-slate-500" colSpan={5}>
                        Belum ada voucher.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


