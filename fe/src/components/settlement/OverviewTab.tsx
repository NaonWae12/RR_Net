"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { VerifySettlementDialog } from "@/components/settlement/VerifySettlementDialog";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import { CheckCircleIcon, XCircleIcon, ClockIcon } from "@heroicons/react/20/solid";

// Mock data - akan diganti dengan API call
const mockSummary = {
  today: {
    totalSettlements: 12,
    pending: 5,
    verified: 6,
    rejected: 1,
    totalAmount: 4500000,
  },
  thisWeek: {
    totalSettlements: 45,
    pending: 8,
    verified: 34,
    rejected: 3,
    totalAmount: 18500000,
  },
};

const mockPendingSettlements = [
  {
    id: "1",
    collectorName: "Budi Santoso",
    collectorId: "collector-1",
    settlementDate: new Date(),
    amount: 500000,
    invoiceCount: 3,
    submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: "pending",
  },
  {
    id: "2",
    collectorName: "Siti Nurhaliza",
    collectorId: "collector-2",
    settlementDate: new Date(),
    amount: 750000,
    invoiceCount: 5,
    submittedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    status: "pending",
  },
  {
    id: "3",
    collectorName: "Ahmad Fauzi",
    collectorId: "collector-3",
    settlementDate: new Date(),
    amount: 300000,
    invoiceCount: 2,
    submittedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    status: "pending",
  },
];

export function OverviewTab() {
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [collectorFilter, setCollectorFilter] = useState<string>("");
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);

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

  const handleQuickApprove = async (settlementId: string) => {
    setApproving(settlementId);
    try {
      // Mock API call - akan diganti dengan actual API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      showToast({
        title: "Settlement Approved",
        description: "Settlement has been verified and approved",
        variant: "success",
      });

      // Refresh data after verification
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (error: any) {
      showToast({
        title: "Approval Failed",
        description: error?.message || "Failed to approve settlement",
        variant: "error",
      });
    } finally {
      setApproving(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-sm text-slate-500">Today's Settlements</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{mockSummary.today.totalSettlements}</div>
          <div className="text-xs text-slate-500 mt-1">{formatCurrency(mockSummary.today.totalAmount)}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-sm text-slate-500">Pending Verification</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{mockSummary.today.pending}</div>
          <div className="text-xs text-slate-500 mt-1">Requires action</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-sm text-slate-500">Verified Today</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{mockSummary.today.verified}</div>
          <div className="text-xs text-slate-500 mt-1">{formatCurrency(mockSummary.today.totalAmount * 0.6)}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-sm text-slate-500">This Week</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{mockSummary.thisWeek.totalSettlements}</div>
          <div className="text-xs text-slate-500 mt-1">{formatCurrency(mockSummary.thisWeek.totalAmount)}</div>
        </div>
      </div>

      {/* Pending Settlements */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Pending Verifications</h2>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-auto"
            />
            <SimpleSelect
              value={collectorFilter}
              onValueChange={setCollectorFilter}
              placeholder="All Collectors"
              className="w-48"
            >
              <option value="">All Collectors</option>
              <option value="collector-1">Budi Santoso</option>
              <option value="collector-2">Siti Nurhaliza</option>
              <option value="collector-3">Ahmad Fauzi</option>
            </SimpleSelect>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        ) : mockPendingSettlements.length === 0 ? (
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Submitted</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {mockPendingSettlements.map((settlement) => (
                  <tr
                    key={settlement.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => {
                      setSelectedSettlementId(settlement.id);
                      setIsVerifyDialogOpen(true);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {settlement.collectorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(settlement.settlementDate, "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {formatCurrency(settlement.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{settlement.invoiceCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(settlement.submittedAt, "HH:mm")} ({Math.floor((Date.now() - settlement.submittedAt.getTime()) / (60 * 60 * 1000))}h ago)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(settlement.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickApprove(settlement.id);
                        }}
                        disabled={approving === settlement.id}
                      >
                        {approving === settlement.id ? (
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
          setSelectedSettlementId(null);
        }}
        settlementId={selectedSettlementId || undefined}
        onVerified={() => {
          // Refresh data after verification
          // In real implementation, this would trigger a refetch
          setLoading(true);
          setTimeout(() => {
            setLoading(false);
          }, 500);
        }}
      />
    </div>
  );
}

