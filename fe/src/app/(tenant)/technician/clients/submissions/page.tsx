"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/lib/hooks/useRole";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { Button } from "@/components/ui/button";
import { technicianService } from "@/lib/api/technicianService";
import { ClientSubmission } from "@/lib/api/types";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { PlusIcon } from "@heroicons/react/20/solid";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

export default function ClientSubmissionsPage() {
  const router = useRouter();
  const { userId } = useRole();
  const { showToast } = useNotificationStore();
  const [submissions, setSubmissions] = useState<ClientSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const status = statusFilter !== "all" ? statusFilter : undefined;
      const data = await technicianService.getClientSubmissions(userId, status);
      setSubmissions(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load client submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [userId, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "pending_admin_approval":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      case "pending_admin_approval":
        return "Pending Approval";
      default:
        return status;
    }
  };

  const filteredSubmissions =
    statusFilter === "all"
      ? submissions
      : submissions.filter((s) => s.status === statusFilter);

  if (error && submissions.length === 0) {
    return (
      <RoleGuard allowedRoles={["owner", "admin", "technician"]} redirectTo="/dashboard">
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={["owner", "admin", "technician"]} redirectTo="/dashboard">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">Client Submissions</h1>
          <Button onClick={() => router.push("/technician/clients/submit")}>
            <PlusIcon className="h-5 w-5 mr-2" /> Submit Client
          </Button>
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            size="sm"
          >
            All ({submissions.length})
          </Button>
          <Button
            variant={statusFilter === "pending_admin_approval" ? "default" : "outline"}
            onClick={() => setStatusFilter("pending_admin_approval")}
            size="sm"
          >
            Pending ({(submissions || []).filter((s) => s.status === "pending_admin_approval").length})
          </Button>
          <Button
            variant={statusFilter === "approved" ? "default" : "outline"}
            onClick={() => setStatusFilter("approved")}
            size="sm"
          >
            Approved ({(submissions || []).filter((s) => s.status === "approved").length})
          </Button>
          <Button
            variant={statusFilter === "rejected" ? "default" : "outline"}
            onClick={() => setStatusFilter("rejected")}
            size="sm"
          >
            Rejected ({(submissions || []).filter((s) => s.status === "rejected").length})
          </Button>
        </div>

        {/* Submissions List */}
        {loading && submissions.length === 0 ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>
              {statusFilter === "all"
                ? "No client submissions yet."
                : `No ${statusFilter} submissions.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-slate-900">{submission.name}</h3>
                    {submission.email && (
                      <p className="text-sm text-slate-600 mt-1">{submission.email}</p>
                    )}
                    {submission.phone && (
                      <p className="text-sm text-slate-600">{submission.phone}</p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(
                      submission.status
                    )}`}
                  >
                    {getStatusLabel(submission.status)}
                  </span>
                </div>

                {submission.address && (
                  <p className="text-sm text-slate-700 mb-2 line-clamp-2">{submission.address}</p>
                )}

                <div className="text-xs text-slate-500 mb-2">
                  Submitted: {format(new Date(submission.created_at), "PP")}
                </div>

                {submission.rejection_reason && submission.status === "rejected" && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-red-600">
                      <span className="font-medium">Rejection reason:</span>{" "}
                      {submission.rejection_reason}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}


