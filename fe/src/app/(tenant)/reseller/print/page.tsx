'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import resellerService from '@/lib/api/resellerService';
import { voucherService } from '@/lib/api/voucherService';
import { ResellerPurchase, Voucher, VoucherPackage, ResellerPrice } from '@/lib/api/types';
import { ArrowLeft, Printer, Ticket, Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useNetworkStore } from '@/stores/networkStore';

function PrintPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const purchaseId = searchParams.get('purchase_id');

  const [purchase, setPurchase] = useState<ResellerPurchase | null>(null);
  const [packages, setPackages] = useState<VoucherPackage[]>([]);
  const [resellerPrices, setResellerPrices] = useState<ResellerPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardMode, setCardMode] = useState<'simple' | 'branded' | 'mikhmon'>('simple');
  const { tenant } = useAuth();
  const { routers, fetchRouters } = useNetworkStore();

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
        resellerService.getGlobalPrices() // Admins use global prices
      ]);

      if (routers.length === 0) {
        await fetchRouters();
      }

      setPurchase(purchaseData);
      setPackages(packagesData);
      setResellerPrices(pricesData);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('voucher-print-area');
    if (!element) return;

    try {
      setIsDownloading(true);
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      
      const dataUrl = await toPng(element, { 
        quality: 1.0, 
        pixelRatio: 2,
        backgroundColor: '#f8fafc' 
      });
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'cm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth() - 1.4; // 0.7cm margins
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      const price = resellerPrices.find(p => p.voucher_package_id === purchase?.vouchers?.[0]?.package_id)?.retail_price || purchase?.unit_price || 0;
      const pkg = (purchase?.voucher_package_name || 'Voucher').toLowerCase().replace(/\s+/g, '-');
      const now = new Date();
      const ts = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
      
      pdf.addImage(dataUrl, 'PNG', 0.7, 0.7, pdfWidth, pdfHeight);
      pdf.save(`voucher-${pkg}-${price}-${ts}.pdf`);
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
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="font-bold text-sm">Memuat data voucher...</p>
        </div>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <Ticket className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="font-black text-slate-800 text-xl">Tidak Dapat Memuat</h2>
          <p className="text-slate-500 text-sm">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all text-sm"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const vouchers: Voucher[] = purchase.vouchers || [];
  const pkgName = purchase.voucher_package_name || 'Voucher';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="no-print bg-white border-b border-slate-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-bold text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <h1 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Ticket className="w-4 h-4 text-indigo-600" /> Cetak Voucher (Admin)
              </h1>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-tight">
                {purchase.reseller_name || 'Reseller'} &bull; {pkgName} &bull; {vouchers.length} voucher
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Template:</span>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setCardMode('simple')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  cardMode === 'simple' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Simple
              </button>
              <button
                onClick={() => setCardMode('branded')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  cardMode === 'branded' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Branded
              </button>
              <button
                onClick={() => setCardMode('mikhmon')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  cardMode === 'mikhmon' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Mikhmon
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={vouchers.length === 0 || isDownloading}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-indigo-600 border border-indigo-200 rounded-2xl font-black hover:bg-slate-50 transition-all text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              disabled={vouchers.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all text-sm shadow-md shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" /> Print {vouchers.length} Voucher
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div 
          id="voucher-print-area" 
          className={`print-voucher-grid grid gap-4 ${
            cardMode === 'mikhmon' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3'
          }`}
          data-mode={cardMode}
        >
          {(() => {
            const uniqueRouterIds = new Set(vouchers.map(v => v.router_id).filter(Boolean));
            const uniqueDnsNames = new Set(
              vouchers
                .map(v => routers.find(r => r.id === v.router_id)?.dns_name)
                .filter(Boolean)
            );
            const useOrgName = uniqueRouterIds.size > 1 || uniqueDnsNames.size > 1;
            const orgName = tenant?.name || "WIFI VOUCHER";

            return vouchers.map((v, idx) => {
              const pkg = packages.find(p => p.id === v.package_id);
              const router = routers.find(r => r.id === v.router_id);
              const displayDns = useOrgName ? orgName : (router?.dns_name || "hotspot.net");
              const price = resellerPrices.find(p => p.voucher_package_id === v.package_id)?.retail_price || purchase.unit_price;

              if (cardMode === 'simple') {
                return (
                  <div key={v.id || idx} className="print-card border-2 border-dashed border-slate-300 rounded-xl p-4 bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">#{String(idx + 1).padStart(3, '0')}</span>
                      <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">{pkgName}</span>
                    </div>
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Username</span>
                        <span className="font-mono font-black text-slate-900">{v.code}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Password</span>
                        <span className="font-mono font-black text-slate-900">{v.password || v.code}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Harga</span>
                        <span className="font-black text-emerald-600">Rp {price.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Aktif</span>
                        <span className="font-black text-slate-700">{pkg?.duration_hours ? `${pkg.duration_hours} Jam` : 'Unlimited'}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (cardMode === 'branded') {
                return (
                  <div key={v.id || idx} className="print-card border-2 border-dashed border-indigo-200 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 shadow-sm">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-white flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-3.5 h-3.5" />
                        <span className="font-black text-xs">WIFI VOUCHER</span>
                      </div>
                      <span className="text-[10px] font-bold opacity-70">#{String(idx + 1).padStart(3, '0')}</span>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="text-center">
                        <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-3 py-0.5 rounded-full">{pkgName}</span>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 border border-indigo-100 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Username</span>
                          <span className="font-mono font-black text-indigo-700">{v.code}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Password</span>
                          <span className="font-mono font-black text-purple-700">{v.password || v.code}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-indigo-50">
                          <span className="text-slate-400 font-medium">Harga</span>
                          <span className="font-black text-emerald-600">Rp {price.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Aktif</span>
                          <span className="font-black text-slate-700">{pkg?.duration_hours ? `${pkg.duration_hours} Jam` : 'Unlimited'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Mikhmon Mode
              return (
                <div key={v.id || idx} className="print-card bg-white border-2 border-black p-2 text-[10px] font-bold text-black w-full max-w-[160px] uppercase shadow-sm min-h-[100px] flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center border-b-2 border-black pb-1 mb-1.5 px-1">
                      <span className="truncate max-w-[90px] font-bold normal-case">{displayDns}</span>
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
                    {pkg?.duration_hours ? `${pkg.duration_hours}j` : '∞'} Rp {price ? `${(price / 1000).toFixed(0)}rb` : '0'}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-voucher-grid, .print-voucher-grid * { visibility: visible !important; }
          .print-voucher-grid {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: grid !important;
            grid-template-columns: var(--grid-cols, repeat(3, 1fr)) !important;
            gap: 8px !important;
          }
          
          .print-voucher-grid[data-mode="mikhmon"] {
            --grid-cols: repeat(5, 1fr);
          }
          
          .print-voucher-grid[data-mode="branded"],
          .print-voucher-grid[data-mode="simple"] {
            --grid-cols: repeat(3, 1fr);
          }
          .print-card { page-break-inside: avoid !important; break-inside: avoid !important; padding: 8px !important; }
          @page { size: A4 portrait; margin: 0.7cm; }
        }
      `}} />
    </div>
  );
}

export default function AdminResellerPrintPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    }>
      <PrintPage />
    </Suspense>
  );
}
