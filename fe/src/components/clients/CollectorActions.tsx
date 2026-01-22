'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Client } from '@/lib/api/clientService';
import { useCollectorStore } from '@/stores/collectorStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { PartialPaymentModal } from './PartialPaymentModal';
import servicePackageService, { ServicePackage } from '@/lib/api/servicePackageService';

interface CollectorActionsProps {
  client: Client;
}

export function CollectorActions({ client }: CollectorActionsProps) {
  const { 
    markClientPaidFull, 
    markClientNotHome,
    removePartialPayment,
    openPartialPaymentModal,
    closePartialPaymentModal,
    isClientPaidFull,
    isClientNotHome,
    getClientPartialAmount,
    partialPaymentModal
  } = useCollectorStore();
  
  const { showToast } = useNotificationStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [packages, setPackages] = useState<ServicePackage[]>([]);

  // Load service packages for calculating total billing
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const packageList = await servicePackageService.list(undefined, false);
        if (!alive) return;
        setPackages(packageList);
      } catch {
        // ignore error
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Calculate total billing for a client (same logic as ClientTable)
  const calculateTotal = useCallback((client: Client): number => {
    if (!client.service_package_id) return 0;
    
    const pkg = packages.find((p) => p.id === client.service_package_id);
    if (!pkg) return 0;

    let basePrice = 0;
    if (pkg.pricing_model === 'per_device') {
      basePrice = pkg.price_per_device * (client.device_count || 1);
    } else {
      basePrice = pkg.price_monthly;
    }

    // Apply discount if exists
    if (client.discount_type && client.discount_value) {
      if (client.discount_type === 'percent') {
        return basePrice - (basePrice * client.discount_value / 100);
      } else {
        return Math.max(0, basePrice - client.discount_value);
      }
    }

    return basePrice;
  }, [packages]);

  const totalAmount = useMemo(() => calculateTotal(client), [client, calculateTotal]);
  const partialAmount = getClientPartialAmount(client.id);
  const paidFull = isClientPaidFull(client.id);
  const notHome = isClientNotHome(client.id);
  const hasPartialPayment = partialAmount > 0;

  const handlePaidFull = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await markClientPaidFull(client.id);
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
      await markClientNotHome(client.id);
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
    openPartialPaymentModal(client.id);
  };

  const handleRemovePartialPayment = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await removePartialPayment(client.id);
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

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {/* Checkbox for full payment */}
        <label className="flex items-center cursor-pointer" title={paidFull ? "Uncheck to remove payment" : "Mark as paid in full"}>
          <input
            type="checkbox"
            checked={paidFull}
            onChange={handlePaidFull}
            disabled={isProcessing || notHome}
            className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>

        {/* Partial payment display or button */}
        {hasPartialPayment ? (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded border border-blue-200">
            <span className="text-xs font-medium text-blue-700">
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(partialAmount)}
            </span>
            <button
              onClick={handleRemovePartialPayment}
              disabled={isProcessing}
              className="p-0.5 text-blue-600 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Remove partial payment"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={handlePartialPayment}
            disabled={isProcessing || paidFull || notHome}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Add partial payment"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {/* Button for not home (toggle) */}
        <button
          onClick={handleNotHome}
          disabled={isProcessing || paidFull}
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
      {partialPaymentModal.open && partialPaymentModal.clientId === client.id && (
        <PartialPaymentModal
          clientId={client.id}
          clientName={client.name}
          totalAmount={totalAmount}
          onClose={closePartialPaymentModal}
        />
      )}
    </>
  );
}

