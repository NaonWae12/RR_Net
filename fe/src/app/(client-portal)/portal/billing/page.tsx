'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { portalService, PortalInvoice } from '@/lib/api/portalService';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';
import PaymentModal from '@/components/portal/PaymentModal';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';

export default function PortalBillingPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<PortalInvoice | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await portalService.getInvoices();
      setInvoices(data);
    } catch (err: any) {
      console.error('Failed to fetch invoices:', err);
      
      // Force logout if client data not found
      if (err?.statusCode === 403) {
        toast.error('Akun Anda tidak terhubung dengan data pelanggan. Mengeluarkan sesi...', {
          duration: 3000
        });
        setTimeout(() => {
          useAuthStore.getState().logout();
        }, 2000);
      }
      
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handlePayClick = async (invoice: PortalInvoice) => {
    setIsLoadingDetail(true);
    try {
      // Fetch full invoice detail with items
      const detailInvoice = await portalService.getInvoiceDetail(invoice.id);
      setSelectedInvoice(detailInvoice);
      setIsPaymentModalOpen(true);
    } catch (err: any) {
      console.error('Failed to fetch invoice detail:', err);
      setError('Gagal memuat detail invoice');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handlePaymentSuccess = () => {
    // Refresh invoices after successful payment
    fetchInvoices();
    setSelectedInvoice(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    // Backend sends amount in rupiah (not cents)
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const monthName = startDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return monthName;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-700';
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Lunas';
      case 'pending':
        return 'Belum Bayar';
      case 'overdue':
        return 'Terlambat';
      case 'cancelled':
        return 'Dibatalkan';
      default:
        return status;
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tagihan & Pembayaran</h1>
          <p className="text-sm text-slate-500">Riwayat transaksi dan status pembayaran anda.</p>
        </div>

        {invoices.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-slate-900">Belum ada tagihan</h3>
            <p className="mt-1 text-sm text-slate-500">
              Tagihan anda akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {invoices.map((inv) => (
              <div key={inv.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                    <button 
                      onClick={() => router.push(`/portal/billing/${inv.id}`)}
                      className="text-left hover:opacity-80 transition-opacity"
                    >
                      <p className="text-xs text-slate-500 font-medium mb-0.5">{inv.invoice_number}</p>
                      <h3 className="font-semibold text-slate-900">
                        {formatPeriod(inv.period_start, inv.period_end)}
                      </h3>
                    </button>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide sm:hidden ${getStatusBadge(inv.status)}`}>
                      {getStatusLabel(inv.status)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Jatuh Tempo: {new Date(inv.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {inv.paid_amount > 0 && inv.status !== 'paid' && (
                    <p className="text-xs text-slate-500 mt-1">
                      Terbayar: {formatCurrency(inv.paid_amount)} dari {formatCurrency(inv.total_amount)}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                  <span className={`hidden sm:inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusBadge(inv.status)}`}>
                    {getStatusLabel(inv.status)}
                  </span>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-slate-900 mr-2">{formatCurrency(inv.total_amount)}</p>
                    
                    {(inv.status === 'pending' || inv.status === 'overdue') && (
                      <button 
                        onClick={() => handlePayClick(inv)}
                        disabled={isLoadingDetail}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        {isLoadingDetail ? '...' : 'Bayar'}
                      </button>
                    )}
                    
                    <button 
                      onClick={() => router.push(`/portal/billing/${inv.id}`)}
                      className="text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 text-xs font-bold px-3 py-2 rounded-lg transition-all"
                    >
                      Detail
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedInvoice(null);
          }}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}
