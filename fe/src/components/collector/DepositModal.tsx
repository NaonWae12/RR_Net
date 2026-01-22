'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useCollectorStore } from '@/stores/collectorStore';
import { useClientStore } from '@/stores/clientStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import servicePackageService, { ServicePackage } from '@/lib/api/servicePackageService';
import { Client } from '@/lib/api/clientService';

interface DepositModalProps {
  onClose: () => void;
}

export function DepositModal({ onClose }: DepositModalProps) {
  const { 
    paidFullClients, 
    partialPayments, 
    payments,
    submitDeposit,
    todayCollection 
  } = useCollectorStore();
  const { clients } = useClientStore();
  const { showToast } = useNotificationStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Calculate total amount to deposit
  const depositAmount = useMemo(() => {
    let total = 0;
    
    // Add from paid full clients - calculate from actual total tagihan
    paidFullClients.forEach((clientId) => {
      const client = clients.find((c) => c.id === clientId);
      if (client) {
        const clientTotal = calculateTotal(client);
        total += clientTotal;
      }
    });
    
    // Add from partial payments
    partialPayments.forEach((amount) => {
      total += amount;
    });
    
    return total;
  }, [paidFullClients, partialPayments, clients, calculateTotal]);

  const paidFullClientsList = useMemo(() => {
    // Return array of clients that paid in full with their details
    return Array.from(paidFullClients)
      .map((clientId) => {
        const client = clients.find((c) => c.id === clientId);
        return client ? client : null;
      })
      .filter((client): client is Client => client !== null);
  }, [paidFullClients, clients]);

  const handleSubmit = async () => {
    if (depositAmount === 0) {
      showToast({
        title: 'No amount to deposit',
        description: 'Please collect payments first',
        variant: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const clientIds = Array.from(paidFullClients);
      // Get payment IDs for the clients (from payments store)
      const paymentIds = payments
        .filter((p) => clientIds.includes(p.client_id))
        .map((p) => p.id);
      
      await submitDeposit(depositAmount, clientIds, paymentIds);
      showToast({
        title: 'Deposit submitted',
        description: `Successfully deposited ${new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
        }).format(depositAmount)}`,
        variant: 'success',
      });
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err?.message || 'Failed to submit deposit',
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Submit Deposit
        </h2>

        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-indigo-900">
                Total Amount:
              </span>
              <span className="text-2xl font-bold text-indigo-900">
                {new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                }).format(depositAmount)}
              </span>
            </div>
            <p className="text-xs text-indigo-700 mt-2">
              {paidFullClients.size} client(s) • {format(new Date(), "PPp")}
            </p>
          </div>

          {/* Client List */}
          {paidFullClientsList.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">
                Clients Included:
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {paidFullClientsList.map((client) => {
                  const partialAmount = partialPayments.get(client.id) || 0;
                  const fullAmount = calculateTotal(client); // Calculate from actual total tagihan
                  const amount = partialAmount > 0 ? partialAmount : fullAmount;
                  
                  return (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{client.name}</p>
                        <p className="text-sm text-slate-600">{client.phone || `ID: ${client.id}`}</p>
                      </div>
                      <span className="text-sm font-medium text-slate-900">
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                        }).format(amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
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
              onClick={handleSubmit}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              disabled={isSubmitting || depositAmount === 0}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Deposit'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

