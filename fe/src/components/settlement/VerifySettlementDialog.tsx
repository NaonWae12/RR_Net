"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/modals/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/20/solid";

// Mock data - akan diganti dengan API call
const mockSettlement = {
  id: "1",
  collectorName: "Budi Santoso",
  collectorId: "collector-1",
  settlementDate: new Date(),
  submittedAmount: 500000,
  verifiedAmount: null as number | null,
  verifiedBy: undefined as string | undefined,
  verifiedAt: undefined as Date | undefined,
  rejectionReason: undefined as string | undefined,
  rejectionNote: undefined as string | undefined,
  invoiceCount: 3,
  submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  status: "pending",
  qrToken: "SETTLEMENT-1234567890-collector-1",
  invoices: [
    { id: "inv-1", number: "INV-001", amount: 200000, clientName: "Client A" },
    { id: "inv-2", number: "INV-002", amount: 200000, clientName: "Client B" },
    { id: "inv-3", number: "INV-003", amount: 100000, clientName: "Client C" },
  ],
};

const rejectionReasons = [
  { value: "qr_expired", label: "QR Code Expired" },
  { value: "qr_invalid", label: "QR Code Invalid" },
  { value: "amount_mismatch", label: "Amount Mismatch" },
  { value: "invoice_mismatch", label: "Invoice Mismatch" },
  { value: "other", label: "Other" },
];

interface VerifySettlementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settlementId?: string;
  settlementData?: any; // Pre-loaded settlement data (for history view)
  readOnly?: boolean; // If true, show read-only view with approval info
  onVerified?: () => void;
}

