import React from "react";
import type { InvoiceTemplateProps } from "./types";
import { getIndonesianMonthYear } from "./utils";
import { format } from "date-fns";

/**
 * ThermalCompactTemplate — designed for bulk thermal printing.
 * Renders a single struk invoice without outer padding/margin,
 * to be stacked vertically on a continuous roll with CutSeparator between each.
 */
export function ThermalCompactTemplate({
  invoice,
  companyName,
  companyAddress,
  companyPhone,
  notes,
  footerMessage,
  formatCurrency,
}: InvoiceTemplateProps) {
  return (
    <div
      className="thermal-compact-invoice bg-white text-slate-900 font-mono"
      style={{ width: "100%", boxSizing: "border-box" }}
    >
      {/* Company Header */}
      <div className="text-center space-y-0.5">
        <h2 className="text-sm font-black uppercase tracking-tight">{companyName}</h2>
        <p className="text-[9px] leading-relaxed">{companyAddress}</p>
        <p className="text-[9px]">Telp: {companyPhone}</p>
      </div>

      <div className="border-t border-dashed border-slate-400 my-2" />

      {/* Invoice header */}
      <div className="text-center space-y-0.5">
        <h3 className="text-[11px] font-bold uppercase">NOTA PENAGIHAN</h3>
        <p className="text-[9px] font-bold text-slate-500">{invoice.invoice_number}</p>
      </div>

      {/* Details */}
      <div className="text-[9px] space-y-0.5 mt-2 text-left">
        <div className="flex justify-between">
          <span className="text-slate-500">Tanggal</span>
          <span>{format(new Date(invoice.created_at), "dd/MM/yy HH:mm")}</span>
        </div>
        <div className="flex justify-between text-rose-600">
          <span>Tempo</span>
          <span>{format(new Date(invoice.due_date), "dd/MM/yy")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Client</span>
          <span className="font-bold max-w-[60%] truncate text-right">
            {invoice.client_name || invoice.client_id}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Periode</span>
          <span className="font-bold">{getIndonesianMonthYear(invoice.period_start)}</span>
        </div>
        {invoice.client_group_name && (
          <div className="flex justify-between">
            <span className="text-slate-500">Grup</span>
            <span>{invoice.client_group_name}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-slate-400 my-2" />

      {/* Items */}
      <div className="space-y-1.5 text-[9px] text-left">
        {invoice.items && invoice.items.length > 0 ? (
          invoice.items.map((item, idx) => (
            <div key={item.id || idx}>
              <div className="font-bold text-slate-900 leading-tight">{item.description}</div>
              <div className="flex justify-between text-slate-500 mt-0.5">
                <span>
                  {item.quantity} x {formatCurrency(item.unit_price)}
                </span>
                <span className="font-bold text-slate-900">{formatCurrency(item.amount)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-slate-400 italic">Tidak ada item</div>
        )}
      </div>

      <div className="border-t border-dashed border-slate-400 my-2" />

      {/* Totals */}
      <div className="text-[9px] space-y-0.5">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <span>{formatCurrency(invoice.subtotal)}</span>
        </div>
        {invoice.tax_amount > 0 && (
          <div className="flex justify-between text-slate-600">
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
        <div className="flex justify-between font-black text-[11px] text-slate-950 border-t border-dashed border-slate-300 pt-1 mt-0.5">
          <span>TOTAL</span>
          <span>{formatCurrency(invoice.total_amount)}</span>
        </div>
        {invoice.paid_amount > 0 && (
          <div className="flex justify-between text-emerald-600 font-bold text-[9px]">
            <span>TERBAYAR</span>
            <span>{formatCurrency(invoice.paid_amount)}</span>
          </div>
        )}
        {invoice.total_amount - invoice.paid_amount > 0 && (
          <div className="flex justify-between text-rose-600 font-black border-t border-dotted border-slate-300 pt-1 text-[9px]">
            <span>SISA</span>
            <span>{formatCurrency(invoice.total_amount - invoice.paid_amount)}</span>
          </div>
        )}
      </div>

      {/* Status stamp */}
      <div className="text-center font-black border border-slate-800 px-2 py-0.5 mx-auto my-2 w-fit rounded uppercase text-[11px] rotate-[-2deg]">
        {invoice.status === "paid" ? (
          <span className="text-emerald-700">L U N A S</span>
        ) : invoice.status === "cancelled" ? (
          <span className="text-slate-400">B A T A L</span>
        ) : (
          <span className="text-rose-700">BELUM LUNAS</span>
        )}
      </div>

      {/* Custom Notes */}
      {notes && (
        <p className="text-[8px] text-slate-500 italic text-center mt-1 leading-relaxed">
          {notes}
        </p>
      )}

      {/* Footer */}
      {footerMessage && (
        <p className="text-[8px] text-center text-slate-500 mt-1 leading-relaxed">
          {footerMessage}
        </p>
      )}
    </div>
  );
}
