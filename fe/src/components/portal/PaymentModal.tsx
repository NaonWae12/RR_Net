'use client';

import React, { useState, useEffect } from 'react';
import { PortalInvoice, portalService } from '@/lib/api/portalService';
import { CreditCard, Wallet, UserCircle, Loader2, Building2 } from 'lucide-react';
import { paymentMethodService, PaymentMethod } from '@/lib/api/paymentMethodService';

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: Record<string, any>) => void;
    };
  }
}

interface PaymentModalProps {
  invoice: PortalInvoice;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export default function PaymentModal({ invoice, isOpen, onClose, onPaymentSuccess }: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [midtransEnabled, setMidtransEnabled] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setIsLoadingConfig(true);
        try {
          // 1. Fetch Midtrans Config
          const config = await portalService.getMidtransConfig();
          if (config.enabled && config.client_key) {
            setMidtransEnabled(true);
            setSelectedMethod('midtrans');
            
            // Inject Snap SDK
            if (typeof window !== 'undefined' && !window.snap) {
              const scriptId = 'midtrans-snap-script';
              if (!document.getElementById(scriptId)) {
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = config.is_production 
                  ? 'https://app.midtrans.com/snap/snap.js' 
                  : 'https://app.sandbox.midtrans.com/snap/snap.js';
                script.setAttribute('data-client-key', config.client_key);
                document.body.appendChild(script);
              }
            }
          } else {
            setSelectedMethod('cash');
          }

          // 2. Fetch Manual Payment Methods (Bank Accounts)
          const manualMethods = await paymentMethodService.listPortal();
          const activeBanks = manualMethods.filter(pm => pm.is_active && pm.category !== 'cash' && pm.category !== 'collector');
          setAvailablePaymentMethods(activeBanks);

        } catch (err) {
          console.error('Failed to load payment config:', err);
        } finally {
          setIsLoadingConfig(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

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

  const totalAmount = invoice.total_amount || 0;
  const paidAmount = invoice.paid_amount || 0;
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
      if (selectedMethod && selectedMethod.startsWith('midtrans')) {
        const category = selectedMethod.replace('midtrans_', '');
        const token = await portalService.getSnapToken(invoice.id, category);
        
        if (!window.snap) {
          throw new Error('Midtrans SDK belum siap. Silakan coba lagi.');
        }

        window.snap.pay(token, {
          onSuccess: () => {
            onPaymentSuccess();
            onClose();
          },
          onPending: () => {
            onPaymentSuccess();
            onClose();
          },
          onError: (err: any) => {
            setError('Pembayaran gagal. Silakan coba lagi.');
            console.error('Midtrans error:', err);
          },
          onClose: () => {
            setIsSubmitting(false);
          }
        });
      } else {
        // Find if selected method is a bank account
        const bankAccount = availablePaymentMethods.find(pm => pm.id === selectedMethod);
        const finalMethod = bankAccount 
          ? (bankAccount.provider || bankAccount.name || 'Transfer') 
          : selectedMethod;

        await portalService.recordPayment(
          invoice.id,
          remainingAmount,
          finalMethod as any,
          reference || undefined,
          notes || undefined
        );
        onPaymentSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Payment failed:', err);
      setError(err.response?.data?.error || err.message || 'Gagal memproses pembayaran');
      setIsSubmitting(false);
    }
  };

  const [paymentCategory, setPaymentCategory] = useState<'cash' | 'manual' | 'instant' | null>(null);
  const [instantSubCategory, setInstantSubCategory] = useState<'bank_transfer' | 'ewallet' | 'qris' | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast here if available
  };

  const handleCategorySelect = (cat: 'cash' | 'manual' | 'instant') => {
    setPaymentCategory(cat);
    if (cat === 'cash') {
      setSelectedMethod('cash');
      setInstantSubCategory(null);
    } else if (cat === 'manual') {
      setSelectedMethod(availablePaymentMethods.length > 0 ? availablePaymentMethods[0].id : null);
      setInstantSubCategory(null);
    } else {
      setSelectedMethod(null);
      setInstantSubCategory(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Pembayaran Tagihan</h2>
            <p className="text-sm text-slate-500">Selesaikan pembayaran untuk tetap terhubung</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 flex-1">
          {/* Invoice Summary Card */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-indigo-100 text-sm font-medium mb-1">Nomor Invoice</p>
                <p className="text-xl font-bold">{invoice.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="text-indigo-100 text-sm font-medium mb-1">Jatuh Tempo</p>
                <p className="text-lg font-semibold">{formatDate(invoice.due_date)}</p>
              </div>
            </div>

            <div className="space-y-2 border-t border-white/20 pt-4">
              <div className="flex justify-between text-sm text-indigo-50">
                <span>Total Tagihan</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
              {paidAmount > 0 && (
                <div className="flex justify-between text-sm text-indigo-50">
                  <span>Sudah Dibayar</span>
                  <span>{formatCurrency(paidAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-medium">Sisa Tagihan</span>
                <span className="text-3xl font-black">{formatCurrency(remainingAmount)}</span>
              </div>
            </div>
          </div>

          {/* New Category Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-900 uppercase tracking-wider">
              Pilih Tipe Pembayaran
            </label>
            
            {isLoadingConfig ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleCategorySelect('cash')}
                  className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center ${
                    paymentCategory === 'cash'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${paymentCategory === 'cash' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Wallet className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900">Cash</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleCategorySelect('manual')}
                  className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center ${
                    paymentCategory === 'manual'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${paymentCategory === 'manual' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900">Manual</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleCategorySelect('instant')}
                  disabled={!midtransEnabled}
                  className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center ${
                    !midtransEnabled ? 'opacity-50 grayscale cursor-not-allowed' :
                    paymentCategory === 'instant'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${paymentCategory === 'instant' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900">Instant</p>
                </button>
              </div>
            )}
          </div>

          {/* Sub-options for Manual Transfer */}
          {paymentCategory === 'manual' && availablePaymentMethods.length > 0 && (
            <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
              <label className="block text-sm font-bold text-slate-900 uppercase tracking-wider">
                Daftar Rekening Bank
              </label>
              <div className="grid grid-cols-1 gap-3">
                {availablePaymentMethods.map((pm) => (
                  <div
                    key={pm.id}
                    onClick={() => setSelectedMethod(pm.id)}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                      selectedMethod === pm.id
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${selectedMethod === pm.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 uppercase text-sm">{pm.provider || pm.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-slate-500">{pm.account_number}</p>
                          <button 
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(pm.account_number || ''); }}
                            className="p-1 hover:bg-indigo-100 rounded text-indigo-600 transition-colors"
                            title="Salin Nomor Rekening"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400">a/n {pm.account_name}</p>
                      </div>
                    </div>
                    {selectedMethod === pm.id && (
                      <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-options for Instant Payment (Midtrans) */}
          {paymentCategory === 'instant' && (
            <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
              <label className="block text-sm font-bold text-slate-900 uppercase tracking-wider">
                Pilih Metode Instant
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => { setInstantSubCategory('bank_transfer'); setSelectedMethod('midtrans_bank_transfer'); }}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center ${
                    instantSubCategory === 'bank_transfer'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${instantSubCategory === 'bank_transfer' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-900">Bank Transfer</p>
                </button>

                <button
                  type="button"
                  onClick={() => { setInstantSubCategory('ewallet'); setSelectedMethod('midtrans_e_wallet'); }}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center ${
                    instantSubCategory === 'ewallet'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${instantSubCategory === 'ewallet' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Wallet className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-900">E-Wallet</p>
                </button>

                <button
                  type="button"
                  onClick={() => { setInstantSubCategory('qris'); setSelectedMethod('midtrans_qris'); }}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center ${
                    instantSubCategory === 'qris'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${instantSubCategory === 'qris' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <path d="M7 7h.01M17 7h.01M7 17h.01" />
                    </svg>
                  </div>
                  <p className="text-[10px] font-bold text-slate-900">QRIS Scan</p>
                </button>
              </div>
            </div>
          )}

          {/* Reference and Notes (Only for Cash or Manual) */}
          {paymentCategory && paymentCategory !== 'instant' && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Nomor Referensi (Opsional)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Contoh: No. Kwitansi atau Bukti Transfer"
                  className="w-full px-5 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Catatan (Opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tambahkan catatan tambahan jika perlu..."
                  rows={3}
                  className="w-full px-5 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-600 animate-shake">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-8 py-6 flex items-center justify-between">
          <div className="hidden sm:block">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Metode Terpilih</p>
            <p className="font-bold text-slate-900 capitalize">
              {selectedMethod?.startsWith('midtrans') ? 'Instant Payment' : (availablePaymentMethods.find(pm => pm.id === selectedMethod)?.provider || availablePaymentMethods.find(pm => pm.id === selectedMethod)?.name || selectedMethod || 'Belum dipilih')}
            </p>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-8 py-3.5 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedMethod}
              className="flex-[2] sm:flex-none px-10 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {selectedMethod?.startsWith('midtrans') ? 'Bayar Sekarang' : 'Konfirmasi Pembayaran'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
