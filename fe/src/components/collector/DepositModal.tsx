'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useCollectorStore } from '@/stores/collectorStore';
import { useClientStore } from '@/stores/clientStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Client } from '@/lib/api/clientService';
import { useAuth } from '@/lib/hooks/useAuth';

interface DepositModalProps {
  onClose: () => void;
}

export function DepositModal({ onClose }: DepositModalProps) {
  const { 
    paidFullClients, 
    partialPayments, 
    payments,
    submitDeposit,
    todayCollection,
    markedClients 
  } = useCollectorStore();
  const { clients } = useClientStore();
  const { showToast } = useNotificationStore();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);


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

  // Calculate total amount to deposit
  const depositAmount = useMemo(() => {
    let total = 0;
    
    // Add from paid full clients - calculate from actual total tagihan
    paidFullClients.forEach((clientId) => {
      const client = markedClients.get(clientId);
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

  const includedClientsList = useMemo(() => {
    // Return array of all clients that have any collection today (full or partial)
    const allClientIds = new Set([
      ...Array.from(paidFullClients),
      ...Array.from(partialPayments.keys())
    ]);
    
    return Array.from(allClientIds)
      .map((clientId) => {
        const client = markedClients.get(clientId);
        return client ? client : null;
      })
      .filter((client): client is Client => client !== null);
  }, [paidFullClients, partialPayments, markedClients]);

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
      const clientIds = includedClientsList.map(c => c.id);
      // Get payment IDs for the clients (from payments store)
      const paymentIds = payments
        .filter((p) => clientIds.includes(p.client_id))
        .map((p) => p.id);
      
      await submitDeposit(depositAmount, clientIds, paymentIds, user?.id);
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
          {includedClientsList.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">
                Clients Included:
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {includedClientsList.map((client) => {
                  const partialAmount = partialPayments.get(client.id) || 0;
                  const fullAmount = calculateTotal(client); // Calculate from actual total tagihan
                  const isPaidFull = paidFullClients.has(client.id);
                  const amount = isPaidFull ? fullAmount : partialAmount;
                  
                  return (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{client.name}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-600">{client.phone || `ID: ${client.id}`}</span>
                          <span className={`px-1.5 py-0.5 rounded ${isPaidFull ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isPaidFull ? 'Full' : 'Partial'}
                          </span>
                        </div>
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

