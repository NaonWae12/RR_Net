"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { voucherService, VoucherPackage, Voucher } from "@/lib/api/voucherService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Ticket, Calendar, Settings2, Tag, ChevronDown, Monitor } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useAuth } from "@/lib/hooks/useAuth";
import { useNetworkStore } from "@/stores/networkStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function VoucherPrintPage() {
  const router = useRouter();
  const { showToast } = useNotificationStore();

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [packages, setPackages] = useState<VoucherPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchKey, setSelectedBatchKey] = useState<string>("");
  const [cardDesignMode, setCardDesignMode] = useState<'simple' | 'branded' | 'mikhmon'>('simple');
  const { tenant } = useAuth();
  const { routers, fetchRouters } = useNetworkStore();

  const [brandingSource, setBrandingSource] = useState<'tenant' | 'package' | 'dns' | 'label'>('tenant');
  const [selectedBrandingValue, setSelectedBrandingValue] = useState<string>("");

  // Aggregate all available DNS and Labels from all routers
  const allAvailableDNS = Array.from(new Set(
    routers.flatMap(r => [
      ...(r.dns_name ? [r.dns_name] : []),
      ...(r.branding_config?.dns_names || [])
    ])
  ));

  const allAvailableLabels = Array.from(new Set(
    routers.flatMap(r => r.branding_config?.labels || [])
  ));

  // Reset or set default branding value when source changes
  useEffect(() => {
    if (brandingSource === 'dns' && allAvailableDNS.length > 0 && !selectedBrandingValue) {
      setSelectedBrandingValue(allAvailableDNS[0]);
    } else if (brandingSource === 'label' && allAvailableLabels.length > 0 && !selectedBrandingValue) {
      setSelectedBrandingValue(allAvailableLabels[0]);
    }
  }, [brandingSource, allAvailableDNS, allAvailableLabels]);

  // Group vouchers by created_at (generation batch) since vouchers generated together share the exact same timestamp
  const batchGroups = vouchers.reduce((acc, v) => {
    const key = v.created_at || 'UNKNOWN_TIME';
    if (!acc[key]) {
      acc[key] = {
        vouchers: [],
        notes: v.notes || 'Tanpa Catatan',
        timestamp: v.created_at,
        routerId: v.router_id
      };
    }
    acc[key].vouchers.push(v);
    return acc;
  }, {} as Record<string, { vouchers: Voucher[], notes: string, timestamp: string }>);

  const sortedBatchKeys = Object.keys(batchGroups).sort((a, b) => {
    return b.localeCompare(a); // Sort newest first
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vres, pkgs] = await Promise.all([
        voucherService.listVouchers({ limit: 1000 }),
        voucherService.listPackages(),
      ]);
      
      // Always fetch fresh router data to ensure we have branding_config
      await fetchRouters();

      const safeVouchers = Array.isArray(vres?.data) ? vres.data : [];
      const safePkgs = Array.isArray(pkgs) ? pkgs : [];

      setVouchers(safeVouchers);
      setPackages(safePkgs);

      // Auto-select first batch group
      if (safeVouchers.length > 0 && !selectedBatchKey) {
        // Since safeVouchers is roughly ordered or we can just pick the first sorted key
        // Wait, sortedBatchKeys is derived from safeVouchers state asynchronously.
        // We'll just pick safeVouchers[0].created_at
        const firstBatchKey = safeVouchers[0].created_at || 'UNKNOWN_TIME';
        setSelectedBatchKey(firstBatchKey);
      }
    } catch (err: any) {
      showToast({ title: "Load failed", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const filteredVouchers = selectedBatchKey && batchGroups[selectedBatchKey] ? batchGroups[selectedBatchKey].vouchers : [];

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/vouchers')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Printer className="w-8 h-8 text-purple-600" /> Management Printing
            </h1>
            <p className="text-slate-500 mt-1">Pilih batch dan print voucher dengan desain kartu yang menarik</p>
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <Card className="border-purple-100 shadow-sm">
        <CardHeader className="bg-purple-50/50 border-b border-purple-200">
          <CardTitle className="text-purple-900 text-lg">Filter & Pengaturan Print</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            {/* Batch Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Pilih Batch Print</label>
              <select
                value={selectedBatchKey}
                onChange={(e) => {
                  setSelectedBatchKey(e.target.value);
                  setBrandingSource('tenant');
                  setSelectedBrandingValue("");
                }}
                className="w-full h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 border-slate-200"
              >
                <option value="">-- Pilih Batch Waktu Generate --</option>
                {sortedBatchKeys.map((key) => {
                  const batch = batchGroups[key];
                  const createdDate = batch.timestamp ? new Date(batch.timestamp).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Waktu Tidak Diketahui';
                  return (
                    <option key={key} value={key}>
                      Batch [{createdDate}] - {batch.vouchers.length} Vouchers ({batch.notes})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Template Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Template Kartu</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCardDesignMode('simple')}
                  className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    cardDesignMode === 'simple'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Simple
                </button>
                <button
                  onClick={() => setCardDesignMode('branded')}
                  className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    cardDesignMode === 'branded'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Branded
                </button>
                <button
                  onClick={() => setCardDesignMode('mikhmon')}
                  className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    cardDesignMode === 'mikhmon'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Mikhmon
                </button>
              </div>
            </div>

            {/* Print Button */}
            <Button
              onClick={() => window.print()}
              disabled={filteredVouchers.length === 0}
              className="bg-purple-600 hover:bg-purple-700 h-10 gap-2"
            >
              <Printer className="w-4 h-4" />
              Print {filteredVouchers.length} Voucher
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100">
            {/* Header Branding Selection */}
            {(() => {
              const currentBatch = batchGroups[selectedBatchKey];
              const isGlobal = !currentBatch?.routerId;
              
              // Robust UUID matching (case-insensitive)
              const selectedRouter = routers.find(r => 
                r.id.toLowerCase() === currentBatch?.routerId?.toLowerCase()
              );
              
              const routerDNSNames = isGlobal ? [] : Array.from(new Set([
                ...(selectedRouter?.dns_name ? [selectedRouter.dns_name] : []),
                ...(selectedRouter?.branding_config?.dns_names || [])
              ]));

              // Aggregate ALL labels from ALL routers so user can use them anywhere
              const allAvailableLabels = Array.from(new Set(
                routers.flatMap(r => r.branding_config?.labels || [])
              ));

              return (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-purple-600" />
                    Voucher Header Branding
                  </label>
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-semibold border-slate-200">
                          <span className="capitalize">
                            {brandingSource === 'tenant' ? 'Account Name' : 
                             brandingSource === 'package' ? 'Package Name' : 
                             brandingSource === 'dns' ? 'DNS Name' : 'Voucher Label'}
                          </span>
                          <ChevronDown className="w-4 h-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 bg-white">
                        <DropdownMenuLabel>Pilih Sumber Label</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup value={brandingSource} onValueChange={(v: any) => {
                          setBrandingSource(v);
                          setSelectedBrandingValue(""); 
                        }}>
                          <DropdownMenuRadioItem value="tenant">Account Name ({tenant?.name || 'User'})</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="package">Package Name</DropdownMenuRadioItem>
                          {!isGlobal && (
                            <DropdownMenuRadioItem value="dns">DNS Name (Router Specific)</DropdownMenuRadioItem>
                          )}
                          <DropdownMenuRadioItem value="label">Voucher Label (All Available)</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Sub-selector for DNS (STRICTLY FILTERED) */}
                    {!isGlobal && brandingSource === 'dns' && (
                      <div className="flex-1 flex gap-2">
                        <select
                          value={selectedBrandingValue}
                          onChange={(e) => setSelectedBrandingValue(e.target.value)}
                          className="flex-1 h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 border-slate-200 font-bold"
                        >
                          <option value="">-- Pilih DNS --</option>
                          {routerDNSNames.map(dns => (
                            <option key={dns} value={dns}>{dns}</option>
                          ))}
                        </select>
                        <input 
                          type="text"
                          placeholder="Manual DNS..."
                          value={selectedBrandingValue}
                          onChange={(e) => setSelectedBrandingValue(e.target.value)}
                          className="w-32 h-10 border rounded-md px-3 text-xs border-slate-200"
                        />
                      </div>
                    )}

                    {/* Sub-selector for Labels (GLOBALLY AVAILABLE) */}
                    {brandingSource === 'label' && (
                      <div className="flex-1 flex gap-2">
                        <select
                          value={selectedBrandingValue}
                          onChange={(e) => setSelectedBrandingValue(e.target.value)}
                          className="flex-1 h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 border-slate-200 font-bold"
                        >
                          <option value="">-- Pilih Label --</option>
                          {allAvailableLabels.map(lbl => (
                            <option key={lbl} value={lbl}>{lbl}</option>
                          ))}
                        </select>
                        <input 
                          type="text"
                          placeholder="Manual Label..."
                          value={selectedBrandingValue}
                          onChange={(e) => setSelectedBrandingValue(e.target.value)}
                          className="w-32 h-10 border rounded-md px-3 text-xs border-slate-200 font-bold text-purple-700"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    {brandingSource === 'dns' 
                      ? `DNS khusus untuk router ini agar portal hotspot tidak salah alamat.` 
                      : `Label kustom bersifat umum dan bisa digunakan untuk semua batch.`}
                  </p>
                </div>
              );
            })()}
          </div>


          {/* Batch Info */}
          {selectedBatchKey && batchGroups[selectedBatchKey] && filteredVouchers.length > 0 && (
            <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-purple-900">
                <Calendar className="w-4 h-4" />
                <span className="font-bold">Tanggal Generate Batch:</span>
                <span>
                  {batchGroups[selectedBatchKey].timestamp ? new Date(batchGroups[selectedBatchKey].timestamp).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Waktu Tidak Diketahui'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-purple-900">
                 <span className="font-bold">Notes/Keterangan:</span>
                 <Badge variant="outline" className="bg-white border-purple-200 text-purple-800">{batchGroups[selectedBatchKey].notes}</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voucher Cards Preview */}
      {filteredVouchers.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-20 text-center">
            <Ticket className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-400 mb-2">Pilih Batch untuk Memulai</h3>
            <p className="text-slate-400 text-sm">Silakan pilih batch voucher yang ingin di-print</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Simple Template */}
          {cardDesignMode === 'simple' && (
            <div className="print-voucher-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVouchers.map((v, idx) => {
                const pkg = packages.find(p => p.id === v.package_id);
                return (
                  <div key={v.id} className="print-card border-2 border-dashed border-slate-300 rounded-lg p-4 bg-white">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-400">#{String(idx + 1).padStart(3, '0')}</span>
                        <Badge variant="outline" className="text-xs uppercase">
                          {brandingSource === 'tenant' ? (tenant?.name || "WIFI") :
                           brandingSource === 'package' ? (pkg?.name || "WIFI") :
                           brandingSource === 'dns' ? (selectedBrandingValue || "WIFI") :
                           (selectedBrandingValue || "WIFI")}
                        </Badge>
                      </div>
                      <div className="border-t border-slate-200 pt-2">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 font-medium">Username:</span>
                            <span className="font-mono font-bold text-slate-900">{v.code}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 font-medium">Password:</span>
                            <span className="font-mono font-bold text-slate-900">{v.password || v.code}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 font-medium">Harga:</span>
                            <span className="font-bold text-emerald-600">Rp {(pkg?.price || 0).toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 font-medium">Masa Aktif:</span>
                            <span className="font-bold text-slate-700">{pkg?.duration_hours ? `${pkg.duration_hours} Jam` : 'Unlimited'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Branded Template */}
          {cardDesignMode === 'branded' && (
            <div className="print-voucher-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVouchers.map((v, idx) => {
                const pkg = packages.find(p => p.id === v.package_id);
                return (
                  <div key={v.id} className="print-card border-2 border-dashed border-indigo-300 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-3 text-white">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Ticket className="w-4 h-4" />
                          <span className="font-bold text-sm uppercase">
                            {brandingSource === 'tenant' ? (tenant?.name || "WIFI VOUCHER") :
                             brandingSource === 'package' ? (pkg?.name || "WIFI VOUCHER") :
                             brandingSource === 'dns' ? (selectedBrandingValue || "hotspot.net") :
                             (selectedBrandingValue || "WIFI VOUCHER")}
                          </span>
                        </div>
                        <span className="text-xs font-bold opacity-80">#{String(idx + 1).padStart(3, '0')}</span>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="text-center mb-2">
                        <Badge className="bg-indigo-600 text-white font-bold">{pkg?.name || 'Unknown'}</Badge>
                      </div>
                      <div className="space-y-1 bg-white rounded-lg p-3 border border-indigo-200">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">Username:</span>
                          <span className="font-mono font-bold text-indigo-700">{v.code}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">Password:</span>
                          <span className="font-mono font-bold text-purple-700">{v.password || v.code}</span>
                        </div>
                        <div className="flex justify-between text-xs pt-2 border-t border-slate-200">
                          <span className="text-slate-500 font-medium">Harga:</span>
                          <span className="font-bold text-emerald-600">Rp {(pkg?.price || 0).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">Masa Aktif:</span>
                          <span className="font-bold text-slate-700">{pkg?.duration_hours ? `${pkg.duration_hours} Jam` : 'Unlimited'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {cardDesignMode === 'mikhmon' && (
            <div className="print-voucher-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {(() => {
                const uniqueRouterIds = new Set(filteredVouchers.map(v => v.router_id).filter(Boolean));
                const uniqueDnsNames = new Set(
                  filteredVouchers
                    .map(v => routers.find(r => r.id === v.router_id)?.dns_name)
                    .filter(Boolean)
                );
                const useOrgName = uniqueRouterIds.size > 1 || uniqueDnsNames.size > 1;
                const orgName = tenant?.name || "WIFI VOUCHER";

                return filteredVouchers.map((v, idx) => {
                  const pkg = packages.find(p => p.id === v.package_id);
                  const router = routers.find(r => r.id === v.router_id);
                  
                  const headerTitle = brandingSource === 'tenant' ? (tenant?.name || "WIFI VOUCHER") :
                                     brandingSource === 'package' ? (pkg?.name || "WIFI VOUCHER") :
                                     brandingSource === 'dns' ? (selectedBrandingValue || "hotspot.net") :
                                     (selectedBrandingValue || "WIFI VOUCHER");
                  
                  return (
                    <div key={v.id} className="print-card bg-white border-2 border-black p-2 text-[10px] font-bold text-black w-full max-w-[160px] shadow-sm uppercase min-h-[100px] flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center border-b-2 border-black pb-1 mb-1.5 px-1">
                          <span className="truncate max-w-[90px] font-bold normal-case">{headerTitle}</span>
                          <span>[{idx + 1}]</span>
                        </div>
                        <div className="flex text-[9px] text-center mb-1 leading-none">
                          <div className="flex-1">User</div>
                          <div className="flex-1">Pass</div>
                        </div>
                        <div className="flex gap-1 mb-2">
                          <div className="flex-1 border-2 border-black py-1 px-1 text-center font-semibold text-[13px] leading-none normal-case">
                            {v.code}
                          </div>
                          <div className="flex-1 border-2 border-black py-1 px-1 text-center font-semibold text-[13px] leading-none normal-case">
                            {v.password || v.code}
                          </div>
                        </div>
                      </div>
                      <div className="border-2 border-black py-1 px-1 text-center text-[11px] font-black leading-none bg-slate-50">
                        {pkg?.duration_hours ? `${pkg.duration_hours}j` : '∞'} Rp {pkg?.price ? `${(pkg.price / 1000).toFixed(0)}rb` : '0'}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* 1. Hide page UI — header, nav, controls card, batch info */
          body * { visibility: hidden; }

          /* 2. Show only the voucher grid */
          .print-voucher-grid,
          .print-voucher-grid * {
            visibility: visible !important;
          }

          /* 3. Anchor grid to top of page, full width, no extra spacing */
          .print-voucher-grid {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: grid !important;
            grid-template-columns: repeat(var(--grid-cols, 3), 1fr) !important;
            gap: 8px !important;
          }

          /* 4. Each card: compact and no page-break inside */
          .print-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 8px !important;
          }

          /* 5. Page: A4 portrait with tight margins so 10+ cards fit per page */
          @page {
            size: A4 portrait;
            margin: 0.7cm;
          }
        }
      `}} />
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .print-voucher-grid {
            --grid-cols: ${cardDesignMode === 'mikhmon' ? 5 : 3};
          }
        }
      `}} />
    </div>
  );
}
