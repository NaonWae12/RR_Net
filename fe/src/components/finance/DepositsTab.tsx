"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format } from "date-fns";
import { CheckCircleIcon, XCircleIcon, ClockIcon } from "@heroicons/react/20/solid";

// Mock data untuk deposits (akan diganti dengan API call)
const mockPendingDeposits = [
  {
    id: "1",
    collectorName: "Budi Santoso",
    amount: 5000000,
    clientCount: 15,
    submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    paymentIds: ["p1", "p2", "p3"],
  },
  {
    id: "2",
    collectorName: "Siti Nurhaliza",
    amount: 3200000,
    clientCount: 8,
    submittedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    paymentIds: ["p4", "p5"],
  },
];

const mockDepositHistory = [
  {
    id: "3",
    collectorName: "Ahmad Fauzi",
    amount: 7500000,
    clientCount: 20,
    submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    confirmedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
    status: "confirmed",
  },
  {
    id: "4",
    collectorName: "Rina Wati",
    amount: 4200000,
    clientCount: 12,
    submittedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    confirmedAt: new Date(Date.now() - 47 * 60 * 60 * 1000),
    status: "confirmed",
  },
];

export function DepositsTab() {
  const [loading, setLoading] = useState(false);
  const [pendingDeposits, setPendingDeposits] = useState(mockPendingDeposits);
  const [depositHistory, setDepositHistory] = useState(mockDepositHistory);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleConfirmDeposit = async (depositId: string) => {
    setLoading(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Remove from pending and add to history
      const deposit = pendingDeposits.find((d) => d.id === depositId);
      if (deposit) {
        setPendingDeposits(pendingDeposits.filter((d) => d.id !== depositId));
        setDepositHistory([
          {
            ...deposit,
            confirmedAt: new Date(),
            status: "confirmed",
          },
          ...depositHistory,
        ]);
      }
    } catch (error: any) {
      console.error("Failed to confirm deposit:", error);
      alert("Failed to confirm deposit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectDeposit = async (depositId: string) => {
    if (!confirm("Are you sure you want to reject this deposit?")) {
      return;
    }
    setLoading(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Remove from pending
      setPendingDeposits(pendingDeposits.filter((d) => d.id !== depositId));
    } catch (error: any) {
      console.error("Failed to reject deposit:", error);
      alert("Failed to reject deposit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Deposits */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClockIcon className="w-6 h-6 text-yellow-500" />
            <h2 className="text-lg font-semibold text-slate-900">Pending Deposits</h2>
            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200 rounded-md">
              {pendingDeposits.length}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <LoadingSpinner size={32} />
            </div>
          ) : pendingDeposits.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No pending deposits</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Collector</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clients</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Submitted At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pendingDeposits.map((deposit) => (
                  <tr key={deposit.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {deposit.collectorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {formatCurrency(deposit.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {deposit.clientCount} clients
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(deposit.submittedAt, "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleConfirmDeposit(deposit.id)}
                          disabled={loading}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectDeposit(deposit.id)}
                          disabled={loading}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <XCircleIcon className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Deposit History */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Deposit History</h2>
        </div>
        <div className="overflow-x-auto">
          {depositHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No deposit history</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Collector</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clients</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Submitted At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Confirmed At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {depositHistory.map((deposit) => (
                  <tr key={deposit.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {deposit.collectorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {formatCurrency(deposit.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {deposit.clientCount} clients
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(deposit.submittedAt, "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {deposit.confirmedAt ? format(deposit.confirmedAt, "MMM d, yyyy HH:mm") : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">
                        <CheckCircleIcon className="w-3 h-3 mr-1" />
                        {deposit.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

