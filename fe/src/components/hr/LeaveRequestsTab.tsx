"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useNotificationStore } from "@/stores/notificationStore";
import { hrService } from "@/lib/api/hrService";
import { TimeOff } from "@/lib/api/types";
import { format, parseISO } from "date-fns";
import { CheckCircleIcon, XCircleIcon, ClockIcon } from "@heroicons/react/20/solid";

export function LeaveRequestsTab() {
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(false);
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  const fetchTimeOffs = async () => {
    try {
      setLoading(true);
      const status = statusFilter !== "all" ? statusFilter : undefined;
      const data = await hrService.getTimeOffs(status);
      setTimeOffs(data || []);
    } catch (error: any) {
      showToast({
        title: "Failed to load time off requests",
        description: error?.message || "An unexpected error occurred",
        variant: "error",
      });
      setTimeOffs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeOffs();
  }, [statusFilter]);

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
      case "pending_approval":
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "sick":
        return "Sick Leave";
      case "leave":
        return "Annual Leave";
      case "emergency":
        return "Emergency Leave";
      default:
        return type;
    }
  };

  const handleApprove = async (requestId: string) => {
    setApproving(requestId);
    try {
      await hrService.approveTimeOff(requestId);
      showToast({
        title: "Leave Request Approved",
        description: "The leave request has been approved",
        variant: "success",
      });
      await fetchTimeOffs();
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
    const reason = prompt("Please provide a reason for rejection:");
    if (!reason) {
      return; // User cancelled
    }

    setRejecting(requestId);
    try {
      await hrService.rejectTimeOff(requestId, reason);
      showToast({
        title: "Leave Request Rejected",
        description: "The leave request has been rejected",
        variant: "success",
      });
      await fetchTimeOffs();
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

  const filteredRequests = timeOffs.filter((request) => {
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
              <option value="pending_approval" className="text-slate-900 bg-white">Pending</option>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Days</th>
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
                      {request.user_name || "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{getTypeLabel(request.type)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(parseISO(request.start_date), "MMM d")} - {format(parseISO(request.end_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {request.days_count} day{request.days_count > 1 ? "s" : ""}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{request.reason}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(request.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(parseISO(request.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {request.status === "pending_approval" && (
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
                      {request.status !== "pending_approval" && (
                        <span className="text-xs text-slate-500">
                          {request.approved_at ? format(parseISO(request.approved_at), "MMM d, yyyy") : "-"}
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


