'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import resellerService from '@/lib/api/resellerService';
import { voucherService, Voucher, VoucherPackage } from '@/lib/api/voucherService';
import { ResellerPurchase, ResellerPrice } from '@/lib/api/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Printer, 
  Ticket, 
  Download, 
  Loader2, 
  ChevronDown, 
  Tag, 
  Monitor, 
  Calendar,
  Settings2
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useNetworkStore } from '@/stores/networkStore';
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { VOUCHER_TEMPLATES, getTemplateBySlug } from '@/components/vouchers/templates/registry';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function PrintPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const purchaseId = searchParams.get('purchase_id');

  const [purchase, setPurchase] = useState<ResellerPurchase | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [packages, setPackages] = useState<VoucherPackage[]>([]);
  const [resellerPrices, setResellerPrices] = useState<ResellerPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [cardDesignMode, setCardDesignMode] = useState<string>('modern');
  const [brandingSource, setBrandingSource] = useState<'tenant' | 'package' | 'dns' | 'label'>('tenant');
  const [selectedBrandingValue, setSelectedBrandingValue] = useState<string>("");
  
  const { tenant } = useAuth();
  const { routers, fetchRouters } = useNetworkStore();

  const allAvailableDNS = Array.from(new Set(
    routers.flatMap(r => [
      ...(r.dns_name ? [r.dns_name] : []),
      ...(r.branding_config?.dns_names || [])
    ])
  ));

  const allAvailableLabels = Array.from(new Set(
    routers.flatMap(r => r.branding_config?.labels || [])
  ));

  useEffect(() => {
    if (!purchaseId) {
      setLoading(false);
      return;
    }
    loadData(purchaseId);
  }, [purchaseId]);

  const loadData = async (id: string) => {
    try {
      setLoading(true);
      const [purchaseData, packagesData, pricesData] = await Promise.all([
        resellerService.getPurchase(id),
        voucherService.listPackages(),
        resellerService.getMyPrices()
      ]);
      
      // Make router fetch optional to prevent 403 for resellers
      try {
        await fetchRouters();
      } catch (e) {
        console.warn('Reseller does not have permission to fetch routers, skipping branding DNS options.');
      }
      
      setPurchase(purchaseData);
      setVouchers(purchaseData.vouchers || []);
      setPackages(packagesData);
      setResellerPrices(pricesData);

      // Default design logic for Reseller
      const allowedSlugs = tenant?.reseller_voucher_design_slug;
      const resellerAllowed = Array.isArray(allowedSlugs) 
        ? allowedSlugs 
        : (allowedSlugs ? [allowedSlugs as string] : []);

      if (resellerAllowed.length > 0) {
        // Set default to the first allowed design if current isn't in the list
        if (!resellerAllowed.includes(cardDesignMode)) {
          setCardDesignMode(resellerAllowed[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.querySelector('.print-pages-flow') as HTMLElement;
    if (!element) return;

    try {
      setIsDownloading(true);
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = element.querySelectorAll('.a4-paper-sheet');
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        const dataUrl = await toPng(page, { 
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          skipFonts: true // Faster rendering
        });
        
        if (i > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297);
      }
      
      const fileName = `vouchers-${purchase?.voucher_package_name || 'batch'}-${new Date().getTime()}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50 space-y-4">
        <Ticket className="w-12 h-12 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-800">Purchase tidak ditemukan</h2>
        <Button onClick={() => router.back()}>Kembali</Button>
      </div>
    );
  }

  const template = getTemplateBySlug(cardDesignMode);
  const TemplateComponent = template.component;
  const gridCols = template.gridCols || 3;
  const vouchersPerPage = (cardDesignMode === 'mikhmon' || cardDesignMode === 'modern') ? 55 : 15;
  
  const pages: Voucher[][] = [];
  for (let i = 0; i < vouchers.length; i += vouchersPerPage) {
    pages.push(vouchers.slice(i, i + vouchersPerPage));
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-slate-900 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Printer className="w-8 h-8 text-indigo-600" /> Reseller Print Portal
            </h1>
            <p className="text-slate-500 mt-1">Cetak voucher pembelian reseller dengan desain premium</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Card className="border-indigo-100 shadow-sm no-print">
        <CardHeader className="bg-indigo-50/50 border-b border-indigo-200 py-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-indigo-900 text-lg flex items-center gap-2">
             <Settings2 className="w-5 h-5" /> Pengaturan Print
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="h-9 gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-4"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">Download PDF</span>
            </Button>
            <Button
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 h-9 gap-2 shadow-sm px-4"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print {vouchers.length} Voucher</span>
              <span className="sm:hidden">Print</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Template Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Template Desain:</label>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
                {(() => {
                  const allowedSlugs = tenant?.reseller_voucher_design_slug;
                  const resellerAllowed = Array.isArray(allowedSlugs) 
                    ? allowedSlugs 
                    : (allowedSlugs ? [allowedSlugs as string] : []);
                  
                  // Filter templates from registry
                  const alwaysAllowed = ['simple', 'mikhmon'];
                  const allowed = resellerAllowed.length > 0 ? resellerAllowed : alwaysAllowed;
                  
                  const availableTemplates = Object.values(VOUCHER_TEMPLATES).filter(t => 
                    allowed.includes(t.id) || alwaysAllowed.includes(t.id)
                  );

                  if (availableTemplates.length > 0) {
                    return availableTemplates.map(tmpl => (
                      <button
                        key={tmpl.id}
                        onClick={() => setCardDesignMode(tmpl.id)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
                          cardDesignMode === tmpl.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {tmpl.id.toUpperCase()}
                      </button>
                    ));
                  }

                  // No designs allowed for reseller
                  return (
                    <div className="flex items-center gap-3 px-2">
                       <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 font-bold py-1 px-3">
                         Silahkan request ke admin untuk setup desain voucher
                       </Badge>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Branding Selection */}
            <div className="space-y-2 flex-grow">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                Voucher Header Branding
              </label>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-semibold border-slate-200 min-w-[180px]">
                      <span className="capitalize">
                        {brandingSource === 'tenant' ? 'Nama Toko' : 
                         brandingSource === 'package' ? 'Nama Paket' : 
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
                      <DropdownMenuRadioItem value="tenant">Nama Toko ({tenant?.name || 'User'})</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="package">Nama Paket</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="dns">DNS Name (Router Specific)</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="label">Voucher Label (All Available)</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {brandingSource === 'dns' && (
                  <div className="flex-1 flex gap-2">
                    <select
                      value={selectedBrandingValue}
                      onChange={(e) => setSelectedBrandingValue(e.target.value)}
                      className="flex-1 h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 border-slate-200 font-bold"
                    >
                      <option value="">-- Pilih DNS --</option>
                      {allAvailableDNS.map(dns => (
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

                {brandingSource === 'label' && (
                  <div className="flex-1 flex gap-2">
                    <select
                      value={selectedBrandingValue}
                      onChange={(e) => setSelectedBrandingValue(e.target.value)}
                      className="flex-1 h-10 border rounded-md px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 border-slate-200 font-bold"
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
                      className="w-32 h-10 border rounded-md px-3 text-xs border-slate-200 font-bold text-indigo-700"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-indigo-900">
              <Calendar className="w-4 h-4" />
              <span className="font-bold">Paket:</span>
              <span>{purchase.voucher_package_name}</span>
              <span className="mx-2 text-indigo-300">|</span>
              <span className="font-bold">Tanggal Beli:</span>
              <span>{new Date(purchase.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-800">
              ID Pembelian: {purchase.id.substring(0, 8)}...
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { 
            size: A4 portrait; 
            margin: 0 !important; 
          }
          
          /* Sapu bersih semua UI Portal & Browser UI */
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }

          .no-print, 
          header, 
          footer, 
          nav, 
          aside, 
          button,
          [role="navigation"],
          .fixed,
          .sticky {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
          }

          /* Isolasi area print */
          .print-pages-flow { 
            display: block !important; 
            width: 210mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
          }

          .a4-paper-sheet { 
            display: block !important; 
            page-break-after: always !important; 
            page-break-inside: avoid !important;
            width: 210mm !important; 
            height: 297mm !important; 
            margin: 0 !important; 
            padding: 8mm !important; 
            border: none !important; 
            box-shadow: none !important; 
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-voucher-grid { 
            display: grid !important; 
            grid-template-columns: repeat(${gridCols}, 1fr) !important; 
            gap: 5px !important; 
            width: 100% !important;
          }
        }
      `}} />

      {/* Preview Section */}
      <div className="flex flex-col items-center gap-10 pt-4 print-pages-flow bg-slate-200/40 rounded-[3rem] p-10 shadow-inner border border-slate-200/50">
        <div className="flex items-center justify-between no-print w-full max-w-[210mm]">
          <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-sm">
            <Monitor className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-black text-slate-700 uppercase tracking-tight">Preview Kertas A4 ({pages.length} Halaman)</span>
          </div>
          <Badge className="bg-indigo-600 text-white font-black px-4 py-1.5 rounded-xl shadow-lg shadow-indigo-100">
             {vouchers.length} Vouchers
          </Badge>
        </div>

        {pages.map((pageVouchers, pageIdx) => (
          <div key={pageIdx} className="a4-paper-sheet bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] w-full md:w-[210mm] min-h-[297mm] p-[8mm] flex flex-col relative overflow-hidden rounded-sm transition-transform hover:scale-[1.01] duration-500">
            {/* Page number indicator for screen only */}
            <div className="absolute top-6 -left-12 no-print rotate-[-90deg]">
               <Badge className="bg-slate-900 text-white font-black px-4 py-1 rounded-lg shadow-xl">PAGE {pageIdx + 1}</Badge>
            </div>

            <div className={`print-voucher-grid grid ${gridCols === 5 ? 'grid-cols-5 gap-1.5' : 'grid-cols-3 gap-3'}`}>
              {pageVouchers.map((v, idx) => {
                const pkg = packages.find(p => p.id === v.package_id);
                const price = resellerPrices.find(p => p.voucher_package_id === v.package_id)?.retail_price || purchase.unit_price;
                const headerTitle = brandingSource === 'tenant' ? (tenant?.name || "WIFI VOUCHER") :
                                   brandingSource === 'package' ? (purchase.voucher_package_name || "WIFI VOUCHER") :
                                   brandingSource === 'dns' ? (selectedBrandingValue || "hotspot.net") :
                                   (selectedBrandingValue || "WIFI VOUCHER");

                return (
                  <div key={v.id} className="print-item-box">
                    <TemplateComponent 
                      voucher={v} 
                      index={pageIdx * vouchersPerPage + idx} 
                      pkg={{...pkg, price} as any} 
                      headerTitle={headerTitle} 
                    />
                  </div>
                );
              })}
            </div>
            
            <div className="mt-auto pt-6 flex justify-between items-center text-[9px] text-slate-300 uppercase tracking-widest font-medium">
               <span>Reseller Portal - {tenant?.name}</span>
               <span>Halaman {pageIdx + 1} / {pages.length}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResellerPrintPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
      <PrintPage />
    </Suspense>
  );
}
