"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { hrService } from "@/lib/api/hrService";
import { Reimbursement } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useNotificationStore } from "@/stores/notificationStore";
import { Modal } from "@/components/ui/modal";
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  EyeIcon,
  ClockIcon,
  CurrencyDollarIcon
} from "@heroicons/react/20/solid";

export function ReimbursementTab() {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("submitted");
  const [selectedRb, setSelectedRb] = useState<Reimbursement | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const { showToast } = useNotificationStore();

  const fetchReimbursements = async () => {
    try {
      setLoading(true);
      const data = await hrService.getReimbursements(statusFilter === "all" ? undefined : statusFilter);
      setReimbursements(data);
    } catch (error: any) {
      showToast({
        title: "Error",
        description: error.message || "Failed to load reimbursements",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReimbursements();
  }, [statusFilter]);

  const handleApprove = async (rb: Reimbursement) => {
    setSelectedRb(rb);
    setShowApproveModal(true);
  };

  const confirmApprove = async () => {
    if (!selectedRb) return;
    try {
      setProcessing(true);
      await hrService.approveReimbursement(selectedRb.id);
      showToast({
        title: "Approved",
        description: "Reimbursement has been approved",
        variant: "success",
      });
      setShowApproveModal(false);
      setSelectedRb(null);
      fetchReimbursements();
    } catch (error: any) {
      showToast({
        title: "Error",
        description: error.message || "Failed to approve reimbursement",
        variant: "error",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRb || !rejectionReason.trim()) return;
    try {
      setProcessing(true);
      await hrService.rejectReimbursement(selectedRb.id, rejectionReason);
      showToast({
        title: "Rejected",
        description: "Reimbursement has been rejected",
        variant: "success",
      });
      setShowRejectModal(false);
      setRejectionReason("");
      setSelectedRb(null);
      fetchReimbursements();
    } catch (error: any) {
      showToast({
        title: "Error",
        description: error.message || "Failed to reject reimbursement",
        variant: "error",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <span className="px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-800 border border-blue-200">Submitted</span>;
      case "approved":
        return <span className="px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">Approved</span>;
      case "rejected":
        return <span className="px-2 py-1 text-xs font-medium rounded-md bg-red-100 text-red-800 border border-red-200">Rejected</span>;
      case "paid":
        return <span className="px-2 py-1 text-xs font-medium rounded-md bg-purple-100 text-purple-800 border border-purple-200">Paid</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-white border border-slate-200 rounded-lg p-1 w-fit">
          <button
            onClick={() => setStatusFilter("submitted")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              statusFilter === "submitted" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Pending Approval
          </button>
          <button
            onClick={() => setStatusFilter("approved")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              statusFilter === "approved" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              statusFilter === "all" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            All Requests
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <LoadingSpinner size={40} />
            </div>
          ) : reimbursements.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No reimbursement requests found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reimbursements.map((rb) => (
                  <tr key={rb.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {rb.user_name || "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 capitalize">
                      {rb.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(new Date(rb.date), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                      Rp {rb.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(rb.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRb(rb)}
                      >
                        <EyeIcon className="w-4 h-4 mr-1 text-slate-400" />
                        Details
                      </Button>
                      {rb.status === "submitted" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleApprove(rb)}
                            disabled={processing}
                          >
                            <CheckCircleIcon className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setSelectedRb(rb);
                              setShowRejectModal(true);
                            }}
                            disabled={processing}
                          >
                            <XCircleIcon className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={!!selectedRb && !showRejectModal && !showApproveModal}
        onClose={() => setSelectedRb(null)}
        title="Reimbursement Details"
      >
        {selectedRb && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</label>
                <div className="text-slate-900 font-medium">{selectedRb.user_name}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                <div>{getStatusBadge(selectedRb.status)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
                <div className="text-slate-900 capitalize">{selectedRb.category}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
                <div className="text-slate-900">{format(new Date(selectedRb.date), "MMMM d, yyyy")}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</label>
                <div className="text-lg font-bold text-slate-900">Rp {selectedRb.amount.toLocaleString()}</div>
              </div>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</label>
              <div className="text-slate-600 text-sm mt-1 bg-slate-50 p-3 rounded-md border border-slate-200">
                {selectedRb.description || "No description provided"}
              </div>
            </div>

            {selectedRb.attachment_url && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attachment</label>
                <div className="mt-2">
                  <a 
                    href={selectedRb.attachment_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    View Receipt Image
                  </a>
                </div>
              </div>
            )}

            {selectedRb.rejection_reason && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-md">
                <label className="text-xs font-semibold text-red-500 uppercase tracking-wider">Rejection Reason</label>
                <div className="text-red-700 text-sm mt-1">{selectedRb.rejection_reason}</div>
              </div>
            )}

            <div className="flex justify-end pt-4 gap-2">
              <Button variant="outline" onClick={() => setSelectedRb(null)}>Close</Button>
              {selectedRb.status === "submitted" && (
                <>
                  <Button 
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => setShowRejectModal(true)}
                  >
                    Reject
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleApprove(selectedRb)}
                  >
                    Approve Request
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Reimbursement"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason for Rejection
            </label>
            <textarea
              className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-32 p-3 border"
              placeholder="Please provide a reason why this request is being rejected..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white" 
              onClick={handleReject}
              disabled={!rejectionReason.trim() || processing}
            >
              {processing ? "Processing..." : "Confirm Rejection"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Confirm Approval"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm font-bold text-green-900">Approve Reimbursement?</p>
              <p className="text-xs text-green-700">This will mark the request as approved and notify the employee.</p>
            </div>
          </div>
          
          {selectedRb && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center mb-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <span>Employee</span>
                <span className="text-slate-900 font-black">{selectedRb.user_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</span>
                <span className="text-lg font-black text-slate-900">Rp {selectedRb.amount.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowApproveModal(false)}>Cancel</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white font-black" 
              onClick={confirmApprove}
              disabled={processing}
            >
              {processing ? "Approving..." : "Confirm & Approve"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Receipt({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
