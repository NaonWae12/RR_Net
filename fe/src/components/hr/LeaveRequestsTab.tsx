"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import { CheckCircleIcon, XCircleIcon, ClockIcon } from "@heroicons/react/20/solid";

// Mock data - akan diganti dengan API call
const mockLeaveRequests = [
  {
    id: "1",
    employeeName: "Budi Santoso",
    employeeId: "emp-1",
    type: "Sick Leave",
    dateFrom: new Date(),
    dateTo: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    reason: "Sakit demam",
    status: "pending",
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "2",
    employeeName: "Siti Nurhaliza",
    employeeId: "emp-2",
    type: "Annual Leave",
    dateFrom: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    dateTo: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    reason: "Liburan keluarga",
    status: "pending",
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "3",
    employeeName: "Ahmad Fauzi",
    employeeId: "emp-3",
    type: "Personal Leave",
    dateFrom: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    dateTo: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    reason: "Urusan keluarga",
    status: "approved",
    submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    reviewedBy: "Admin User",
    reviewedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
];

export function LeaveRequestsTab() {
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">
            <CheckCircleIcon className="w-3 h-3" />
            Approved
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

  const handleApprove = async (requestId: string) => {
    setApproving(requestId);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showToast({
        title: "Leave Request Approved",
        description: "The leave request has been approved",
        variant: "success",
      });
      // Refresh data
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (error: any) {
      showToast({
        title: "Approval Failed",
        description: error?.message || "Failed to approve leave request",
        variant: "error",
      });
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setRejecting(requestId);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showToast({
        title: "Leave Request Rejected",
        description: "The leave request has been rejected",
        variant: "success",
      });
      // Refresh data
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (error: any) {
      showToast({
        title: "Rejection Failed",
        description: error?.message || "Failed to reject leave request",
        variant: "error",
      });
    } finally {
      setRejecting(null);
    }
  };

  const filteredRequests = mockLeaveRequests.filter((request) => {
    if (statusFilter !== "all" && request.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <SimpleSelect value={statusFilter} onValueChange={setStatusFilter}>
              <option value="all" className="text-slate-900 bg-white">All Status</option>
              <option value="pending" className="text-slate-900 bg-white">Pending</option>
              <option value="approved" className="text-slate-900 bg-white">Approved</option>
              <option value="rejected" className="text-slate-900 bg-white">Rejected</option>
            </SimpleSelect>
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Leave Requests <span className="text-xs font-normal text-slate-500">(Permintaan Cuti)</span>
          </h2>
          <Button variant="outline" size="sm">
            Export
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No leave requests found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date Range</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Submitted</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {request.employeeName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{request.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(request.dateFrom, "MMM d")} - {format(request.dateTo, "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{request.reason}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(request.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(request.submittedAt, "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {request.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(request.id)}
                            disabled={approving === request.id}
                          >
                            {approving === request.id ? (
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(request.id)}
                            disabled={rejecting === request.id}
                          >
                            {rejecting === request.id ? (
                              <>
                                <LoadingSpinner size={14} className="mr-1" />
                                Rejecting...
                              </>
                            ) : (
                              <>
                                <XCircleIcon className="w-4 h-4 mr-1" />
                                Reject
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      {request.status !== "pending" && (
                        <span className="text-xs text-slate-500">
                          {request.reviewedBy} on {request.reviewedAt ? format(request.reviewedAt, "MMM d") : "-"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


