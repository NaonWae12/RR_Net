import React from "react";
import type { InvoiceTemplateProps } from "./types";
import { getIndonesianMonthYear } from "./utils";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";

export function HvsTemplate({
  invoice,
  companyName,
  companyAddress,
  companyPhone,
  notes,
  footerMessage,
  signerName,
  selectedAccount,
  formatCurrency,
}: InvoiceTemplateProps) {
  const qrUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/portal/billing/${invoice.id}`
    : `https://rrnet.net/portal/billing/${invoice.id}`;

  return (
    <div 
      className="a4-sheet bg-white flex flex-col relative text-slate-900 font-sans"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "20mm 15mm 15mm 15mm",
        boxSizing: "border-box"
      }}
    >
      {/* Invoice Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
        <div className="space-y-1 max-w-[60%] text-left">
          <h2 className="text-2xl font-black uppercase text-indigo-650 tracking-tight">{companyName}</h2>
          <p className="text-xs text-slate-650 whitespace-pre-line leading-relaxed">{companyAddress}</p>
          <p className="text-xs text-slate-650 font-medium">Telp: {companyPhone}</p>
        </div>
        <div className="text-right space-y-1">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">INVOICE</h1>
          <p className="text-xs uppercase font-bold text-slate-400">Nota Penagihan</p>
          <div className="pt-2 text-xs text-slate-700 font-semibold space-y-0.5">
            <p>No: <span className="font-mono font-bold text-slate-950">{invoice.invoice_number}</span></p>
            <p>Tanggal: {format(new Date(invoice.created_at), "dd MMMM yyyy")}</p>
            <p className="text-rose-650">Jatuh Tempo: {format(new Date(invoice.due_date), "dd MMMM yyyy")}</p>
          </div>
        </div>
      </div>

      {/* Billing Info */}
      <div className="grid grid-cols-2 gap-8 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 text-left">
        <div>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ditagihkan Kepada:</h3>
          <div className="text-sm font-bold text-slate-900">{invoice.client_name || "Nama Client Tidak Tersedia"}</div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">ID: {invoice.client_id}</div>
          {invoice.client_phone && <div className="text-xs text-slate-600 mt-1 font-medium">HP: {invoice.client_phone}</div>}
          {invoice.client_address && (
            <div className="text-xs text-slate-500 mt-1 leading-relaxed whitespace-pre-line">
              Alamat: {invoice.client_address}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Detail Tagihan:</h3>
          <table className="w-full text-xs text-slate-700">
            <tbody>
              <tr>
                <td className="py-1 font-medium text-slate-500 text-left">Periode Layanan</td>
                <td className="py-1 text-right font-bold text-slate-900">
                  {getIndonesianMonthYear(invoice.period_start)}
                </td>
              </tr>
              <tr>
                <td className="py-1 font-medium text-slate-500 text-left">Group Kategori</td>
                <td className="py-1 text-right font-semibold">{invoice.client_group_name || "-"}</td>
              </tr>
              <tr>
                <td className="py-1 font-medium text-slate-500 text-left">Status Pembayaran</td>
                <td className="py-1 text-right font-black uppercase text-sm">
                  {invoice.status === "paid" ? (
                    <span className="text-emerald-600">LUNAS</span>
                  ) : invoice.status === "cancelled" ? (
                    <span className="text-slate-400">BATAL</span>
                  ) : (
                    <span className="text-rose-600">BELUM BAYAR</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-grow">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-2 w-12 text-center">No</th>
              <th className="py-3 px-2">Deskripsi Layanan / Item</th>
              <th className="py-3 px-2 w-20 text-center">Jumlah</th>
              <th className="py-3 px-2 w-32 text-right">Harga Satuan</th>
              <th className="py-3 px-2 w-36 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items && invoice.items.length > 0 ? (
              invoice.items.map((item, idx) => (
                <tr key={item.id || idx} className="text-xs text-slate-800">
                  <td className="py-3 px-2 text-center font-medium">{idx + 1}</td>
                  <td className="py-3 px-2 font-bold text-slate-900 text-left">{item.description}</td>
                  <td className="py-3 px-2 text-center font-medium">{item.quantity}</td>
                  <td className="py-3 px-2 text-right font-medium">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 px-2 text-right font-bold text-slate-900">{formatCurrency(item.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-400 text-xs italic">
                  Tidak ada rincian item layanan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Block */}
      <div className="grid grid-cols-12 gap-8 border-t-2 border-slate-950 pt-4 mt-6 text-left">
        <div className="col-span-7 space-y-4">
          {/* Payment Accounts Details */}
          {selectedAccount && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Metode Pembayaran Transfer:</h4>
              <p className="text-xs font-bold text-indigo-700 uppercase">
                {selectedAccount.provider} &bull; {selectedAccount.name}
              </p>
              <p className="text-sm font-mono font-bold text-slate-950 mt-1">
                No. Rek: {selectedAccount.account_number}
              </p>
              {selectedAccount.account_name && (
                <p className="text-[10px] text-slate-650 font-medium">a/n {selectedAccount.account_name}</p>
              )}
            </div>
          )}

          {/* Custom Notes */}
          {notes && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Catatan:</h4>
              <p className="text-xs text-slate-600 leading-relaxed italic">
                {notes}
              </p>
            </div>
          )}
        </div>

        <div className="col-span-5 text-right space-y-2 text-xs">
          <div className="flex justify-between text-slate-600 font-medium">
            <span>Subtotal</span>
            <span className="font-bold text-slate-900">{formatCurrency(invoice.subtotal)}</span>
          </div>
          {invoice.tax_amount > 0 && (
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Pajak (PPN)</span>
              <span className="font-bold text-slate-900">{formatCurrency(invoice.tax_amount)}</span>
            </div>
          )}
          {invoice.discount_amount > 0 && (
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Diskon</span>
              <span className="font-bold text-emerald-600">-{formatCurrency(invoice.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-black text-slate-955 mt-2">
            <span className="text-slate-900">Total Tagihan</span>
            <span className="text-lg text-indigo-700">{formatCurrency(invoice.total_amount)}</span>
          </div>
          {invoice.paid_amount > 0 && (
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>Jumlah Terbayar</span>
              <span>{formatCurrency(invoice.paid_amount)}</span>
            </div>
          )}
          {invoice.total_amount - invoice.paid_amount > 0 && (
            <div className="flex justify-between text-rose-650 font-black border-t border-dashed border-slate-200 pt-2">
              <span>Sisa Pembayaran</span>
              <span>{formatCurrency(invoice.total_amount - invoice.paid_amount)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Signatures & QR Code */}
      <div className="grid grid-cols-3 gap-6 items-end mt-12 border-t border-dashed border-slate-100 pt-8">
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-1">Pelanggan,</p>
          <div className="h-16"></div>
          <p className="text-xs font-bold text-slate-900 border-t border-slate-200 pt-1">
            {invoice.client_name || "Client"}
          </p>
        </div>
        <div className="flex justify-center">
          <QRCodeSVG 
            value={qrUrl}
            size={64} 
            level="H" 
          />
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-1">Hormat Kami,</p>
          <div className="h-16"></div>
          <p className="text-xs font-bold text-slate-900 border-t border-slate-200 pt-1">
            {signerName}
          </p>
        </div>
      </div>

      {/* Footer text */}
      <div className="mt-8 text-center text-[10px] text-slate-400 font-medium">
        {footerMessage}
      </div>
    </div>
  );
}
