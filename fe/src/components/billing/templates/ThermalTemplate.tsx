import React from "react";
import type { InvoiceTemplateProps } from "./types";
import { getIndonesianMonthYear } from "./utils";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";

export function ThermalTemplate({
  invoice,
  companyName,
  companyAddress,
  companyPhone,
  notes,
  footerMessage,
  formatCurrency,
}: InvoiceTemplateProps) {
  const qrUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/portal/billing/${invoice.id}`
    : `https://rrnet.net/portal/billing/${invoice.id}`;

  return (
    <div 
      className="thermal-sheet bg-white flex flex-col relative text-slate-900 font-mono"
      style={{
        width: "100%",
        padding: "8mm 4mm",
        boxSizing: "border-box"
      }}
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-lg font-black uppercase text-slate-955 tracking-tight">{companyName}</h2>
        <p className="text-[10px] leading-relaxed">{companyAddress}</p>
        <p className="text-[10px]">Telp: {companyPhone}</p>
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-slate-950 my-3"></div>

      {/* Title */}
      <div className="text-center space-y-0.5">
        <h3 className="text-sm font-bold uppercase">NOTA PENAGIHAN</h3>
        <p className="text-[10px] font-bold text-slate-655">{invoice.invoice_number}</p>
      </div>

      {/* Details */}
      <div className="text-[10px] space-y-1 mt-3 text-left">
        <div className="flex justify-between">
          <span>Tanggal:</span>
          <span>{format(new Date(invoice.created_at), "dd/MM/yyyy HH:mm")}</span>
        </div>
        <div className="flex justify-between text-rose-650">
          <span>Jatuh Tempo:</span>
          <span>{format(new Date(invoice.due_date), "dd/MM/yyyy")}</span>
        </div>
        <div className="flex justify-between">
          <span>Client:</span>
          <span className="font-bold max-w-[70%] truncate text-right">{invoice.client_name || invoice.client_id}</span>
        </div>
        {/* <div className="flex justify-between text-slate-500">
          <span>Client ID:</span>
          <span>{invoice.client_id}</span>
        </div> */}
        <div className="flex justify-between">
          <span>Periode:</span>
          <span>{getIndonesianMonthYear(invoice.period_start)}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-slate-950 my-3"></div>

      {/* Items */}
      <div className="space-y-2 text-[10px] text-left">
        {invoice.items && invoice.items.length > 0 ? (
          invoice.items.map((item, idx) => (
            <div key={item.id || idx}>
              <div className="font-bold">{item.description}</div>
              <div className="flex justify-between text-slate-600">
                <span>{item.quantity} x {formatCurrency(item.unit_price)}</span>
                <span className="font-bold text-slate-900">{formatCurrency(item.amount)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center italic text-slate-400">Tidak ada item</div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-slate-950 my-3"></div>

      {/* Totals */}
      <div className="text-[10px] space-y-1 text-right">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(invoice.subtotal)}</span>
        </div>
        {invoice.tax_amount > 0 && (
          <div className="flex justify-between">
            <span>PPN:</span>
            <span>{formatCurrency(invoice.tax_amount)}</span>
          </div>
        )}
        {invoice.discount_amount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Diskon:</span>
            <span>-{formatCurrency(invoice.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between font-black text-sm text-slate-950 border-t border-dashed border-slate-300 pt-1.5 mt-1">
          <span>TOTAL:</span>
          <span>{formatCurrency(invoice.total_amount)}</span>
        </div>
        {invoice.paid_amount > 0 && (
          <div className="flex justify-between text-emerald-600 font-bold">
            <span>TERBAYAR:</span>
            <span>{formatCurrency(invoice.paid_amount)}</span>
          </div>
        )}
        {invoice.total_amount - invoice.paid_amount > 0 && (
          <div className="flex justify-between text-rose-650 font-black border-t border-dotted border-slate-300 pt-1">
            <span>SISA:</span>
            <span>{formatCurrency(invoice.total_amount - invoice.paid_amount)}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-slate-950 my-3"></div>

      {/* Status stamp */}
      <div className="text-center font-black border-2 border-slate-950 px-2 py-1 mx-auto my-2 w-fit rounded uppercase text-sm rotate-[-3deg]">
        {invoice.status === "paid" ? (
          <span className="text-emerald-700">L U N A S</span>
        ) : invoice.status === "cancelled" ? (
          <span className="text-slate-400">B A T A L</span>
        ) : (
          <span className="text-rose-700">BELUM LUNAS</span>
        )}
      </div>

      {/* QR Code */}
      <div className="flex justify-center my-3">
        <QRCodeSVG 
          value={qrUrl}
          size={55} 
          level="M" 
        />
      </div>

      {/* Custom Notes */}
      {notes && (
        <div className="text-[9px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-105 mb-2 italic text-left">
          Note: {notes}
        </div>
      )}

      {/* Footer message */}
      <div className="text-[9px] text-center leading-relaxed mt-2 text-slate-600">
        {footerMessage}
      </div>
    </div>
  );
}
