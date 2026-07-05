"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { voucherService, VoucherPackage, Voucher } from "@/lib/api/voucherService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Ticket, Check, ChevronDown, Calendar, Database, Download, Settings2, Tag, Monitor, Trash2 } from 'lucide-react';
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useAuth } from "@/lib/hooks/useAuth";
import { useNetworkStore } from "@/stores/networkStore";
import { VoucherDesign } from '@/lib/api/types';
import { VOUCHER_TEMPLATES, getTemplateBySlug } from '@/components/vouchers/templates/registry';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

export default function VoucherPrintPage() {
  const router = useRouter();
  const { showToast } = useNotificationStore();

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [packages, setPackages] = useState<VoucherPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchKey, setSelectedBatchKey] = useState<string>("");
  const [cardDesignMode, setCardDesignMode] = useState<string>('simple');
  const [ownedDesigns, setOwnedDesigns] = useState<VoucherDesign[]>([]);
  const { tenant } = useAuth();
  const { routers, fetchRouters } = useNetworkStore();

  const [brandingSource, setBrandingSource] = useState<'tenant' | 'package' | 'dns' | 'label'>('tenant');
  const [selectedBrandingValue, setSelectedBrandingValue] = useState<string>("");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
  }, {} as Record<string, { vouchers: Voucher[], notes: string, timestamp: string, routerId?: string }>);

  const sortedBatchKeys = Object.keys(batchGroups).sort((a, b) => {
    return b.localeCompare(a); // Sort newest first
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vres, pkgs, owned] = await Promise.all([
        voucherService.listVouchers({ limit: 1000 }),
        voucherService.listPackages(),
        voucherService.listOwnedDesigns()
      ]);
      
      // Always fetch fresh router data to ensure we have branding_config
      await fetchRouters();

      setOwnedDesigns([
        ...owned,
        {
          id: "design-modern",
          slug: "modern",
          name: "Modern QR",
          description: "Desain modern dengan QR code dan info lengkap.",
          price: 0,
          is_free: true,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ]);

      const safeVouchers = Array.isArray(vres?.data) ? vres.data : [];
      const safePkgs = Array.isArray(pkgs) ? pkgs : [];

      setVouchers(safeVouchers);
      setPackages(safePkgs);

      // --- LOGIK GLOBAL DESIGN ---
      // Cek role user
      const isReseller = tenant?.role === 'reseller';
      const defaultSlugs = tenant?.default_voucher_design_slug;
      const resellerSlugs = tenant?.reseller_voucher_design_slug;
      
      const defaultDesigns = Array.isArray(defaultSlugs) ? defaultSlugs : (defaultSlugs ? [defaultSlugs] : []);
      const resellerDesigns = Array.isArray(resellerSlugs) ? resellerSlugs : (resellerSlugs ? [resellerSlugs] : []);
      
      if (isReseller && resellerDesigns.length > 0) {
        // Reseller dipaksa milih dari list yang diijinkan Tenant
        if (!resellerDesigns.includes(cardDesignMode)) {
          setCardDesignMode(resellerDesigns[0]);
        }
      } else if (defaultDesigns.length > 0) {
        // Tenant/User pake desain pertama dari koleksi default mereka sebagai starting point
        if (!defaultDesigns.includes(cardDesignMode) && cardDesignMode === 'simple') {
          setCardDesignMode(defaultDesigns[0]);
        }
      }

      // Auto-select first batch group
      if (safeVouchers.length > 0 && !selectedBatchKey) {
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

  const handleDeleteBatch = async () => {
    if (!selectedBatchKey) return;
    
    try {
      setIsDeleteDialogOpen(false);
      setLoading(true);
      await voucherService.deleteBatch(selectedBatchKey);
      showToast({ title: "Berhasil", description: "Batch voucher berhasil dihapus", variant: "success" });
      setSelectedBatchKey("");
      await loadData();
    } catch (err: any) {
      showToast({ title: "Gagal menghapus", description: err?.message || "Error", variant: "error" });
      setLoading(false);
    }
  };

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
      <div className="flex items-center justify-between no-print">
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
      <Card className="border-purple-100 shadow-sm no-print">
        <CardHeader className="bg-purple-50/50 border-b border-purple-200">
          <CardTitle className="text-purple-900 text-lg">Filter & Pengaturan Print</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row flex-wrap gap-6 lg:items-end">
            {/* Batch Selection */}
            <div className="space-y-2 flex-grow min-w-[280px]">
              <label className="text-sm font-medium text-slate-700">Pilih Batch Print</label>
              <div className="flex gap-2">
                <select
                  value={selectedBatchKey}
                  onChange={(e) => {
                    setSelectedBatchKey(e.target.value);
                    setBrandingSource('tenant');
                    setSelectedBrandingValue("");
                  }}
                  className="flex-1 h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 border-slate-200"
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
                {selectedBatchKey && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="h-10 w-10 text-red-500 border-red-200 hover:bg-red-50"
                    title="Hapus Batch Voucher Ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Template Selection - HIDDEN for Resellers if forced */}
            {tenant?.role !== 'reseller' && (
              <div className="space-y-2 flex-shrink-0">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Template:</label>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full no-scrollbar">
                  {(() => {
                    const isReseller = tenant?.role === 'reseller';
                    
                    const defaultSlugs = tenant?.default_voucher_design_slug;
                    const defaultAllowed = Array.isArray(defaultSlugs) ? defaultSlugs : (defaultSlugs ? [defaultSlugs as unknown as string] : []);

                    const resellerSlugs = tenant?.reseller_voucher_design_slug;
                    const resellerAllowed = Array.isArray(resellerSlugs) ? resellerSlugs : (resellerSlugs ? [resellerSlugs as unknown as string] : []);
                    
                    // Filter designs based on role and mandatory collection
                    let availableDesigns: VoucherDesign[] = [];
                    const alwaysAllowed = ['simple', 'mikhmon'];
                    
                    if (isReseller) {
                      const allowed = resellerAllowed.length > 0 ? resellerAllowed : alwaysAllowed;
                      availableDesigns = ownedDesigns.filter(d => allowed.includes(d.slug) || alwaysAllowed.includes(d.slug));
                    } else {
                      const allowed = defaultAllowed.length > 0 ? defaultAllowed : alwaysAllowed;
                      availableDesigns = ownedDesigns.filter(d => allowed.includes(d.slug) || alwaysAllowed.includes(d.slug));
                    }

                    if (availableDesigns.length > 0) {
                      return availableDesigns.map(design => {
                        const isActive = cardDesignMode === design.slug;
                        return (
                          <button
                            key={design.id}
                            onClick={() => setCardDesignMode(design.slug)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
                              isActive ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {design.name}
                          </button>
                        );
                      });
                    }

                    // No designs allowed case
                    return (
                      <div className="flex items-center gap-3 px-2">
                        <span className="text-xs font-bold text-red-500">Belum ada desain yang diaktifkan.</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => router.push('/vouchers/design')}
                          className="h-7 text-[10px] font-bold border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Pilih Desain Sekarang
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Print Button */}
            <Button
              onClick={() => window.print()}
              disabled={filteredVouchers.length === 0}
              className="bg-purple-600 hover:bg-purple-700 h-10 gap-2 flex-shrink-0 sm:w-auto w-full"
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
 
       {/* Unified Print Styles (Defined as variable for cleaner JSX parsing) */}
       {(() => {
         const gridCols = getTemplateBySlug(cardDesignMode).gridCols || 3;
         const printStyleContent = `
           @media print {
             @page {
               size: A4 portrait;
               margin: 0;
             }
             
             body {
               background: white !important;
               -webkit-print-color-adjust: exact !important;
               print-color-adjust: exact !important;
             }
 
             .no-print, 
             header, footer, nav, button, aside,
             .Card, .bg-amber-50, .absolute.-left-16, .shadow-inner, .no-print-card {
               display: none !important;
             }
 
             .print-container-wrapper, .print-pages-flow {
               display: block !important;
               position: absolute !important;
               top: 0 !important;
               left: 0 !important;
               width: 100% !important;
               margin: 0 !important;
               padding: 0 !important;
             }
 
             /* ONLY strip styles from the simulation sheet, NOT the cards */
             .a4-paper-sheet {
               display: block !important;
               page-break-after: always !important;
               page-break-before: auto !important;
               page-break-inside: avoid !important;
               width: 210mm !important;
               height: 297mm !important; /* STRICT A4 HEIGHT */
               margin: 0 !important;
               padding: 8mm !important; /* Slightly smaller padding */
               border: none !important;
               box-shadow: none !important;
               background: white !important;
               position: relative !important;
               overflow: hidden !important; /* Prevent scroll/overflow */
             }
 
             .print-voucher-grid {
               display: grid !important;
               grid-template-columns: repeat(${gridCols}, 1fr) !important;
               gap: 5px !important; /* Tight gap */
               width: 100% !important;
             }

             /* Absolute footer so it doesn't push the layout */
             .mt-auto.pt-6 {
               position: absolute !important;
               bottom: 8mm !important;
               left: 8mm !important;
               right: 8mm !important;
               padding: 0 !important;
               margin: 0 !important;
             }

             /* Ensure card elements inside grid are visible with their borders */
             .print-item-box, .print-item-box * {
               page-break-inside: avoid !important;
             }
           }
         `;
         return <style dangerouslySetInnerHTML={{ __html: printStyleContent }} />;
       })()}

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
        <div className="space-y-12 pb-20 print-container-wrapper">
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-4 rounded-xl no-print">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                   <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Mode Preview Kertas</h4>
                  <p className="text-xs text-amber-700">Tampilan di bawah mensimulasikan ukuran kertas A4 beneran.</p>
                </div>
             </div>
             <Badge variant="outline" className="bg-white text-amber-700 border-amber-200">
                {filteredVouchers.length} Voucher Terdeteksi
             </Badge>
          </div>

          <div className="flex flex-col items-center gap-10 pt-4 print-pages-flow">
            {(() => {
              const template = getTemplateBySlug(cardDesignMode);
              const TemplateComponent = template.component;
              const gridCols = template.gridCols || 3;
              
              // Safely fit 55 vouchers for Mikhmon & Modern (5x11 grid)
              // Others: 3x5 = 15 (Safety margin)
              const vouchersPerPage = (cardDesignMode === 'mikhmon' || cardDesignMode === 'modern') ? 55 : 15;
              
              const pages: Voucher[][] = [];
              for (let i = 0; i < filteredVouchers.length; i += vouchersPerPage) {
                pages.push(filteredVouchers.slice(i, i + vouchersPerPage));
              }

              return pages.map((pageVouchers, pageIdx) => (
                <div key={pageIdx} className="print-page-wrapper relative group">
                  {/* Page Label (Visible only on screen) */}
                  <div className="absolute -left-16 top-0 h-full hidden xl:flex flex-col items-center no-print">
                      <div className="sticky top-24 flex flex-col items-center gap-2">
                         <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold shadow-lg">
                           {pageIdx + 1}
                         </div>
                         <div className="h-20 w-px bg-gradient-to-b from-purple-400 to-transparent"></div>
                      </div>
                  </div>

                  {/* A4 Paper Simulation */}
                  <div className="a4-paper-sheet bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-slate-200 w-full md:w-[210mm] min-h-[297mm] p-[5mm] flex flex-col relative transition-all duration-500 hover:shadow-[0_30px_80px_rgba(0,0,0,0.15)] overflow-hidden">
                    <div className={`print-voucher-grid grid ${gridCols === 5 ? 'grid-cols-5 gap-0' : 'grid-cols-3 gap-2.5'}`}>
                      {pageVouchers.map((v, idx) => {
                        const pkg = packages.find(p => p.id === v.package_id);
                        const headerTitle = brandingSource === 'tenant' ? (tenant?.name || "WIFI VOUCHER") :
                                           brandingSource === 'package' ? (pkg?.name || "WIFI VOUCHER") :
                                           brandingSource === 'dns' ? (selectedBrandingValue || "hotspot.net") :
                                           (selectedBrandingValue || "WIFI VOUCHER");

                        return (
                          <div key={v.id} className="print-item-box">
                            <TemplateComponent 
                              voucher={v} 
                              index={pageIdx * vouchersPerPage + idx} 
                              pkg={pkg} 
                              headerTitle={headerTitle} 
                            />
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Paper Footer Info (Visible in preview, subtle in print) */}
                    <div className="mt-auto pt-6 flex justify-between items-center text-[9px] text-slate-300 uppercase tracking-widest font-medium opacity-100">
                       <span>
                         {tenant?.name || 'RR_NET'} Voucher System 
                         {selectedBatchKey && batchGroups[selectedBatchKey] && (
                           ` - ${new Date(batchGroups[selectedBatchKey].timestamp).toLocaleDateString('id-ID', {
                             day: '2-digit',
                             month: 'short',
                             year: 'numeric',
                             hour: '2-digit',
                             minute: '2-digit'
                           })}`
                         )}
                       </span>
                       <span>Halaman {pageIdx + 1} / {pages.length}</span>
                       <span className="no-print">Simulasi A4 Portrait</span>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-slate-200 bg-white shadow-2xl p-0 overflow-hidden">
          <div className="p-6 space-y-6">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive flex-shrink-0 animate-pulse">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">Hapus Batch Voucher</DialogTitle>
                  <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                    Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            {selectedBatchKey && batchGroups[selectedBatchKey] && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-3 shadow-inner">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Waktu Pembuatan</span>
                    <span className="text-sm text-slate-900 font-bold bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm transition-all whitespace-nowrap">
                      {new Date(batchGroups[selectedBatchKey].timestamp).toLocaleString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Voucher</span>
                    <Badge variant="secondary" className="font-bold text-purple-700 bg-purple-50 border-purple-100 px-3">
                      {batchGroups[selectedBatchKey].vouchers.length} Voucher
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catatan Batch</span>
                    <span className="text-sm text-slate-700 font-medium italic truncate max-w-[180px] bg-slate-100/50 px-2 py-0.5 rounded">
                      {batchGroups[selectedBatchKey].notes || "Tanpa Catatan"}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-destructive/5 rounded-lg border border-destructive/10">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] font-semibold text-destructive/90 leading-tight">
                    Peringatan: User terkait di MikroTik juga akan dihapus untuk mencegah kebocoran sesi.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 gap-3 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)} 
              className="flex-1 sm:flex-none h-11 border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-900 transition-all active:scale-95"
            >
              Batal
            </Button>
            <Button 
                variant="destructive" 
                onClick={handleDeleteBatch}
                className="flex-1 sm:flex-none h-11 font-bold shadow-md shadow-destructive/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              Ya, Hapus Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
