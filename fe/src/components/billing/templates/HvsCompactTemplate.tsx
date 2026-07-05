import React from "react";
import type { InvoiceTemplateProps } from "./types";
import { getIndonesianMonthYear } from "./utils";
import { format } from "date-fns";

/**
 * HvsCompactTemplate — designed for bulk printing.
 * Renders a smaller, half-A4 invoice. The bulk print page
 * stacks multiple of these with CutSeparator between each.
 */
export function HvsCompactTemplate({
  invoice,
  companyName,
  companyAddress,
  companyPhone,
  notes,
  signerName,
  selectedAccount,
  formatCurrency,
}: InvoiceTemplateProps) {
  return (
    <div
      className="hvs-compact-invoice bg-white text-slate-900 font-sans"
      style={{ width: "100%", boxSizing: "border-box" }}
    >
      {/* Header row */}
      <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-3">
        <div className="text-left space-y-0.5 max-w-[55%]">
          <h2 className="text-base font-black uppercase text-indigo-700 tracking-tight leading-tight">
            {companyName}
          </h2>
          <p className="text-[9px] text-slate-500 leading-relaxed whitespace-pre-line">
            {companyAddress}
          </p>
          <p className="text-[9px] text-slate-500">Telp: {companyPhone}</p>
        </div>
        <div className="text-right space-y-0.5">
          <h1 className="text-xl font-black text-slate-900 uppercase">INVOICE</h1>
          <p className="text-[9px] text-slate-400 uppercase font-bold">Nota Penagihan</p>
          <p className="text-[9px] font-mono font-bold text-slate-700 mt-1">
            {invoice.invoice_number}
          </p>
          <p className="text-[9px] text-slate-500">
            Tgl: {format(new Date(invoice.created_at), "dd/MM/yyyy")}
          </p>
          <p className="text-[9px] text-rose-600 font-bold">
            Tempo: {format(new Date(invoice.due_date), "dd/MM/yyyy")}
          </p>
        </div>
      </div>

      {/* Client + Billing info */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-[9px]">
        <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg text-left">
          <p className="font-bold text-[8px] text-slate-400 uppercase tracking-wider mb-1">
            Ditagihkan Kepada:
          </p>
          <p className="font-black text-slate-900 text-xs">
            {invoice.client_name || "—"}
          </p>
          {invoice.client_phone && (
            <p className="text-slate-500 mt-0.5">HP: {invoice.client_phone}</p>
          )}
        </div>
        <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg text-left">
          <p className="font-bold text-[8px] text-slate-400 uppercase tracking-wider mb-1">
            Detail:
          </p>
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Periode:</span>
              <span className="font-bold text-slate-800">
                {getIndonesianMonthYear(invoice.period_start)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Grup:</span>
              <span className="text-slate-700">{invoice.client_group_name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span
                className={`font-black text-xs ${
                  invoice.status === "paid"
                    ? "text-emerald-600"
                    : invoice.status === "cancelled"
                    ? "text-slate-400"
                    : "text-rose-600"
                }`}
              >
                {invoice.status === "paid"
                  ? "LUNAS"
                  : invoice.status === "cancelled"
                  ? "BATAL"
                  : "BELUM BAYAR"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <table className="w-full text-left text-[9px] border-collapse mb-3">
        <thead>
          <tr className="border-b border-t border-slate-200 text-[8px] font-bold text-slate-400 uppercase tracking-wide">
            <th className="py-1.5 px-1 w-7 text-center">#</th>
            <th className="py-1.5 px-1">Deskripsi</th>
            <th className="py-1.5 px-1 w-8 text-center">Qty</th>
            <th className="py-1.5 px-1 w-24 text-right">Harga</th>
            <th className="py-1.5 px-1 w-24 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {invoice.items && invoice.items.length > 0 ? (
            invoice.items.map((item, idx) => (
              <tr key={item.id || idx} className="text-slate-800">
                <td className="py-1 px-1 text-center">{idx + 1}</td>
                <td className="py-1 px-1 font-semibold">{item.description}</td>
                <td className="py-1 px-1 text-center">{item.quantity}</td>
                <td className="py-1 px-1 text-right">{formatCurrency(item.unit_price)}</td>
                <td className="py-1 px-1 text-right font-bold">{formatCurrency(item.amount)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="py-2 text-center text-slate-400 italic">
                Tidak ada item
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer: bank + total + signature */}
      <div className="grid grid-cols-12 gap-3 border-t border-slate-200 pt-3">
        <div className="col-span-7 space-y-2 text-[9px] text-left">
          {selectedAccount && (
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <p className="font-bold text-[8px] text-slate-400 uppercase tracking-wider mb-1">
                Transfer ke:
              </p>
              <p className="font-bold text-indigo-700 uppercase text-[9px]">
                {selectedAccount.provider} · {selectedAccount.name}
              </p>
              <p className="font-mono font-black text-slate-900 text-[10px]">
                {selectedAccount.account_number}
              </p>
              {selectedAccount.account_name && (
                <p className="text-slate-500">a/n {selectedAccount.account_name}</p>
              )}
            </div>
          )}
          {notes && (
            <p className="text-slate-500 italic text-[8px] leading-relaxed">Catatan: {notes}</p>
          )}
          <div className="text-center mt-3 pt-2">
            <div className="h-8" />
            <p className="font-bold text-[9px] text-slate-800 border-t border-slate-300 pt-1 inline-block min-w-[80px]">
              {signerName}
            </p>
          </div>
        </div>

        <div className="col-span-5 text-[9px] text-right space-y-1">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          {invoice.tax_amount > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>PPN</span>
              <span>{formatCurrency(invoice.tax_amount)}</span>
            </div>
          )}
          {invoice.discount_amount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Diskon</span>
              <span>-{formatCurrency(invoice.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-300 pt-2 text-xs font-black text-slate-900 mt-1">
            <span>TOTAL</span>
            <span className="text-indigo-700">{formatCurrency(invoice.total_amount)}</span>
          </div>
          {invoice.paid_amount > 0 && (
            <div className="flex justify-between text-emerald-600 font-bold text-[9px]">
              <span>Terbayar</span>
              <span>{formatCurrency(invoice.paid_amount)}</span>
            </div>
          )}
          {invoice.total_amount - invoice.paid_amount > 0 && (
            <div className="flex justify-between text-rose-600 font-black border-t border-dashed border-slate-200 pt-1.5 text-[9px]">
              <span>Sisa Tagihan</span>
              <span>{formatCurrency(invoice.total_amount - invoice.paid_amount)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
