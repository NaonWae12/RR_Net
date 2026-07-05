import React from "react";
import type { InvoiceTemplateProps } from "./types";
import { getIndonesianMonthYear } from "./utils";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";

export function SimpleTemplate({
  invoice,
  companyName,
  companyAddress,
  companyPhone,
  notes,
  footerMessage,
  signerName,
  formatCurrency,
}: InvoiceTemplateProps) {
  const qrUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/portal/billing/${invoice.id}`
    : `https://rrnet.net/portal/billing/${invoice.id}`;

  return (
    <div 
      className="a4-sheet bg-white flex flex-col relative text-black font-mono border-2 border-black"
      style={{
        width: "210mm",
        minHeight: "148mm", // A5 landscape height simulation
        padding: "10mm 12mm",
        boxSizing: "border-box",
      }}
    >
      {/* Invoice Header */}
      <div className="flex justify-between items-start border-b border-black pb-4 mb-4">
        <div className="text-left">
          <h2 className="text-xl font-bold uppercase tracking-tight">{companyName}</h2>
          <p className="text-[10px] leading-relaxed">{companyAddress}</p>
          <p className="text-[10px]">Telp: {companyPhone}</p>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold uppercase tracking-tight">KWITANSI</h1>
          <p className="text-[9px] uppercase text-slate-500">Nota Pembayaran</p>
          <div className="pt-2 text-[10px] space-y-0.5">
            <p>No: <span className="font-bold">{invoice.invoice_number}</span></p>
            <p>Tanggal: {format(new Date(invoice.created_at), "dd/MM/yyyy")}</p>
          </div>
        </div>
      </div>

      {/* Client and Period details */}
      <div className="grid grid-cols-2 gap-4 text-[10px] mb-4 text-left">
        <div className="border border-black p-2.5">
          <p className="font-bold uppercase mb-1">Diterima Dari / Kepada:</p>
          <p className="font-bold text-xs">{invoice.client_name || "Nama Client"}</p>
          <p className="text-slate-600 font-mono mt-0.5">Client ID: {invoice.client_id}</p>
          {invoice.client_phone && <p>Telp: {invoice.client_phone}</p>}
        </div>
        <div className="border border-black p-2.5">
          <p className="font-bold uppercase mb-1">Keterangan:</p>
          <table className="w-full">
            <tbody>
              <tr>
                <td className="text-slate-600">Periode Layanan</td>
                <td className="text-right font-bold">{getIndonesianMonthYear(invoice.period_start)}</td>
              </tr>
              <tr>
                <td className="text-slate-600">Kategori / Grup</td>
                <td className="text-right">{invoice.client_group_name || "-"}</td>
              </tr>
              <tr>
                <td className="text-slate-600">Status Nota</td>
                <td className="text-right font-bold uppercase">
                  {invoice.status === "paid" ? "LUNAS" : invoice.status === "cancelled" ? "BATAL" : "BELUM LUNAS"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-grow">
        <table className="w-full text-left border border-black text-[10px]">
          <thead>
            <tr className="border-b border-black bg-slate-50 font-bold uppercase">
              <th className="p-1.5 w-10 text-center border-r border-black">No</th>
              <th className="p-1.5 border-r border-black">Rincian Pembayaran / Layanan</th>
              <th className="p-1.5 w-16 text-center border-r border-black">Qyt</th>
              <th className="p-1.5 w-28 text-right border-r border-black">Harga</th>
              <th className="p-1.5 w-28 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items && invoice.items.length > 0 ? (
              invoice.items.map((item, idx) => (
                <tr key={item.id || idx} className="border-b border-black last:border-b-0">
                  <td className="p-1.5 text-center border-r border-black font-medium">{idx + 1}</td>
                  <td className="p-1.5 border-r border-black text-left">{item.description}</td>
                  <td className="p-1.5 text-center border-r border-black">{item.quantity}</td>
                  <td className="p-1.5 text-right border-r border-black">{formatCurrency(item.unit_price)}</td>
                  <td className="p-1.5 text-right font-bold">{formatCurrency(item.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-4 text-center italic text-slate-550">
                  Tidak ada rincian item layanan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary and Signatures */}
      <div className="grid grid-cols-12 gap-4 mt-4 text-left">
        <div className="col-span-7 flex flex-col justify-between">
          <div>
            {notes && (
              <div className="text-[9px] border border-black p-1.5 italic">
                <span className="font-bold block uppercase not-italic">Catatan:</span>
                {notes}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <QRCodeSVG 
              value={qrUrl}
              size={48} 
              level="M" 
            />
            <div className="text-[9px] leading-relaxed text-slate-600">
              {footerMessage}
            </div>
          </div>
        </div>

        <div className="col-span-5 text-right space-y-1.5 text-[10px]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          {invoice.tax_amount > 0 && (
            <div className="flex justify-between">
              <span>Pajak (PPN)</span>
              <span>{formatCurrency(invoice.tax_amount)}</span>
            </div>
          )}
          {invoice.discount_amount > 0 && (
            <div className="flex justify-between text-slate-700">
              <span>Diskon</span>
              <span>-{formatCurrency(invoice.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-black pt-1.5 text-xs font-bold mt-1">
            <span>TOTAL BAYAR</span>
            <span className="text-sm font-black">{formatCurrency(invoice.total_amount)}</span>
          </div>

          <div className="pt-6 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-[9px]">Penerima,</p>
              <div className="h-10"></div>
              <p className="font-bold border-t border-black pt-1">{signerName}</p>
            </div>
            <div>
              <p className="text-[9px]">Pelanggan,</p>
              <div className="h-10"></div>
              <p className="font-bold border-t border-black pt-1">{invoice.client_name || "Client"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