export function VerifySettlementDialog({
  isOpen,
  onClose,
  settlementId,
  settlementData,
  readOnly = false,
  onVerified,
}: VerifySettlementDialogProps) {
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [settlement, setSettlement] = useState(mockSettlement);
  const [action, setAction] = useState<"approve" | "reject" | "mismatch" | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [rejectionNote, setRejectionNote] = useState<string>("");
  const [mismatchAmount, setMismatchAmount] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      if (settlementData) {
        // Use provided settlement data (for history view)
        setSettlement(settlementData);
        setLoading(false);
      } else if (settlementId) {
        // Load settlement detail - akan diganti dengan API call
        setLoading(true);
        setTimeout(() => {
          setLoading(false);
        }, 500);
      }
    }
  }, [isOpen, settlementId, settlementData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleApprove = async () => {
    setVerifying(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showToast({
        title: "Settlement Approved",
        description: "Settlement has been verified and approved",
        variant: "success",
      });
      setSettlement({ ...settlement, status: "verified" });
      setAction(null);
      onVerified?.();
      // Auto close after 1 second
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error: any) {
      showToast({
        title: "Approval Failed",
        description: error?.message || "Failed to approve settlement",
        variant: "error",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason) {
      showToast({
        title: "Validation Error",
        description: "Please select a rejection reason",
        variant: "error",
      });
      return;
    }

    setVerifying(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showToast({
        title: "Settlement Rejected",
        description: "Settlement has been rejected",
        variant: "success",
      });
      setSettlement({ ...settlement, status: "rejected" });
      setAction(null);
      setRejectionReason("");
      setRejectionNote("");
      onVerified?.();
      // Auto close after 1 second
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error: any) {
      showToast({
        title: "Rejection Failed",
        description: error?.message || "Failed to reject settlement",
        variant: "error",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleMarkMismatch = async () => {
    if (!mismatchAmount || isNaN(Number(mismatchAmount))) {
      showToast({
        title: "Validation Error",
        description: "Please enter a valid amount",
        variant: "error",
      });
      return;
    }

    setVerifying(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showToast({
        title: "Mismatch Recorded",
        description: "Settlement verified with amount discrepancy",
        variant: "success",
      });
      setSettlement({
        ...settlement,
        status: "verified_with_discrepancy",
        verifiedAmount: Number(mismatchAmount),
      });
      setAction(null);
      setMismatchAmount("");
      onVerified?.();
      // Auto close after 1 second
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error: any) {
      showToast({
        title: "Verification Failed",
        description: error?.message || "Failed to verify settlement",
        variant: "error",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setAction(null);
    setRejectionReason("");
    setRejectionNote("");
    setMismatchAmount("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="xl"
      title="Verify Settlement"
      className="bg-white"
    >
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={40} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Settlement Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <div className="text-sm text-slate-500">Collector</div>
                <div className="text-base font-medium text-slate-900">{settlement.collectorName}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Settlement Date</div>
                <div className="text-base font-medium text-slate-900">
                  {format(settlement.settlementDate, "MMM d, yyyy")}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Submitted At</div>
                <div className="text-base font-medium text-slate-900">
                  {format(settlement.submittedAt, "MMM d, yyyy HH:mm")}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm text-slate-500">Submitted Amount</div>
                <div className="text-lg font-bold text-slate-900">{formatCurrency(settlement.submittedAmount)}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Number of Invoices</div>
                <div className="text-base font-medium text-slate-900">{settlement.invoiceCount}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">QR Token</div>
                <div className="text-xs font-mono text-slate-600">{settlement.qrToken}</div>
              </div>
            </div>
          </div>

          {/* Invoices List */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Invoices</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Invoice Number</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {settlement.invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-4 py-2 text-sm font-medium text-slate-900">{invoice.number}</td>
                      <td className="px-4 py-2 text-sm text-slate-600">{invoice.clientName}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium text-slate-900">
                        {formatCurrency(invoice.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={2} className="px-4 py-2 text-sm text-slate-900">
                      Total
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-slate-900">
                      {formatCurrency(settlement.submittedAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons - Only show if not read-only and status is pending */}
          {!readOnly && settlement.status === "pending" && !action && (
            <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => setAction("approve")}
                className="flex-1"
              >
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setAction("reject")}
                className="flex-1"
              >
                <XCircleIcon className="w-5 h-5 mr-2" />
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={() => setAction("mismatch")}
                className="flex-1"
              >
                <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                Mark Mismatch
              </Button>
            </div>
          )}

          {/* Approval Info (for read-only/history view) */}
          {readOnly && settlement.status !== "pending" && (
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-base font-semibold text-slate-900">Verification Details</h3>

              {settlement.status === "verified" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-green-900">Settlement Verified</div>
                      <div className="text-sm text-green-700 mt-1">
                        Verified by: {settlement.verifiedBy || "Admin"}
                      </div>
                      {settlement.verifiedAt && (
                        <div className="text-sm text-green-700">
                          Verified at: {format(settlement.verifiedAt, "MMM d, yyyy HH:mm")}
                        </div>
                      )}
                      {settlement.verifiedAmount && (
                        <div className="text-sm text-green-700 mt-1">
                          Verified Amount: {formatCurrency(settlement.verifiedAmount)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {settlement.status === "verified_with_discrepancy" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-yellow-900">Settlement Verified with Discrepancy</div>
                      <div className="text-sm text-yellow-700 mt-1">
                        Verified by: {settlement.verifiedBy || "Admin"}
                      </div>
                      {settlement.verifiedAt && (
                        <div className="text-sm text-yellow-700">
                          Verified at: {format(settlement.verifiedAt, "MMM d, yyyy HH:mm")}
                        </div>
                      )}
                      <div className="mt-2 space-y-1">
                        <div className="text-sm text-yellow-700">
                          <span className="font-medium">Submitted Amount:</span> {formatCurrency(settlement.submittedAmount)}
                        </div>
                        {settlement.verifiedAmount && (
                          <div className="text-sm text-yellow-700">
                            <span className="font-medium">Verified Amount:</span> {formatCurrency(settlement.verifiedAmount)}
                          </div>
                        )}
                        {settlement.verifiedAmount && (
                          <div className="text-sm text-yellow-800 font-medium">
                            <span className="font-medium">Difference:</span> {formatCurrency(settlement.verifiedAmount - settlement.submittedAmount)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {settlement.status === "rejected" && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <XCircleIcon className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-red-900">Settlement Rejected</div>
                      <div className="text-sm text-red-700 mt-1">
                        Rejected by: {settlement.verifiedBy || "Admin"}
                      </div>
                      {settlement.verifiedAt && (
                        <div className="text-sm text-red-700">
                          Rejected at: {format(settlement.verifiedAt, "MMM d, yyyy HH:mm")}
                        </div>
                      )}
                      {settlement.rejectionReason && (
                        <div className="mt-2">
                          <div className="text-sm font-medium text-red-900">Rejection Reason:</div>
                          <div className="text-sm text-red-700 mt-1">
                            {rejectionReasons.find((r) => r.value === settlement.rejectionReason)?.label || settlement.rejectionReason}
                          </div>
                        </div>
                      )}
                      {settlement.rejectionNote && (
                        <div className="mt-2">
                          <div className="text-sm font-medium text-red-900">Additional Notes:</div>
                          <div className="text-sm text-red-700 mt-1">{settlement.rejectionNote}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Forms */}
          {action === "approve" && (
            <div className="border-t border-slate-200 pt-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                  <div>
                    <div className="font-medium text-green-900">Approve Settlement</div>
                    <div className="text-sm text-green-700 mt-1">
                      This will verify the settlement and create payment records. This action cannot be undone.
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleApprove} disabled={verifying} className="flex-1">
                  {verifying ? <LoadingSpinner size={16} className="mr-2" /> : null}
                  Confirm Approve
                </Button>
                <Button variant="outline" onClick={() => setAction(null)} disabled={verifying} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {action === "reject" && (
            <div className="border-t border-slate-200 pt-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <XCircleIcon className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                  <div>
                    <div className="font-medium text-red-900">Reject Settlement</div>
                    <div className="text-sm text-red-700 mt-1">
                      Please provide a reason for rejection. The collector will be notified.
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rejection Reason</label>
                  <SimpleSelect
                    value={rejectionReason}
                    onValueChange={setRejectionReason}
                    placeholder="Select reason"
                  >
                    <option value="">Select reason</option>
                    {rejectionReasons.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </SimpleSelect>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes (Optional)</label>
                  <textarea
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                    rows={3}
                    placeholder="Add any additional notes..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleReject} disabled={verifying || !rejectionReason} variant="destructive" className="flex-1">
                    {verifying ? <LoadingSpinner size={16} className="mr-2" /> : null}
                    Confirm Reject
                  </Button>
                  <Button variant="outline" onClick={() => setAction(null)} disabled={verifying} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {action === "mismatch" && (
            <div className="border-t border-slate-200 pt-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                  <div>
                    <div className="font-medium text-yellow-900">Mark as Mismatch</div>
                    <div className="text-sm text-yellow-700 mt-1">
                      Enter the actual amount received. This will flag the settlement for review.
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Submitted Amount</label>
                  <Input
                    type="text"
                    value={formatCurrency(settlement.submittedAmount)}
                    disabled
                    className="bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Actual Amount Received</label>
                  <Input
                    type="number"
                    value={mismatchAmount}
                    onChange={(e) => setMismatchAmount(e.target.value)}
                    placeholder="Enter actual amount"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Difference: {mismatchAmount ? formatCurrency(Number(mismatchAmount) - settlement.submittedAmount) : "-"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleMarkMismatch} disabled={verifying || !mismatchAmount} className="flex-1">
                    {verifying ? <LoadingSpinner size={16} className="mr-2" /> : null}
                    Verify with Mismatch
                  </Button>
                  <Button variant="outline" onClick={() => setAction(null)} disabled={verifying} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Status Display - Only show if not read-only (read-only uses Approval Info section above) */}
          {!readOnly && settlement.status !== "pending" && (
            <div className="border-t border-slate-200 pt-4">
              <div
                className={`rounded-lg p-4 ${settlement.status === "verified"
                  ? "bg-green-50 border border-green-200"
                  : settlement.status === "rejected"
                    ? "bg-red-50 border border-red-200"
                    : "bg-yellow-50 border border-yellow-200"
                  }`}
              >
                <div className="font-medium">
                  {settlement.status === "verified" && "Settlement Verified"}
                  {settlement.status === "rejected" && "Settlement Rejected"}
                  {settlement.status === "verified_with_discrepancy" && "Settlement Verified with Discrepancy"}
                </div>
                {settlement.verifiedAmount && (
                  <div className="text-sm mt-1">
                    Verified Amount: {formatCurrency(settlement.verifiedAmount)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

