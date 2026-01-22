"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { VerifySettlementDialog } from "@/components/settlement/VerifySettlementDialog";
import { format } from "date-fns";
import { CheckCircleIcon, XCircleIcon, ClockIcon, ExclamationTriangleIcon } from "@heroicons/react/20/solid";

// Mock data - akan diganti dengan API call
const mockHistory = [
  {
    id: "1",
    collectorName: "Budi Santoso",
    collectorId: "collector-1",
    settlementDate: new Date(),
    amount: 500000,
    verifiedAmount: 500000,
    invoiceCount: 3,
    status: "verified",
    submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    verifiedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    verifiedBy: "Admin User",
    qrToken: "SETTLEMENT-1234567890-collector-1",
    invoices: [
      { id: "inv-1", number: "INV-001", amount: 200000, clientName: "Client A" },
      { id: "inv-2", number: "INV-002", amount: 200000, clientName: "Client B" },
      { id: "inv-3", number: "INV-003", amount: 100000, clientName: "Client C" },
    ],
    rejectionReason: null,
    rejectionNote: null,
  },
  {
    id: "2",
    collectorName: "Siti Nurhaliza",
    collectorId: "collector-2",
    settlementDate: new Date(),
    amount: 750000,
    verifiedAmount: 750000,
    invoiceCount: 5,
    status: "verified",
    submittedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    verifiedAt: new Date(Date.now() - 44 * 60 * 60 * 1000),
    verifiedBy: "Admin User",
    qrToken: "SETTLEMENT-1234567891-collector-2",
    invoices: [
      { id: "inv-4", number: "INV-004", amount: 300000, clientName: "Client D" },
      { id: "inv-5", number: "INV-005", amount: 250000, clientName: "Client E" },
      { id: "inv-6", number: "INV-006", amount: 200000, clientName: "Client F" },
    ],
    rejectionReason: null,
    rejectionNote: null,
  },
  {
    id: "3",
    collectorName: "Ahmad Fauzi",
    collectorId: "collector-3",
    settlementDate: new Date(),
    amount: 300000,
    verifiedAmount: 250000,
    invoiceCount: 2,
    status: "verified_with_discrepancy",
    submittedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    verifiedAt: new Date(Date.now() - 68 * 60 * 60 * 1000),
    verifiedBy: "Admin User",
    qrToken: "SETTLEMENT-1234567892-collector-3",
    invoices: [
      { id: "inv-7", number: "INV-007", amount: 150000, clientName: "Client G" },
      { id: "inv-8", number: "INV-008", amount: 150000, clientName: "Client H" },
    ],
    rejectionReason: null,
    rejectionNote: null,
  },
  {
    id: "4",
    collectorName: "Budi Santoso",
    collectorId: "collector-1",
    settlementDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    amount: 400000,
    verifiedAmount: null,
    invoiceCount: 2,
    status: "rejected",
    submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    verifiedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    verifiedBy: "Admin User",
    qrToken: "SETTLEMENT-1234567893-collector-1",
    invoices: [
      { id: "inv-9", number: "INV-009", amount: 200000, clientName: "Client I" },
      { id: "inv-10", number: "INV-010", amount: 200000, clientName: "Client J" },
    ],
    rejectionReason: "qr_expired",
    rejectionNote: "QR code was expired when collector tried to submit",
  },
];

interface HistoryTabProps {
  collectorView?: boolean;
}

export function HistoryTab({ collectorView = false }: HistoryTabProps) {
  const [loading, setLoading] = useState(false);
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
      case "verified_with_discrepancy":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-orange-100 text-orange-800 border border-orange-200">
            <ExclamationTriangleIcon className="w-3 h-3" />
            Verified (Mismatch)
          </span>
        );
      default:
        return null;
    }
  };

  const filteredHistory = mockHistory.filter((item) => {
    if (collectorView && item.collectorId !== "collector-1") return false; // Mock: current collector
    if (collectorFilter && item.collectorId !== collectorFilter) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    const itemDate = new Date(item.settlementDate);
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    if (itemDate < fromDate || itemDate > toDate) return false;
    return true;
  });

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
                <option value="collector-1">Budi Santoso</option>
                <option value="collector-2">Siti Nurhaliza</option>
                <option value="collector-3">Ahmad Fauzi</option>
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
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    {!collectorView && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {item.collectorName}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(item.settlementDate, "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {formatCurrency(item.amount)}
                    </td>
                    {!collectorView && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.verifiedAmount ? formatCurrency(item.verifiedAmount) : "-"}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.invoiceCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(item.submittedAt, "MMM d, HH:mm")}
                    </td>
                    {!collectorView && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.verifiedAt ? (
                          <div>
                            <div>{item.verifiedBy}</div>
                            <div className="text-xs text-slate-500">{format(item.verifiedAt, "MMM d, HH:mm")}</div>
                          </div>
                        ) : (
                          "-"
                        )}
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
                ))}
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
          settlementId={selectedSettlement.id}
          settlementData={selectedSettlement}
          readOnly={true}
        />
      )}
    </div>
  );
}

