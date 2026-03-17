'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { portalService, PortalInvoice } from '@/lib/api/portalService';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';
import { ArrowLeftIcon, PrinterIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils/styles';

export default function PortalInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<PortalInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        const data = await portalService.getInvoiceDetail(id);
        setInvoice(data);
      } catch (err: any) {
        console.error('Failed to fetch invoice detail:', err);
        setError(err.message || 'Gagal memuat detail invoice');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Kembali
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">{error || 'Invoice tidak ditemukan'}</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'paid':
        return { label: 'Lunas', color: 'bg-emerald-100 text-emerald-700' };
      case 'pending':
        return { label: 'Belum Bayar', color: 'bg-amber-100 text-amber-700' };
      case 'overdue':
        return { label: 'Terlambat', color: 'bg-red-100 text-red-700' };
      case 'cancelled':
        return { label: 'Dibatalkan', color: 'bg-slate-100 text-slate-700' };
      default:
        return { label: status, color: 'bg-slate-100 text-slate-700' };
    }
  };

  const status = getStatusConfig(invoice.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header / Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => router.back()}
          className="group flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" /> 
          Kembali ke Daftar Tagihan
        </button>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <PrinterIcon className="h-4 w-4" /> Cetak
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
            <ArrowDownTrayIcon className="h-4 w-4" /> Download PDF
          </button>
        </div>
      </div>

      {/* Invoice Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-0 print:shadow-none">
        {/* Top Section */}
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row justify-between gap-6">
            <div>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Invoice</p>
              <h1 className="text-2xl font-black text-slate-900">{invoice.invoice_number}</h1>
              <div className="flex items-center gap-2 mt-3">
                <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide", status.color)}>
                  {status.label}
                </span>
                {invoice.status === 'overdue' && (
                  <span className="text-xs font-medium text-red-600 animate-pulse">
                    Mohon segera lakukan pembayaran
                  </span>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:text-right gap-y-4 gap-x-8 sm:gap-x-12">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tanggal Tagihan</p>
                <p className="text-sm font-bold text-slate-900">{formatDate(invoice.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Jatuh Tempo</p>
                <p className="text-sm font-bold text-red-600">{formatDate(invoice.due_date)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Periode Layanan</p>
                <p className="text-sm font-bold text-slate-900">
                  {new Date(invoice.period_start).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 sm:p-8 space-y-8">
          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Deskripsi Layanan</th>
                  <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Jumlah</th>
                  <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Harga Satuan</th>
                  <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-4 text-sm font-medium text-slate-900">{item.description}</td>
                      <td className="py-4 text-sm text-slate-600 text-center">{item.quantity}</td>
                      <td className="py-4 text-sm text-slate-600 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="py-4 text-sm font-bold text-slate-900 text-right">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-4 text-sm font-medium text-slate-900">Layanan Internet</td>
                    <td className="py-4 text-sm text-slate-600 text-center">1</td>
                    <td className="py-4 text-sm text-slate-600 text-right">{formatCurrency(invoice.subtotal)}</td>
                    <td className="py-4 text-sm font-bold text-slate-900 text-right">{formatCurrency(invoice.subtotal)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-900">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Pajak</span>
                  <span className="font-medium text-slate-900">{formatCurrency(invoice.tax_amount)}</span>
                </div>
              )}
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Potongan</span>
                  <span className="font-medium text-emerald-600">-{formatCurrency(invoice.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-slate-200">
                <span className="text-base font-bold text-slate-900">Total Tagihan</span>
                <span className="text-xl font-black text-indigo-600">{formatCurrency(invoice.total_amount)}</span>
              </div>
              
              {invoice.paid_amount > 0 && (
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-slate-500 italic">Sudah Dibayar</span>
                  <span className="font-bold text-emerald-600">-{formatCurrency(invoice.paid_amount)}</span>
                </div>
              )}
              
              {invoice.paid_amount < invoice.total_amount && (
                <div className="flex justify-between pt-3 border-t-2 border-double border-slate-200">
                  <span className="text-sm font-bold text-slate-900">Sisa Tagihan</span>
                  <span className="text-lg font-black text-red-600">
                    {formatCurrency(invoice.total_amount - invoice.paid_amount)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment History Section */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="p-6 sm:p-8 border-t border-slate-100 bg-emerald-50/20">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Riwayat Pembayaran
            </h3>
            <div className="space-y-3">
              {[...invoice.payments].reverse().map((payment, idx) => (
                <div key={payment.id} className="flex items-center justify-between text-sm bg-white p-3 rounded-lg border border-emerald-100 shadow-sm transition-all hover:bg-emerald-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                      {invoice.payments!.length - idx}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(payment.received_at)} • <span className="capitalize">{payment.method}</span>
                      </p>
                    </div>
                  </div>
                  {payment.reference && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Ref</p>
                      <p className="text-xs font-medium text-slate-600">{payment.reference}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Section */}
        <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between gap-6">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Informasi Pembayaran</p>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                Pembayaran dapat dilakukan melalui transfer bank atau melalui petugas kolektor kami. 
                Harap simpan bukti pembayaran ini sebagai referensi layanan anda.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 italic">Generated by</p>
              <p className="text-sm font-black text-slate-800 tracking-tighter">RRNet ERP</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
