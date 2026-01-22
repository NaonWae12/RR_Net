'use client';

import React, { useState, useEffect } from 'react';
import { useCollectorStore } from '@/stores/collectorStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useBillingStore } from '@/stores/billingStore';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PartialPaymentModalProps {
  clientId: string;
  clientName?: string;
  totalAmount: number;
  invoiceId?: string; // Invoice ID for the payment
  onClose: () => void;
}

export function PartialPaymentModal({ 
  clientId, 
  clientName, 
  totalAmount,
  invoiceId,
  onClose 
}: PartialPaymentModalProps) {
  const { addPartialPayment, getClientPartialAmount, selectedDate } = useCollectorStore();
  const { fetchClientPendingInvoices } = useBillingStore();
  const { user } = useAuth();
  const { showToast } = useNotificationStore();
  const [amount, setAmount] = useState<string>(getClientPartialAmount(clientId).toString() || '');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | undefined>(invoiceId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Fetch active invoice if not provided
  useEffect(() => {
    if (!activeInvoiceId && clientId) {
      setLoadingInvoice(true);
      fetchClientPendingInvoices(clientId)
        .then((invoices) => {
          // Find invoice for selected date/month
          const selectedMonth = selectedDate.getMonth();
          const selectedYear = selectedDate.getFullYear();
          
          const matchingInvoice = invoices.find((inv) => {
            const invDate = new Date(inv.period_start);
            return invDate.getMonth() === selectedMonth && invDate.getFullYear() === selectedYear;
          });
          
          // If no matching invoice, use the first pending invoice
          setActiveInvoiceId(matchingInvoice?.id || invoices[0]?.id);
        })
        .catch(() => {
          // Ignore error, will use undefined
        })
        .finally(() => {
          setLoadingInvoice(false);
        });
    }
  }, [clientId, activeInvoiceId, selectedDate, fetchClientPendingInvoices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount',
        variant: 'error',
      });
      return;
    }

    if (numAmount >= totalAmount) {
      showToast({
        title: 'Amount too high',
        description: 'Partial payment must be less than total amount',
        variant: 'error',
      });
      return;
    }

    if (!activeInvoiceId) {
      showToast({
        title: 'No invoice found',
        description: 'Please ensure client has an active invoice',
        variant: 'error',
      });
      return;
    }

    if (!user?.id) {
      showToast({
        title: 'Authentication error',
        description: 'Please login again',
        variant: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create payment record via API
      await addPartialPayment(
        clientId,
        activeInvoiceId,
        numAmount,
        user.id,
        new Date(paymentDate).toISOString()
      );
      showToast({
        title: 'Partial payment recorded',
        description: `Recorded Rp ${numAmount.toLocaleString('id-ID')} for ${clientName || 'client'}`,
        variant: 'success',
      });
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err?.message || 'Failed to record partial payment',
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Add Partial Payment
        </h2>
        
        {clientName && (
          <p className="text-sm text-slate-600 mb-4">
            Client: <span className="font-medium">{clientName}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {loadingInvoice && (
            <p className="text-sm text-slate-500">Loading invoice information...</p>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Payment Date
            </label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Date when payment was received
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                Rp
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min="0"
                max={totalAmount}
                step="1000"
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
                autoFocus
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Total amount: Rp {totalAmount.toLocaleString('id-ID')}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

