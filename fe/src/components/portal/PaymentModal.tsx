'use client';

import React, { useState } from 'react';
import { PortalInvoice } from '@/lib/api/portalService';

interface PaymentModalProps {
  invoice: PortalInvoice;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export default function PaymentModal({ invoice, isOpen, onClose, onPaymentSuccess }: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'collector' | null>(null);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) {
      return 'Rp 0';
    }
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Add safety checks for all amounts
  const totalAmount = invoice.total_amount || 0;
  const paidAmount = invoice.paid_amount || 0;
  const subtotal = invoice.subtotal || 0;
  const taxAmount = invoice.tax_amount || 0;
  const discountAmount = invoice.discount_amount || 0;
  const remainingAmount = totalAmount - paidAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMethod) {
      setError('Silakan pilih metode pembayaran');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { portalService } = await import('@/lib/api/portalService');
      await portalService.recordPayment(
        invoice.id,
        remainingAmount,
        selectedMethod,
        reference || undefined,
        notes || undefined
      );
      
      onPaymentSuccess();
      onClose();
    } catch (err: any) {
      console.error('Payment failed:', err);
      setError(err.response?.data?.error || 'Gagal memproses pembayaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-900">Pembayaran Tagihan</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Invoice Details */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Nomor Invoice</p>
                <p className="font-semibold text-slate-900">{invoice.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-medium mb-1">Jatuh Tempo</p>
                <p className="font-semibold text-slate-900">{formatDate(invoice.due_date)}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="text-slate-900">{formatCurrency(subtotal)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Pajak</span>
                  <span className="text-slate-900">{formatCurrency(taxAmount)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Diskon</span>
                  <span className="text-emerald-600">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2">
                <span className="text-slate-900">Total Tagihan</span>
                <span className="text-slate-900">{formatCurrency(totalAmount)}</span>
              </div>
              {paidAmount > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Sudah Dibayar</span>
                    <span className="text-emerald-600">-{formatCurrency(paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                    <span className="text-indigo-600">Sisa Tagihan</span>
                    <span className="text-indigo-600">{formatCurrency(remainingAmount)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Invoice Items */}
            {invoice.items && invoice.items.length > 0 && (
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-500 font-medium mb-2">Detail Item</p>
                <div className="space-y-1">
                  {invoice.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-slate-600">
                        {item.description} {item.quantity > 1 && `(${item.quantity}x)`}
                      </span>
                      <span className="text-slate-900">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-3">
              Pilih Metode Pembayaran <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedMethod('cash')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedMethod === 'cash'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === 'cash' ? 'border-indigo-600' : 'border-slate-300'
                  }`}>
                    {selectedMethod === 'cash' && (
                      <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Cash / Tunai</p>
                    <p className="text-xs text-slate-500">Pembayaran langsung</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('collector')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedMethod === 'collector'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === 'collector' ? 'border-indigo-600' : 'border-slate-300'
                  }`}>
                    {selectedMethod === 'collector' && (
                      <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Collector</p>
                    <p className="text-xs text-slate-500">Bayar ke kolektor</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Optional Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nomor Referensi (Opsional)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Contoh: nomor bukti transfer, nomor kwitansi"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Catatan (Opsional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tambahkan catatan jika diperlukan"
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between rounded-b-2xl">
          <div>
            <p className="text-xs text-slate-500">Total Pembayaran</p>
            <p className="text-2xl font-bold text-indigo-600">{formatCurrency(remainingAmount)}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedMethod}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Memproses...' : 'Konfirmasi Pembayaran'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
