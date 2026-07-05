"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { billingService } from "@/lib/api/billingService";
import { financeService } from "@/lib/api/financeService";
import { useAuth } from "@/lib/hooks/useAuth";
import type { Invoice, PaymentMethodAccount } from "@/lib/api/types";
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
  Building2,
  Phone,
  MapPin,
  UserCheck,
  CreditCard,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { HvsCompactTemplate } from "@/components/billing/templates/HvsCompactTemplate";
import { ThermalCompactTemplate } from "@/components/billing/templates/ThermalCompactTemplate";
import { CutSeparator } from "@/components/billing/templates/CutSeparator";
import { formatCurrency } from "@/components/billing/templates";

type BulkMode = "hvs" | "thermal";

export default function BulkPrintPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenant, user } = useAuth();

  // Parse invoice IDs from query param: ?ids=uuid1,uuid2,...
  const invoiceIds = (searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  // Payment accounts
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentMethodAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Template mode
  const [mode, setMode] = useState<BulkMode>("hvs");

  // Thermal paper size
  const [thermalSize, setThermalSize] = useState<"58mm" | "80mm" | "110mm">("80mm");

  // Customisation
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [signerName, setSignerName] = useState("");
  const [notes, setNotes] = useState("");
  const [footerMessage, setFooterMessage] = useState(
    "Simpan nota ini sebagai bukti pembayaran sah. Terima kasih!"
  );

  // Sync tenant/user info
  useEffect(() => {
    if (tenant) {
      setCompanyName(tenant.name || "");
      setCompanyAddress((tenant as any).address || "");
      setCompanyPhone((tenant as any).phone || "");
    }
    if (user) setSignerName(user.name || "");
  }, [tenant, user]);

  // Load invoices
  useEffect(() => {
    if (invoiceIds.length === 0) {
      setLoadingInvoices(false);
      return;
    }

    const fetchAll = async () => {
      setLoadingInvoices(true);
      const results: Invoice[] = [];
      const errs: string[] = [];

      await Promise.allSettled(
        invoiceIds.map(async (id) => {
          try {
            const inv = await billingService.getInvoice(id);
            results.push(inv);
          } catch {
            errs.push(id);
          }
        })
      );

      // Sort by invoice_number ascending for consistent ordering
      results.sort((a, b) => a.invoice_number.localeCompare(b.invoice_number));

      setInvoices(results);
      setErrors(errs);
      setLoadingInvoices(false);
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load payment accounts
  useEffect(() => {
    const fetch = async () => {
      try {
        setLoadingAccounts(true);
        const data = await financeService.getPaymentMethods();
        const active = data.filter((a) => a.is_active);
        setPaymentAccounts(active);
        if (active.length > 0) setSelectedAccountId(active[0].id);
      } catch {
        // silent
      } finally {
        setLoadingAccounts(false);
      }
    };
    fetch();
  }, []);

  const selectedAccount = paymentAccounts.find((a) => a.id === selectedAccountId);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const templateProps = useCallback(
    (invoice: Invoice) => ({
      invoice,
      companyName,
      companyAddress,
      companyPhone,
      notes,
      footerMessage,
      signerName,
      selectedAccount,
      formatCurrency,
    }),
    [companyName, companyAddress, companyPhone, notes, footerMessage, signerName, selectedAccount]
  );

  // Summary for header
  const totalAmount = invoices.reduce((s, inv) => s + inv.total_amount, 0);
  const unpaidCount = invoices.filter(
    (inv) => inv.status === "pending" || inv.status === "overdue"
  ).length;

  return (
    <div className="bulk-print-root min-h-screen bg-slate-100/50 pb-20">
      {/* Sticky header — no print */}
      <div className="no-print bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-[100] shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-black text-slate-900 text-lg tracking-tight">
                  Cetak Massal Nota
                </h1>
                <span className="bg-indigo-100 text-indigo-700 font-bold text-xs uppercase px-2 py-0.5 rounded">
                  {invoices.length} Invoice
                </span>
                {unpaidCount > 0 && (
                  <span className="bg-rose-100 text-rose-700 font-bold text-xs uppercase px-2 py-0.5 rounded">
                    {unpaidCount} Belum Bayar
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                Total: {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 h-11 gap-2 shadow-md shadow-indigo-100 rounded-2xl px-6 font-black transition-all text-white"
            >
              <Printer className="w-4 h-4" />
              Cetak Semua ({invoices.length})
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 print-layout-wrapper">
        {/* Left: Settings panel — no print */}
        <div className="no-print lg:col-span-4 space-y-6">
          <Card className="rounded-3xl border-none shadow-lg overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <Layers className="w-5 h-5 text-indigo-400" />
                Pengaturan Cetak Massal
              </CardTitle>
              <CardDescription className="text-slate-400 font-medium">
                Kustomisasi header dan pilih format cetak.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Mode */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Format Cetak
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: "hvs" as const,
                        icon: FileText,
                        label: "HVS (A4)",
                        desc: "Multi-nota per halaman A4",
                      },
                      {
                        id: "thermal" as const,
                        icon: Receipt,
                        label: "Thermal",
                        desc: "Rol panjang 80mm",
                      },
                    ] as const
                  ).map(({ id, icon: Icon, label, desc }) => (
                    <button
                      key={id}
                      onClick={() => setMode(id)}
                      className={`flex flex-col items-start text-left p-3.5 rounded-2xl border-2 transition-all gap-2 ${
                        mode === id
                          ? "border-indigo-600 bg-indigo-50/50 shadow-sm"
                          : "border-slate-100 hover:border-slate-200 bg-slate-50/30"
                      }`}
                    >
                      <div
                        className={`p-2 rounded-xl ${
                          mode === id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4
                          className={`text-xs font-black uppercase tracking-tight ${
                            mode === id ? "text-indigo-700" : "text-slate-700"
                          }`}
                        >
                          {label}
                        </h4>
                        <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Thermal Paper Size — only visible when thermal mode is selected */}
              {mode === "thermal" && (
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

              {/* Company */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Identitas Perusahaan
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-655 font-medium">Nama Perusahaan</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="pl-9 text-slate-900 border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-655 font-medium">Nomor Telepon</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        className="pl-9 text-slate-900 border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-655 font-medium">Alamat</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Textarea
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        rows={2}
                        className="pl-9 text-slate-900 border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Signer */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-indigo-500" /> Petugas / Kasir
                </Label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="text-slate-900 border-slate-200 rounded-xl"
                />
              </div>

              {/* Bank account (HVS only) */}
              {mode === "hvs" && (
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-indigo-500" /> Rekening Pembayaran
                  </Label>
                  {loadingAccounts ? (
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <LoadingSpinner size={12} /> Loading...
                    </div>
                  ) : paymentAccounts.length > 0 ? (
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white"
                    >
                      <option value="">-- Tidak Tampilkan --</option>
                      {paymentAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.provider} - {acc.account_number})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      Tidak ada rekening aktif.
                    </p>
                  )}
                </div>
              )}

              {/* Notes / Footer */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Catatan
                </h3>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-655 font-medium">Catatan Nota</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Misal: Harap konfirmasi setelah transfer."
                    className="text-slate-900 border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-655 font-medium">Pesan Kaki Nota</Label>
                  <Input
                    value={footerMessage}
                    onChange={(e) => setFooterMessage(e.target.value)}
                    className="text-slate-900 border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Error list */}
              {errors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase mb-1">
                    <AlertCircle className="w-4 h-4" /> Gagal dimuat ({errors.length})
                  </div>
                  {errors.map((id) => (
                    <p key={id} className="text-[10px] font-mono text-rose-600 truncate">
                      {id}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-8 flex flex-col items-center gap-4 pt-4 bg-slate-200/40 rounded-3xl p-6 sm:p-10 shadow-inner border border-slate-200/50 print-area-container">
          <div className="flex items-center justify-between no-print w-full max-w-[210mm]">
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Live Preview — {invoices.length} Nota
            </span>
            <span className="text-xs font-bold text-slate-500 uppercase">
              {mode === "hvs" ? "Format HVS A4" : "Format Thermal 80mm"}
            </span>
          </div>

          {loadingInvoices ? (
            <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
              <LoadingSpinner size={40} />
              <p className="text-sm font-bold">Memuat {invoiceIds.length} invoice...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="font-bold text-lg">Tidak ada invoice yang berhasil dimuat.</p>
              <p className="text-sm mt-1 text-slate-400">
                Pastikan URL berisi parameter <code>?ids=...</code> yang valid.
              </p>
            </div>
          ) : mode === "hvs" ? (
            /* HVS: Render actual discrete A4 sheets, exactly 2 invoices per page */
            <div className="flex flex-col gap-8 items-center w-full print:gap-0 print:bg-transparent">
              {(() => {
                const chunks: Invoice[][] = [];
                for (let i = 0; i < invoices.length; i += 2) {
                  chunks.push(invoices.slice(i, i + 2));
                }
                return chunks.map((chunk, pageIdx) => (
                  <div
                    key={pageIdx}
                    className="a4-page-sheet bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] print:shadow-none border border-slate-200 print:border-none flex flex-col justify-between"
                    style={{
                      width: "210mm",
                      height: "297mm",
                      padding: "15mm 12mm",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <HvsCompactTemplate {...templateProps(chunk[0])} />
                    </div>
                    {chunk.length > 1 ? (
                      <>
                        <CutSeparator />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <HvsCompactTemplate {...templateProps(chunk[1])} />
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1 }} />
                    )}
                  </div>
                ));
              })()}
            </div>
          ) : (
            /* Thermal: 80mm roll, each invoice separated by cut line */
            <div
              className="print-preview-wrapper shadow-[0_20px_50px_rgba(0,0,0,0.15)] bg-white"
              style={{ width: thermalSize, padding: "5mm 4mm", boxSizing: "border-box" }}
            >
              {invoices.map((inv, i) => (
                <div key={inv.id} className="thermal-invoice-block">
                  <ThermalCompactTemplate {...templateProps(inv)} />
                  {i < invoices.length - 1 && <CutSeparator label="✂ Potong" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Print CSS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              size: ${mode === "thermal" ? thermalSize + " auto" : "A4 portrait"};
              margin: 0 !important;
            }

            /* Hide all non-printable UI elements and clear sizing limitations */
            html, body, #__next, main, .bulk-print-root {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              background: white !important;
              font-size: 10pt;
              padding: 0 !important;
              margin: 0 !important;
            }

            .no-print, header, footer, nav, aside, button,
            [role="navigation"], .fixed, .sticky {
              display: none !important;
            }

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

            /* Use width:100% — fills printable area of the 58mm paper declared in @page */
            .print-preview-wrapper {
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              width: 100% !important;
              padding: 4mm 3mm !important;
              margin: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .a4-page-sheet {
              background: white !important;
              box-shadow: none !important;
              border: none !important;
              width: 210mm !important;
              height: 297mm !important;
              padding: 15mm 12mm !important;
              margin: 0 auto !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              break-after: page !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
            }

            /* Prevent extra page break on the last sheet of the print output */
            .a4-page-sheet:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }

            /* Cut separator stays visible on print */
            .cut-separator {
              display: flex !important;
            }

            /* Thermal: no page breaks */
            .thermal-invoice-block {
              break-inside: avoid;
            }
          }
        `,
        }}
      />
    </div>
  );
}
