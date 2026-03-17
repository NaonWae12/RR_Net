'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Client } from '@/lib/api/clientService';
import { useCollectorStore } from '@/stores/collectorStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { PartialPaymentModal } from './PartialPaymentModal';
import { useAuth } from '@/lib/hooks/useAuth';
import { LockClosedIcon, CheckCircleIcon, PlusIcon, XMarkIcon } from '@heroicons/react/20/solid';

interface CollectorActionsProps {
  client: Client;
  paymentStatus?: string;
  invoiceId?: string;
}

export function CollectorActions({ client, paymentStatus, invoiceId }: CollectorActionsProps) {
  const { 
    markClientPaidFull, 
    markClientNotHome,
    removePartialPayment,
    openPartialPaymentModal,
    closePartialPaymentModal,
    partialPaymentModal,
    partialPayments,
    allPartialPayments,
    paidFullClients,
    globallyPaidFullClients,
    notHomeClients,
    lockedAssignments,
    settledAssignments
  } = useCollectorStore();
  
  const { user } = useAuth();
  const { showToast } = useNotificationStore();
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate total billing for a client
  const calculateTotal = useCallback((client: Client): number => {
    const basePrice = client.monthly_fee || 0;

    // Apply discount if exists
    if (client.discount_type && client.discount_value) {
      if (client.discount_type === 'percent') {
        return basePrice - (basePrice * client.discount_value / 100);
      } else {
        return Math.max(0, basePrice - client.discount_value);
      }
    }

    return basePrice;
  }, []);

  const totalAmount = useMemo(() => calculateTotal(client), [client, calculateTotal]);
  const myPartialAmount = partialPayments.get(client.id) || 0;
  const totalPartialToday = allPartialPayments.get(client.id) || 0;
  const isGloballyPaid = globallyPaidFullClients.has(client.id);
  const paidFull = paidFullClients.has(client.id);
  const notHome = notHomeClients.has(client.id);
  const hasAnyPartialPayment = totalPartialToday > 0 && !paidFull && !isGloballyPaid;
  const isPaid = paymentStatus === "paid" || paidFull || isGloballyPaid;

  const handlePaidFull = async () => {
    if (isProcessing || !user?.id) return;
    setIsProcessing(true);
    try {
      await markClientPaidFull(client, user.id);
      const newPaidFull = !paidFull;
      showToast({
        title: newPaidFull ? 'Payment recorded' : 'Payment removed',
        description: newPaidFull 
          ? `${client.name} marked as paid in full`
          : `Removed payment status for ${client.name}`,
        variant: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err?.message || 'Failed to update payment status',
        variant: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNotHome = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await markClientNotHome(client);
      const newNotHome = !notHome;
      showToast({
        title: newNotHome ? 'Marked as not home' : 'Status removed',
        description: newNotHome
          ? `${client.name} marked as not available`
          : `Removed not home status for ${client.name}`,
        variant: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err?.message || 'Failed to update status',
        variant: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePartialPayment = () => {
    openPartialPaymentModal(client);
  };

  const handleRemovePartialPayment = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await removePartialPayment(client.id, user?.id);
      showToast({
        title: 'Partial payment removed',
        description: `Removed partial payment for ${client.name}`,
        variant: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err?.message || 'Failed to remove partial payment',
        variant: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isLocked = invoiceId ? lockedAssignments.has(invoiceId) : false;
  // ONLY show as settled (icon) if it's in settledAssignments (verified/submitted) 
  // OR if it's already paid in backend status WITHOUT us marking it lunas locally.
  // If we marked it lunas, we want to see the check and be able to uncheck it.
  const isSettled = (invoiceId ? settledAssignments.has(invoiceId) : false) || (paymentStatus === 'paid' && !paidFull);

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {/* Checkbox for full payment */}
        <div className="flex items-center gap-1.5 min-w-[32px] justify-center">
        {isLocked ? (
          <div className="p-1 px-1.5 bg-slate-100 rounded border border-slate-200 text-slate-400 flex items-center gap-1" title="Locked by another collector">
             <LockClosedIcon className="w-3.5 h-3.5" />
             <div className="w-3.5 h-3.5 bg-slate-200 rounded-sm" />
          </div>
        ) : isSettled ? (
          <div className="p-1 px-1.5 bg-emerald-50 rounded border border-emerald-100 text-emerald-500 flex items-center gap-1" title="Sudah disetorkan & diverifikasi">
             <CheckCircleIcon className="w-4 h-4" />
          </div>
        ) : (
          <label className="flex items-center cursor-pointer" title={paidFull ? "Uncheck to remove payment" : "Mark as paid in full"}>
            <input
              type="checkbox"
              checked={paidFull}
              onChange={handlePaidFull}
              // Only disable if invoice is already paid from a source OTHER than us (paidFull=false means we didn't mark it)
              // If we marked it (paidFull=true), allow toggling to undo
              disabled={isProcessing || (paymentStatus === 'paid' && !paidFull)}
              className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>
        )}
        </div>

        {/* Partial payment display or button - Hide if already paid/full */}
        {!isPaid && (
          hasAnyPartialPayment ? (
            <div className="flex items-center gap-1.5 p-0.5 px-2 bg-blue-50/50 rounded-lg border border-blue-100 shadow-sm group">
              <span className="text-[11px] font-bold text-blue-700">
                 {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(totalPartialToday)}
              </span>
              <div className="flex items-center gap-0.5 border-l border-blue-200 ml-1 pl-1">
                {!isSettled && (
                  <button
                    onClick={handlePartialPayment}
                    disabled={isProcessing}
                    className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded-md transition-colors"
                    title="Tambah pembayaran berikutnya (+)"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                  </button>
                )}
                {myPartialAmount > 0 && !isSettled && (
                  <button
                     onClick={handleRemovePartialPayment}
                     disabled={isProcessing}
                     className="p-1 text-blue-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                     title="Batalkan pembayaran saya (X)"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={handlePartialPayment}
              disabled={isProcessing || isSettled || notHome}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors border border-transparent hover:border-blue-100"
              title="Tambah pembayaran partial (+)"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          )
        )}

        {/* Button for not home (toggle) */}
        <button
          onClick={handleNotHome}
          disabled={isProcessing || paidFull || isPaid}
          className={`p-1.5 rounded transition-colors ${
            notHome
              ? 'text-red-600 bg-red-50'
              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={notHome ? "Click to remove not home status" : "Mark as not home"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Partial Payment Modal */}
      {partialPaymentModal.open && partialPaymentModal.client?.id === client.id && (
        <PartialPaymentModal
          client={partialPaymentModal.client}
          totalAmount={totalAmount}
          onClose={closePartialPaymentModal}
        />
      )}
    </>
  );
}
