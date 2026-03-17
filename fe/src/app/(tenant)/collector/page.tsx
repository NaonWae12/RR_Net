"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useCollectorStore } from "@/stores/collectorStore";
import { useClientStore } from "@/stores/clientStore";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useNotificationStore } from "@/stores/notificationStore";
import { useRole } from "@/lib/hooks/useRole";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { useAuth } from "@/lib/hooks/useAuth";
import { format, startOfDay, endOfDay } from "date-fns";
import { DepositModal } from "@/components/collector/DepositModal";
import { VerifySettlementDialog } from "@/components/settlement/VerifySettlementDialog";
import type { Client } from "@/lib/api/clientService";

export default function CollectorPage() {
  const {
    todayCollection,
    depositHistory,
    notHomeClients,
    paidFullClients,
    partialPayments,
    selectedDate,
    loading,
    error,
    markedClients,
    fetchTodayCollection,
    fetchDepositHistory,
    fetchPaymentsForDate,
    fetchAssignments,
    setSelectedDate,
    submitDeposit,
    depositModal,
    openDepositModal,
    closeDepositModal,
  } = useCollectorStore();
  const { clients } = useClientStore();
  const { showToast } = useNotificationStore();
  const { isTechnician } = useRole();
  const { isAuthenticated, user: currentUser } = useAuth();
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (currentUser?.id) {
      fetchTodayCollection();
      fetchDepositHistory(
        currentUser.id,
        startOfDay(new Date()),
        endOfDay(new Date())
      );
      fetchPaymentsForDate(selectedDate);
      fetchAssignments(selectedDate, currentUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedDate]); // Fetch when date changes

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

  // Get clients that are not home
  // Note: We store client IDs in notHomeClients Set
  // In real implementation, we'd fetch client details when needed
  const notHomeClientsList = useMemo(() => {
    return Array.from(notHomeClients).map((clientId) => {
      const client = markedClients.get(clientId);
      return {
        id: clientId,
        name: client ? client.name : `Client ${clientId.substring(0, 8)}...`,
      };
    });
  }, [notHomeClients, markedClients]);

  // Calculate total collected today (from paid full + partial payments)
  const totalCollectedToday = useMemo(() => {
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
  }, [paidFullClients, partialPayments, markedClients, calculateTotal]);

  // Collection list for detailed view
  const collectionList = useMemo(() => {
    const list: { id: string, name: string, amount: number, type: 'full' | 'partial' }[] = [];
    
    paidFullClients.forEach(clientId => {
      const client = markedClients.get(clientId);
      if (client) {
        list.push({
          id: clientId,
          name: client.name,
          amount: calculateTotal(client),
          type: 'full'
        });
      }
    });
    
    partialPayments.forEach((amount, clientId) => {
      const client = markedClients.get(clientId);
      if (client) {
        list.push({
          id: clientId,
          name: client.name,
          amount,
          type: 'partial'
        });
      }
    });

    return list;
  }, [paidFullClients, partialPayments, markedClients, calculateTotal]);

  const handleDeposit = () => {
    // Collect all unique client IDs from full and partial payments
    const clientIds = Array.from(new Set([
      ...Array.from(paidFullClients),
      ...Array.from(partialPayments.keys())
    ]));
    
    if (clientIds.length === 0) {
      showToast({
        title: 'No payments to deposit',
        description: 'Please collect payments first',
        variant: 'error',
      });
      return;
    }
    openDepositModal();
  };

  if (error) {
    return (
      <RoleGuard allowedRoles={["technician"]} redirectTo="/dashboard">
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-red-700">Error: {error}</p>
          </div>
        </div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={["technician"]} redirectTo="/dashboard">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Collector Summary</h1>
            <p className="text-sm text-slate-600 mt-1">
              Daily collection overview and deposit management
            </p>
          </div>
        </div>

        {/* Today's Collection Summary */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-white overflow-hidden relative shadow-xl shadow-slate-200">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-none mb-2">Total Collection Today</p>
                <p className="text-4xl font-black tracking-tighter">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    minimumFractionDigits: 0
                  }).format(totalCollectedToday)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                    {format(new Date(), "EEEE, MMMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>

            {collectionList.length > 0 && (
              <div className="space-y-3 mt-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800 pb-2">Client List ({collectionList.length})</p>
                <div className="max-h-60 overflow-y-auto pr-2 space-y-2.5 custom-scrollbar">
                  {collectionList.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:bg-white/10 transition-all">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{c.name}</span>
                        <div className="flex items-center gap-2">
                           <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                             c.type === 'full' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                           }`}>
                             {c.type === 'full' ? 'Lunas' : 'Partial'}
                           </span>
                           <span className="text-[10px] font-medium text-slate-500">
                             {new Intl.NumberFormat("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                minimumFractionDigits: 0
                              }).format(c.amount)}
                           </span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                         </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {collectionList.length === 0 && (
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-800/50 text-center">
                 <p className="text-sm font-bold text-slate-500 uppercase italic tracking-tighter">Belum ada penagihan hari ini</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleDeposit}
            disabled={paidFullClients.size === 0 && partialPayments.size === 0}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Setorkan
          </Button>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Clients Not Home ({notHomeClientsList.length})
          </h2>
          {notHomeClientsList.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <svg
                className="mx-auto h-12 w-12 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="mt-2 text-sm">No clients marked as not home</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notHomeClientsList.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div>
                    <p className="font-medium text-slate-900">{client.name}</p>
                    <p className="text-sm text-slate-600">ID: {client.id}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                    Not Home
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deposit History */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Deposit History
          </h2>
          {depositHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <svg
                className="mx-auto h-12 w-12 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-2 text-sm">No deposits today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {depositHistory.map((deposit) => (
                <div
                  key={`${deposit.collector_id}-${deposit.date}-${deposit.status}`}
                  onClick={() => {
                    setSelectedSettlement(deposit);
                    setIsDetailsOpen(true);
                  }}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                      }).format(deposit.amount)}
                    </p>
                    <p className="text-sm text-slate-600">
                      {deposit.count} client(s) • {format(new Date(deposit.date), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {deposit.status === "verified" && (
                      <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full border border-green-200">
                        Verified
                      </span>
                    )}
                    {deposit.status === "pending" && (
                      <span className="px-3 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                        Pending
                      </span>
                    )}
                    {deposit.status === "rejected" && (
                      <span className="px-3 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full border border-red-200">
                        Rejected
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details Dialog */}
        {selectedSettlement && (
          <VerifySettlementDialog
            isOpen={isDetailsOpen}
            onClose={() => {
              setIsDetailsOpen(false);
              setSelectedSettlement(null);
            }}
            settlementId={`${selectedSettlement.collector_id}|${selectedSettlement.date}|${selectedSettlement.status}`}
            settlementData={selectedSettlement}
            readOnly={true}
          />
        )}

        {/* Deposit Modal */}
        {depositModal.open && (
          <DepositModal onClose={closeDepositModal} />
        )}
      </div>
    </RoleGuard>
  );
}

