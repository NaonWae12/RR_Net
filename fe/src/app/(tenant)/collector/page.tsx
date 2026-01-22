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
import { format } from "date-fns";
import { DepositModal } from "@/components/collector/DepositModal";
import servicePackageService, { ServicePackage } from "@/lib/api/servicePackageService";
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
    fetchTodayCollection,
    fetchDepositHistory,
    fetchPaymentsForDate,
    setSelectedDate,
    submitDeposit,
    depositModal,
    openDepositModal,
    closeDepositModal,
  } = useCollectorStore();
  const { clients } = useClientStore();
  const { showToast } = useNotificationStore();
  const { isTechnician } = useRole();
  const { isAuthenticated } = useAuth();
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

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTodayCollection();
    fetchDepositHistory();
    fetchPaymentsForDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedDate]); // Fetch when date changes

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

  // Get clients that are not home
  // Note: We store client IDs in notHomeClients Set
  // In real implementation, we'd fetch client details when needed
  const notHomeClientsList = useMemo(() => {
    // Return array of client IDs that are not home
    // For display, we'll just show the IDs for now
    return Array.from(notHomeClients).map((clientId) => ({
      id: clientId,
      name: `Client ${clientId.substring(0, 8)}...`, // Placeholder
    }));
  }, [notHomeClients]);

  // Calculate total collected today (from paid full + partial payments)
  const totalCollectedToday = useMemo(() => {
    let total = 0;

    // Add from paid full clients - calculate from actual total tagihan
    paidFullClients.forEach((clientId) => {
      const client: Client | undefined = clients.find((c) => c.id === clientId);
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

  const handleDeposit = () => {
    const clientIds = Array.from(paidFullClients);
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
        <div className="bg-linear-to-r from-indigo-500 to-indigo-600 rounded-lg border border-indigo-200 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-indigo-100 text-sm font-medium">Today's Collection</p>
              <p className="text-3xl font-bold mt-2">
                {new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                }).format(totalCollectedToday)}
              </p>
              <p className="text-indigo-100 text-xs mt-1">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleDeposit}
            disabled={paidFullClients.size === 0}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Setorkan
          </Button>
        </div>

        {/* Not Home Clients List */}
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
                  key={deposit.date}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                      }).format(deposit.amount)}
                    </p>
                    <p className="text-sm text-slate-600">
                      {deposit.client_count} client(s) • {format(new Date(deposit.date), "PPp")}
                    </p>
                  </div>
                  <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded">
                    Deposited
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deposit Modal */}
        {depositModal.open && (
          <DepositModal onClose={closeDepositModal} />
        )}
      </div>
    </RoleGuard>
  );
}

