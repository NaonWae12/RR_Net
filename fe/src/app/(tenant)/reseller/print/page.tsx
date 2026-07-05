/**
 * RESELLER VOUCHER PRINT PAGE
 * This is a TypeScript React file (.tsx)
 */
"use client";

import { useEffect, useState, Suspense, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import resellerService from '@/lib/api/resellerService';
import { voucherService } from '@/lib/api/voucherService';
import { ResellerPurchase, Voucher, VoucherPackage, ResellerPrice } from '@/lib/api/types';
import { 
  ArrowLeft, 
  Printer, 
  Ticket, 
  Download, 
  Loader2, 
  Settings2,
  CheckCircle2,
  AlertCircle,
  Palette,
  Monitor,
  Tag,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useNetworkStore } from '@/stores/networkStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VOUCHER_TEMPLATES, getTemplateBySlug } from '@/components/vouchers/templates/registry';

function PrintPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const purchaseId = searchParams.get('purchase_id');
  const printRef = useRef<HTMLDivElement>(null);

  const [purchase, setPurchase] = useState<ResellerPurchase | null>(null);
  const [packages, setPackages] = useState<VoucherPackage[]>([]);
  const [resellerPrices, setResellerPrices] = useState<ResellerPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardDesignMode, setCardDesignMode] = useState<string>('simple');
  
  // Header Branding State (synced with Portal logic)
  const [brandingSource, setBrandingSource] = useState<'tenant' | 'package' | 'dns' | 'label'>('tenant');
  const [selectedBrandingValue, setSelectedBrandingValue] = useState('');

  const { tenant } = useAuth();
  const { routers, fetchRouters } = useNetworkStore();

  // Collect DNS names & labels from routers branding_config (same as Portal)
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
      setError('Purchase ID tidak ditemukan di URL.');
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
        resellerService.getGlobalPrices()
      ]);

      setPurchase(purchaseData);
      setPackages(packagesData);
      setResellerPrices(pricesData);
      
      try {
        await fetchRouters();
      } catch (e) {
        console.warn('Failed to fetch routers');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (purchase?.vouchers?.[0]?.router_id && routers.length > 0) {
      const matchedRouter = routers.find(r => r.id === purchase.vouchers![0].router_id);
      if (matchedRouter?.dns_name && !selectedBrandingValue) {
        setSelectedBrandingValue(matchedRouter.dns_name);
      }
    }
  }, [purchase, routers]);

  // Pagination Logic
  const vouchers = purchase?.vouchers || [];
  const template = getTemplateBySlug(cardDesignMode);
  const TemplateComponent = template.component;
  const gridCols = template.gridCols || 3;
  const vouchersPerPage = (cardDesignMode === 'mikhmon' || cardDesignMode === 'modern') ? 55 : 15;

  const pages = useMemo(() => {
    const p: Voucher[][] = [];
    for (let i = 0; i < vouchers.length; i += vouchersPerPage) {
      p.push(vouchers.slice(i, i + vouchersPerPage));
    }
    return p;
  }, [vouchers, vouchersPerPage]);

  const handleDownloadPDF = async () => {
    const element = document.querySelector('.print-pages-flow') as HTMLElement;
    if (!element) return;

    try {
      setIsDownloading(true);
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageElements = element.querySelectorAll('.a4-paper-sheet');
      
      for (let i = 0; i < pageElements.length; i++) {
        const page = pageElements[i] as HTMLElement;
        const dataUrl = await toPng(page, { 
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          skipFonts: true
        });
        
        if (i > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297);
      }
      
      pdf.save(`Vouchers-${purchase?.reseller_name}-${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="font-bold text-sm">Menyiapkan cetakan voucher...</p>
        </div>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4 max-w-md p-8 bg-white rounded-3xl shadow-xl border border-slate-100">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="font-black text-slate-900 text-2xl tracking-tight">Oops! Terjadi Kesalahan</h2>
          <p className="text-slate-500 font-medium leading-relaxed">{error}</p>
          <Button onClick={() => router.back()} className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-black transition-all font-bold">
            Kembali ke Daftar
          </Button>
        </div>
      </div>
    );
  }

  // Resolve Header Text (same logic as Portal)
  const resolveHeaderTitle = () => {
    switch(brandingSource) {
      case 'tenant': return tenant?.name || "WIFI VOUCHER";
      case 'package': return purchase.voucher_package_name || "HOTSPOT";
      case 'dns': return selectedBrandingValue || "hotspot.net";
      case 'label': return selectedBrandingValue || "WIFI VOUCHER";
      default: return "WIFI VOUCHER";
    }
  };
  const headerTitle = resolveHeaderTitle();

  return (
    <div className="min-h-screen bg-slate-100/50 pb-20">
      {/* Header Sticky - No Print */}
      <div className="no-print bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-[100] shadow-sm">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-slate-900 text-lg tracking-tight">Cetak Voucher (Admin)</h1>
                <Badge className="bg-indigo-600 text-white border-none text-[10px] uppercase font-black px-2">Order #{purchase.id.slice(0, 8)}</Badge>
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                {purchase.reseller_name} &bull; {purchase.voucher_package_name} &bull; {vouchers.length} Items
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button 
              variant="outline" 
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="bg-white border-slate-200 text-slate-700 h-11 gap-2 shadow-sm rounded-2xl px-6 font-bold hover:bg-slate-50 transition-all"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download PDF
            </Button>
            <Button 
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 h-11 gap-2 shadow-md shadow-indigo-100 rounded-2xl px-6 font-black transition-all"
            >
              <Printer className="w-4 h-4" />
              Cetak Sekarang
            </Button>
          </div>
        </div>
      </div>

      <div className="print-layout-wrapper max-w-[1200px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Controls Sidebar - No Print */}
        <div className="no-print lg:col-span-4 space-y-6">
          <Card className="rounded-[2rem] border-none shadow-xl shadow-slate-200/50 overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6 pb-8">
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <Settings2 className="w-6 h-6 text-indigo-400" />
                Pengaturan Print
              </CardTitle>
              <CardDescription className="text-slate-400 font-medium">Kustomisasi tampilan voucher sebelum dicetak.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 -mt-4 bg-white rounded-t-[2rem] space-y-8">
              {/* Template Selection */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Palette className="w-4 h-4 text-indigo-500" /> Pilih Desain:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    const allowedSlugs = tenant?.reseller_voucher_design_slug;
                    const resellerAllowed = Array.isArray(allowedSlugs) 
                      ? allowedSlugs 
                      : (allowedSlugs ? [allowedSlugs as string] : []);
                    
                    const alwaysAllowed = ['simple', 'mikhmon'];
                    const allowed = resellerAllowed.length > 0 ? resellerAllowed : alwaysAllowed;
                    
                    const availableTemplates = Object.values(VOUCHER_TEMPLATES).filter(t => 
                      allowed.includes(t.id) || alwaysAllowed.includes(t.id)
                    );

                    return availableTemplates.map(tmpl => (
                      <button
                        key={tmpl.id}
                        onClick={() => setCardDesignMode(tmpl.id)}
                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                          cardDesignMode === tmpl.id 
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                            : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                        }`}
                      >
                        <span className={`font-black text-sm uppercase tracking-tight ${cardDesignMode === tmpl.id ? 'text-indigo-700' : 'text-slate-600 group-hover:text-slate-900'}`}>
                          {tmpl.id}
                        </span>
                        {cardDesignMode === tmpl.id && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                      </button>
                    ));
                  })()}
                </div>
              </div>

              {/* Branding Header (synced with Portal functionality) */}
              <div className="space-y-4 pt-4 border-t border-slate-50">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-indigo-500" /> Voucher Header Branding:
                </label>
                
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'tenant', label: 'Nama Toko' },
                      { id: 'package', label: 'Nama Paket' },
                      { id: 'dns', label: 'DNS Name' },
                      { id: 'label', label: 'Voucher Label' }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => {
                          setBrandingSource(type.id as any);
                          setSelectedBrandingValue('');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          brandingSource === type.id 
                            ? 'bg-slate-900 text-white shadow-md' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  {brandingSource === 'dns' && (
                    <div className="space-y-2">
                      <select 
                        value={selectedBrandingValue}
                        onChange={(e) => setSelectedBrandingValue(e.target.value)}
                        className="w-full p-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
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
                        className="w-full p-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  )}

                  {brandingSource === 'label' && (
                    <div className="space-y-2">
                      <select 
                        value={selectedBrandingValue}
                        onChange={(e) => setSelectedBrandingValue(e.target.value)}
                        className="w-full p-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
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
                        className="w-full p-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Paper Simulation Area */}
        <div className="lg:col-span-8 flex flex-col items-center gap-10 pt-4 print-pages-flow bg-slate-200/40 rounded-[3rem] p-10 shadow-inner border border-slate-200/50">
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
            <div 
              key={pageIdx} 
              /* vvv SET MARGIN KERTAS (PREVIEW) DISINI vvv */
              className="a4-paper-sheet bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] w-full md:w-[210mm] min-h-[297mm] flex flex-col relative overflow-hidden rounded-sm transition-transform hover:scale-[1.01] duration-500"
              style={{
                paddingTop: '4mm',    // <-- MARGIN ATAS
                paddingBottom: '2mm', // <-- MARGIN BAWAH (DIPRES BIAR GAK BANDEL)
                paddingLeft: '6mm',   // <-- MARGIN KIRI
                paddingRight: '6mm',  // <-- MARGIN KANAN
              }}
            >
              {/* Page number indicator for screen only */}
              <div className="absolute top-6 -left-12 no-print rotate-[-90deg]">
                 <Badge className="bg-slate-900 text-white font-black px-4 py-1 rounded-lg shadow-xl">PAGE {pageIdx + 1}</Badge>
              </div>

              {/* vvv SET JARAK ANTAR VOUCHER DISINI (gap-[5px]) vvv */}
              <div className={`print-voucher-grid grid ${gridCols === 5 ? 'grid-cols-5 gap-[5px]' : 'grid-cols-3 gap-4'}`}>
                {pageVouchers.map((v, i) => {
                  const pkg = packages.find(p => p.id === v.package_id);
                  const price = resellerPrices.find(p => p.voucher_package_id === v.package_id)?.retail_price || purchase.unit_price;

                  return (
                    <div key={v.id} className="w-full h-fit">
                      <TemplateComponent 
                        voucher={v as any}
                        index={i + (pageIdx * vouchersPerPage)}
                        pkg={{...pkg, price} as any}
                        headerTitle={headerTitle}
                        config={{
                          label: headerTitle,
                          dnsName: brandingSource === 'dns' ? selectedBrandingValue : '',
                          selectedDesignSlug: cardDesignMode
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Simplified Single Line Footer */}
              <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center opacity-40 px-2 text-[10px] font-black uppercase">
                <span>{tenant?.name}</span>
                <span>HALAMAN {pageIdx + 1} DARI {pages.length}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Global Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 0 !important; }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          .no-print, header, footer, nav, aside, button, [role="navigation"], .fixed, .sticky {
            display: none !important;
          }
          /* RESET PARENT GRID BIAR PAPER AREA FULL WIDTH SAAT PRINT */
          .print-layout-wrapper {
            display: block !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
          }
          .print-pages-flow { 
            display: block !important; 
            width: 210mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .a4-paper-sheet { 
            display: flex !important; 
            flex-direction: column !important;
            page-break-after: always !important; 
            page-break-inside: avoid !important;
            width: 210mm !important; 
            height: 297mm !important; 
            margin: 0 !important; 
            
            /* vvv SET MARGIN KERTAS (SAAT PRINT) DISINI vvv */
            padding-top: 4mm !important;    /* MARGIN ATAS */
            padding-bottom: 2mm !important; /* MARGIN BAWAH */
            padding-left: 6mm !important;   /* MARGIN KIRI */
            padding-right: 6mm !important;  /* MARGIN KANAN */
            
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-voucher-grid { 
            display: grid !important; 
            grid-template-columns: repeat(${gridCols}, 1fr) !important; 
            /* SET JARAK VOUCHER SAAT PRINT DISINI */
            gap: 5px !important; 
            width: 100% !important;
          }
        }
      `}} />
    </div>
  );
}

export default function AdminResellerPrintPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    }>
      <PrintPage />
    </Suspense>
  );
}
