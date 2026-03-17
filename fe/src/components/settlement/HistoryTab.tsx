"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { VerifySettlementDialog } from "@/components/settlement/VerifySettlementDialog";
import { useAuth } from "@/lib/hooks/useAuth";
import { format, subDays } from "date-fns";
import { CheckCircleIcon, XCircleIcon, ClockIcon, ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import { billingService } from "@/lib/api/billingService";



interface HistoryTabProps {
  collectorView?: boolean;
}

export function HistoryTab({ collectorView = false }: HistoryTabProps) {
  const [dateFrom, setDateFrom] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [collectorFilter, setCollectorFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const { user } = useAuth();

  const { data: settlements = [], isLoading: loading } = useQuery({
    queryKey: ["settlements-history", dateFrom, dateTo, statusFilter, collectorFilter, collectorView, user?.id],
    queryFn: () => billingService.getSettlements({ 
      start_date: dateFrom, 
      end_date: dateTo, 
      status: statusFilter as any,
      collector_id: collectorView ? user?.id : collectorFilter || undefined
    }),
  });

  const filteredHistory = settlements.filter(item => {
    if (collectorView && item.collector_id !== user?.id) return false;
    if (collectorFilter && item.collector_id !== collectorFilter) return false;
    return true;
  });
  const collectors = Array.from(new Set(settlements.map(s => JSON.stringify({id: s.collector_id, name: s.collector_name}))))
    .map(s => JSON.parse(s));

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

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {collectorView ? "My Settlement History" : "Settlement History"}
          </h2>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {!collectorView && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Collector</label>
              <SimpleSelect
                value={collectorFilter}
                onValueChange={setCollectorFilter}
                placeholder="All Collectors"
              >
                <option value="">All Collectors</option>
                {collectors.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </SimpleSelect>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <SimpleSelect value={statusFilter} onValueChange={setStatusFilter} placeholder="All Status">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="verified_with_discrepancy">Verified (Mismatch)</option>
            </SimpleSelect>
          </div>
        </div>

        {/* History Table */}
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No settlement history found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {!collectorView && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Collector</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                  {!collectorView && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Verified Amount
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoices</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Submitted</th>
                  {!collectorView && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Verified By</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredHistory.map((item, index) => {
                  const syntheticId = `${item.collector_id}|${item.date}-${index}`;
                  return (
                    <tr key={syntheticId} className="hover:bg-slate-50">
                      {!collectorView && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {item.collector_name || "N/A"}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {format(new Date(item.date), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {formatCurrency(item.amount)}
                      </td>
                      {!collectorView && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.status === 'verified' ? formatCurrency(item.amount) : "-"}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {format(new Date(item.first_payment_at), "MMM d, HH:mm")}
                      </td>
                      {!collectorView && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.status === 'verified' ? 'System' : "-"}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSettlement(item);
                            setIsViewDialogOpen(true);
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Settlement Dialog (Read-only) */}
      {selectedSettlement && (
        <VerifySettlementDialog
          isOpen={isViewDialogOpen}
          onClose={() => {
            setIsViewDialogOpen(false);
            setSelectedSettlement(null);
          }}
          settlementId={selectedSettlement ? `${selectedSettlement.collector_id}|${selectedSettlement.date}` : undefined}
          settlementData={selectedSettlement}
          readOnly={true}
        />
      )}
    </div>
  );
}

