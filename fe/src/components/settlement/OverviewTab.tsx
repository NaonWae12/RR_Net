"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { VerifySettlementDialog } from "@/components/settlement/VerifySettlementDialog";
import { useNotificationStore } from "@/stores/notificationStore";
import { format, subDays } from "date-fns";
import { CheckCircleIcon, XCircleIcon, ClockIcon } from "@heroicons/react/20/solid";

import { billingService } from "@/lib/api/billingService";
import type { Settlement } from "@/lib/api/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function OverviewTab() {
  const queryClient = useQueryClient();
  const { showToast } = useNotificationStore();
  const [approving, setApproving] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [collectorFilter, setCollectorFilter] = useState<string>("");
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);

  // Fetch settlements
  const { data: settlements = [], isLoading: loading } = useQuery({
    queryKey: ["settlements", startDate, endDate],
    queryFn: () => billingService.getSettlements({ start_date: startDate, end_date: endDate }),
  });

  // Filter settlements
  const filteredSettlements = settlements.filter(s => {
    if (collectorFilter && s.collector_id !== collectorFilter) return false;
    return true;
  });

  const collectors = Array.from(new Set(settlements.map(s => JSON.stringify({id: s.collector_id, name: s.collector_name}))))
    .map(s => JSON.parse(s));

  // Calculate stats
  const pendingSettlements = filteredSettlements.filter((s) => s.status === "pending");
  const verifiedSettlements = filteredSettlements.filter((s) => s.status === "verified");
  const totalAmount = filteredSettlements.reduce((sum, s) => sum + s.amount, 0);
  const verifiedAmount = verifiedSettlements.reduce((sum, s) => sum + s.amount, 0);

  const verifyMutation = useMutation({
    mutationFn: (data: { collectorId: string; date: string }) =>
      billingService.verifySettlement(data.collectorId, data.date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      showToast({
        title: "Settlement Verified",
        description: "Settlement has been verified successfully.",
        variant: "success",
      });
      setApproving(null);
    },
    onError: (error: any) => {
      showToast({
        title: "Verification Failed",
        description: error?.message || "Failed to verify settlement.",
        variant: "error",
      });
      setApproving(null);
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">
            <CheckCircleIcon className="w-3 h-3" />
            Verified
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-red-100 text-red-800 border border-red-200">
            <XCircleIcon className="w-3 h-3" />
            Rejected
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800 border border-yellow-200">
            <ClockIcon className="w-3 h-3" />
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  const handleQuickApprove = async (collectorId: string, date: string) => {
    setApproving(collectorId);
    verifyMutation.mutate({ collectorId, date });
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-sm text-slate-500">Today's Settlements</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{settlements.length}</div>
          <div className="text-xs text-slate-500 mt-1">{formatCurrency(totalAmount)}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-sm text-slate-500">Pending Verification</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{pendingSettlements.length}</div>
          <div className="text-xs text-slate-500 mt-1">Requires action</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-sm text-slate-500">Verified Today</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{verifiedSettlements.length}</div>
          <div className="text-xs text-slate-500 mt-1">{formatCurrency(verifiedAmount)}</div>
        </div>
      </div>

      {/* Pending Settlements */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Pending Verifications</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-auto h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-auto h-9 text-xs"
              />
            </div>
            <SimpleSelect
              value={collectorFilter}
              onValueChange={setCollectorFilter}
              placeholder="All Collectors"
              className="w-44 h-9 text-xs"
            >
              <option value="">All Collectors</option>
              {collectors.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SimpleSelect>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        ) : pendingSettlements.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No pending settlements</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Collector</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoices</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Submission</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pendingSettlements.map((settlement) => (
                  <tr
                    key={`${settlement.collector_id}-${settlement.date}`}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => {
                      setSelectedSettlement(settlement);
                      setIsVerifyDialogOpen(true);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {settlement.collector_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(new Date(settlement.date), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {formatCurrency(settlement.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{settlement.count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {/* Using first_payment_at as approx submission time */}
                      {format(new Date(settlement.first_payment_at), "HH:mm")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(settlement.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickApprove(settlement.collector_id, settlement.date);
                        }}
                        disabled={approving === settlement.collector_id}
                      >
                        {approving === settlement.collector_id ? (
                          <>
                            <LoadingSpinner size={14} className="mr-1" />
                            Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="w-4 h-4 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Verify Settlement Dialog */}
      <VerifySettlementDialog
        isOpen={isVerifyDialogOpen}
        onClose={() => {
          setIsVerifyDialogOpen(false);
          setSelectedSettlement(null);
        }}
        settlementId={selectedSettlement ? `${selectedSettlement.collector_id}|${selectedSettlement.date}|${selectedSettlement.status}` : undefined}
        onVerified={() => {
          queryClient.invalidateQueries({ queryKey: ["settlements"] });
        }}
      />
    </div>
  );
}

