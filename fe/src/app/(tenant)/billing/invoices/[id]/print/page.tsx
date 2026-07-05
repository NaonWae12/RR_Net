"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBillingStore } from "@/stores/billingStore";
import { financeService } from "@/lib/api/financeService";
import { useAuth } from "@/lib/hooks/useAuth";
import type { PaymentMethodAccount } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Printer, 
  FileText, 
  Receipt, 
  Layout,
  Building2, 
  MapPin, 
  Phone, 
  UserCheck, 
  CreditCard,
  CheckCircle2
} from "lucide-react";
import { INVOICE_TEMPLATES, formatCurrency } from "@/components/billing/templates";

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { invoice, loading, error, fetchInvoice, clearInvoice } = useBillingStore();
  const { tenant, user } = useAuth();

  // Selected Template ID
  const [templateId, setTemplateId] = useState<string>("hvs");

  // Thermal paper size
  const [thermalSize, setThermalSize] = useState<"58mm" | "80mm" | "110mm">("80mm");

  // Customization States
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [signerName, setSignerName] = useState("");
  const [notes, setNotes] = useState("");
  const [footerMessage, setFooterMessage] = useState("Simpan nota ini sebagai bukti pembayaran sah. Terima kasih!");
  
  // Payment Accounts State
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentMethodAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Initialize invoice
  useEffect(() => {
    if (id) {
      fetchInvoice(id);
    }
    return () => {
      clearInvoice();
    };
  }, [id, fetchInvoice, clearInvoice]);

  // Sync basic tenant and user info
  useEffect(() => {
    if (tenant) {
      setCompanyName(tenant.name || "RR_Net Hotspot");
      setCompanyAddress((tenant as any).address || "Jl. Raya Utama No. 123");
      setCompanyPhone((tenant as any).phone || "0812-3456-7890");
    }
    if (user) {
      setSignerName(user.name || "Petugas Finance");
    }
  }, [tenant, user]);

  // Sync notes from invoice
  useEffect(() => {
    if (invoice) {
      setNotes(invoice.notes || "");
    }
  }, [invoice]);

  // Fetch active payment accounts for bank details selection
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoadingAccounts(true);
        const data = await financeService.getPaymentMethods();
        const activeAccounts = data.filter(acc => acc.is_active);
        setPaymentAccounts(activeAccounts);
        if (activeAccounts.length > 0) {
          setSelectedAccountId(activeAccounts[0].id);
        }
      } catch (err) {
        console.error("Failed to load payment accounts", err);
      } finally {
        setLoadingAccounts(false);
      }
    };
    fetchAccounts();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <LoadingSpinner size={40} />
          <p className="font-bold text-sm">Memuat data invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4 max-w-md p-8 bg-white rounded-3xl shadow-xl border border-slate-100">
          <h2 className="font-black text-slate-900 text-2xl tracking-tight">Oops! Terjadi Kesalahan</h2>
          <p className="text-slate-500 font-medium leading-relaxed">{error || "Invoice tidak ditemukan."}</p>
          <Button onClick={() => router.back()} className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-black transition-all font-bold text-white">
            Kembali
          </Button>
        </div>
      </div>
    );
  }

  // Get active template config and component
  const activeTemplateObj = INVOICE_TEMPLATES[templateId] || INVOICE_TEMPLATES.hvs;
  const TemplateComponent = activeTemplateObj.component;
  const settings = activeTemplateObj.definition.settings;
  const selectedAccount = paymentAccounts.find(acc => acc.id === selectedAccountId);

  return (
    <div className="print-root min-h-screen bg-slate-100/50 pb-20">
      {/* Header Sticky - No Print */}
      <div className="no-print bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-[100] shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-slate-900 text-lg tracking-tight">Cetak Nota Penagihan</h1>
                <span className="bg-indigo-100 text-indigo-700 font-bold text-xs uppercase px-2 py-0.5 rounded">
                  {invoice.invoice_number}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                Client: {invoice.client_name || invoice.client_id} &bull; Total: {formatCurrency(invoice.total_amount)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button 
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 h-11 gap-2 shadow-md shadow-indigo-100 rounded-2xl px-6 font-black transition-all text-white"
            >
              <Printer className="w-4 h-4" />
              Cetak Sekarang
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 print-layout-wrapper">
        {/* Left Panel: Settings (No Print) */}
        <div className="no-print lg:col-span-4 space-y-6">
          <Card className="rounded-3xl border-none shadow-lg overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="flex items-center gap-2 text-lg font-black font-outfit">
                Pengaturan Nota
              </CardTitle>
              <CardDescription className="text-slate-400 font-medium">Pilih template dan kustomisasi isinya.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Template Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Layout className="w-3.5 h-3.5 text-indigo-500" /> Desain Nota:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.values(INVOICE_TEMPLATES).map((tmpl) => {
                    const isSelected = templateId === tmpl.definition.id;
                    const IconComp = tmpl.definition.icon === "receipt" 
                      ? Receipt 
                      : tmpl.definition.icon === "file-text"
                      ? FileText
                      : Layout;

                    return (
                      <button
                        key={tmpl.definition.id}
                        onClick={() => setTemplateId(tmpl.definition.id)}
                        className={`flex items-start text-left p-3.5 rounded-2xl border-2 transition-all gap-3 ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                            : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                        }`}
                      >
                        <div className={`p-2 rounded-xl mt-0.5 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-xs font-black uppercase tracking-tight ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {tmpl.definition.name}
                          </h4>
                          <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed">
                            {tmpl.definition.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Thermal Paper Size — only visible when thermal template is selected */}
              {templateId === "thermal" && (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-indigo-500" /> Ukuran Kertas Thermal
                  </Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["58mm", "80mm", "110mm"] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setThermalSize(size)}
                        className={`py-2 rounded-xl border-2 text-xs font-black transition-all ${
                          thermalSize === size
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                            : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Identitas Perusahaan</h3>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-655 font-medium">Nama Perusahaan / Toko</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="pl-9 text-slate-900 border-slate-200 focus:border-indigo-500 rounded-xl"
                      />
                    </div>
                  </div>

                  {settings.showPhone && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-655 font-medium">Nomor Telepon</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          className="pl-9 text-slate-900 border-slate-200 focus:border-indigo-500 rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {settings.showAddress && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-655 font-medium">Alamat</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Textarea
                          value={companyAddress}
                          onChange={(e) => setCompanyAddress(e.target.value)}
                          rows={2}
                          className="pl-9 text-slate-900 border-slate-200 focus:border-indigo-500 rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Bank Details Select (conditional) */}
              {settings.showBankSelection && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-indigo-500" /> Rekening Pembayaran
                  </h3>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-655 font-medium">Pilih Rekening Bank yang Ditampilkan</Label>
                    {loadingAccounts ? (
                      <div className="text-xs text-slate-500 flex items-center gap-1"><LoadingSpinner size={12} /> Loading accounts...</div>
                    ) : paymentAccounts.length > 0 ? (
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">-- Tidak Tampilkan Rekening --</option>
                        {paymentAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.provider} - {acc.account_number})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        Tidak ada rekening aktif yang ditemukan. Tambahkan di tab Setup & Templates.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Signer Customization (conditional) */}
              {settings.showSigner && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-500" /> Tanda Tangan
                  </h3>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-655 font-medium">Nama Penanggung Jawab / Kasir</Label>
                    <Input
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      className="text-slate-900 border-slate-200 focus:border-indigo-500 rounded-xl"
                    />
                  </div>
                </div>
              )}

              {/* Custom Notes & Footer Msg (conditional) */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Catatan Tambahan</h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-655 font-medium">Catatan Khusus Nota</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Misal: Harap lakukan konfirmasi setelah transfer."
                      className="text-slate-900 border-slate-200 focus:border-indigo-500 rounded-xl"
                    />
                  </div>
                  {settings.showFooterMsg && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-655 font-medium">Pesan Kaki Nota (Footer)</Label>
                      <Input
                        value={footerMessage}
                        onChange={(e) => setFooterMessage(e.target.value)}
                        className="text-slate-900 border-slate-200 focus:border-indigo-500 rounded-xl"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Preview Area */}
        <div className="lg:col-span-8 flex flex-col items-center gap-6 pt-4 bg-slate-200/40 rounded-3xl p-6 sm:p-10 shadow-inner border border-slate-200/50 print-area-container">
          <div className="flex items-center justify-between no-print w-full max-w-[210mm]">
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Live Preview
            </span>
            <span className="text-xs font-bold text-slate-500 uppercase">
              Format: {activeTemplateObj.definition.name}
            </span>
          </div>

          <div 
            className="print-preview-wrapper shadow-[0_20px_50px_rgba(0,0,0,0.15)] bg-white"
            style={templateId === "thermal" ? { width: thermalSize } : undefined}
          >
            <TemplateComponent
              invoice={invoice}
              companyName={companyName}
              companyAddress={companyAddress}
              companyPhone={companyPhone}
              notes={notes}
              footerMessage={footerMessage}
              signerName={signerName}
              selectedAccount={selectedAccount}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>
      </div>

      {/* Global CSS Style tag for Printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { 
            size: ${templateId === "thermal" ? thermalSize + " auto" : "A4 portrait"}; 
            /* [THERMAL MARGIN 1] Margin halaman — ubah angka ini (mis: 2mm, 5mm) jika kiri/kanan terpotong */
            margin: 0 !important; 
          }
          
          /* Hide all non-printable UI elements and clear sizing limitations */
          html, body, #__next, main, .print-root {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: white !important;
            color: black !important;
            font-size: 12pt;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .no-print, header, footer, nav, aside, button, [role="navigation"], .fixed, .sticky {
            display: none !important;
          }
          
          /* Full width layout for print container */
          .print-layout-wrapper {
            display: block !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
          }
          
          .print-area-container {
            display: block !important;
            padding: 0 !important;
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
          
          .print-preview-wrapper {
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Layout structure for A4/Simple Sheet print */
          .a4-sheet {
            display: block !important;
            width: 210mm !important;
            min-height: ${templateId === "simple" ? "148mm" : "297mm"} !important;
            margin: 0 auto !important;
            padding: ${templateId === "simple" ? "10mm 12mm" : "20mm 15mm 15mm 15mm"} !important;
            box-shadow: none !important;
            border: ${templateId === "simple" ? "1px solid black" : "none"} !important;
            background: white !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Prevent extra page break on the last sheet of the print output */
          .a4-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Layout structure for Thermal Receipt print */
          .thermal-sheet {
            display: block !important;
            /* [THERMAL MARGIN 2] width:100% = isi printable area otomatis sesuai @page size di atas */
            /* Ganti ke fixed mm (mis: 52mm) jika ingin lebih sempit dari kertas */
            width: 100% !important;
            /* [THERMAL MARGIN 3] Margin luar blok konten */
            margin: 0 !important;
            /* [THERMAL MARGIN 4] Padding dalam nota — format: atas/bawah kiri/kanan */
            /* Kurangi kiri/kanan (mis: 1mm) jika konten masih terpotong */
            padding: 4mm 3mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            box-sizing: border-box !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
    </div>
  );
}
