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

import { billingService } from "@/lib/api/billingService";
import type { Payment } from "@/lib/api/types";

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
  // settlement state now holds Payment[] and summary info
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const [action, setAction] = useState<"approve" | "reject" | "mismatch" | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [rejectionNote, setRejectionNote] = useState<string>("");
  const [mismatchAmount, setMismatchAmount] = useState<string>("");

  useEffect(() => {
    if (isOpen && settlementId) {
      const parts = settlementId.split("|");
      const collectorId = parts[0];
      const dateStr = parts[1];
      const status = parts[2] as any;

      if (collectorId && dateStr) {
        setLoading(true);
        // Fetch detailed payments for this specific settlement status
        billingService.getPayments({
          collector_id: collectorId,
          start_date: dateStr,
          end_date: dateStr,
          status: status, // Filter by the specific group status
          page_size: 100
        } as any).then((res: any) => {
          setPayments(res.data || []);
        }).catch((err) => {
          console.error("Failed to fetch detailed payments", err);
        });

        // Fetch settlement list but narrow down to the specific one by using status + collector_id filter
        billingService.getSettlements({ start_date: dateStr, end_date: dateStr, status: status, collector_id: collectorId } as any).then((res) => {
             const s = res.find(i => i.collector_id === collectorId && i.status === status);
             if (s) {
                 setSummary({
                     collectorName: s.collector_name,
                     settlementDate: new Date(s.date),
                     submittedAmount: s.amount,
                     invoiceCount: s.count,
                     submittedAt: new Date(s.first_payment_at),
                     status: s.status,
                     qrToken: `SETTLEMENT-${s.collector_id}-${s.date}`,
                     collectorId: s.collector_id,
                     date: s.date
                 });
             }
             setLoading(false);
         }).catch(() => setLoading(false));
      }
    }
  }, [isOpen, settlementId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleApprove = async () => {
    if (!summary) return;
    setVerifying(true);
    try {
      await billingService.verifySettlement(summary.collectorId, summary.date);
      
      showToast({
        title: "Settlement Approved",
        description: "Settlement has been verified and approved",
        variant: "success",
      });
      
      // Update local state to reflect change immediately
      setSummary({ ...summary, status: "verified" });
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
      setSummary({ ...summary, status: "rejected" });
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
      setSummary({
        ...summary,
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
          {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <div className="text-sm text-slate-500">Collector</div>
                <div className="text-base font-medium text-slate-900">{summary.collectorName}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Settlement Date</div>
                <div className="text-base font-medium text-slate-900">
                  {format(summary.settlementDate, "MMM d, yyyy")}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500">First Payment At</div>
                <div className="text-base font-medium text-slate-900">
                  {format(summary.submittedAt, "MMM d, yyyy HH:mm")}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm text-slate-500">Total Amount</div>
                <div className="text-lg font-bold text-slate-900">{formatCurrency(summary.submittedAmount)}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Number of Payments</div>
                <div className="text-base font-medium text-slate-900">{summary.invoiceCount}</div>
              </div>
            </div>
          </div>
          )}

          {/* Invoices List Placeholder - To actulaly list invoices we need another API call. 
              For now we hide this or show a message */}
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Payments Details</h3>
            {payments.length > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2">Client</th>
                      <th className="px-4 py-2">Amount</th>
                      <th className="px-4 py-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 font-medium text-slate-900">{p.client_name}</td>
                        <td className="px-4 py-2 text-slate-700">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-2 text-slate-500 text-right">
                          {format(new Date(p.received_at), "HH:mm")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                    <tr>
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2">{formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}</td>
                      <td className="px-4 py-2 text-right">{payments.length} items</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No individual payment records found.</p>
            )}
          </div>

          {/* Action Buttons */}
          {!readOnly && summary && summary.status === "pending" && !action && (
            <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => setAction("approve")}
                className="flex-1"
              >
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                Approve
              </Button>
            </div>
          )}

          {/* Approval Info (for read-only/history view) */}
          {readOnly && summary && summary.status !== "pending" && (
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-base font-semibold text-slate-900">Verification Details</h3>

              {summary.status === "verified" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-green-900">Settlement Verified</div>
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
                    value={formatCurrency(summary.submittedAmount)}
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
                    Difference: {mismatchAmount ? formatCurrency(Number(mismatchAmount) - summary.submittedAmount) : "-"}
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
          {!readOnly && summary && summary.status !== "pending" && (
            <div className="border-t border-slate-200 pt-4">
              <div
                className={`rounded-lg p-4 ${summary.status === "verified"
                  ? "bg-green-50 border border-green-200"
                  : summary.status === "rejected"
                    ? "bg-red-50 border border-red-200"
                    : "bg-yellow-50 border border-yellow-200"
                  }`}
              >
                <div className="font-medium">
                  {summary.status === "verified" && "Settlement Verified"}
                  {summary.status === "rejected" && "Settlement Rejected"}
                  {summary.status === "verified_with_discrepancy" && "Settlement Verified with Discrepancy"}
                </div>
                {summary.verifiedAmount && (
                  <div className="text-sm mt-1">
                    Verified Amount: {formatCurrency(summary.verifiedAmount)}
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
const rejectionReasons = [
  { value: "mismatch_amount", label: "Amount Mismatch" },
  { value: "invalid_proof", label: "Invalid Proof of Deposit" },
  { value: "missing_invoices", label: "Missing Invoices" },
  { value: "qr_expired", label: "Expired QR Code" },
  { value: "other", label: "Other" },
];
