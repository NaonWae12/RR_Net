"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useRole } from "@/lib/hooks/useRole";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { ReimbursementCard } from "@/components/technician/ReimbursementCard";
import { ReimbursementForm } from "@/components/technician/ReimbursementForm";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { technicianService } from "@/lib/api/technicianService";
import { Reimbursement, CreateReimbursementRequest } from "@/lib/api/types";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { PlusIcon } from "@heroicons/react/20/solid";
import { useAuth } from "@/lib/hooks/useAuth";

export default function ReimbursementPage() {
    const router = useRouter();
    const { userId } = useRole();
    const { showToast } = useNotificationStore();
    const { isAuthenticated } = useAuth();
    const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
    const [selectedReimbursement, setSelectedReimbursement] = useState<Reimbursement | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchReimbursements = async () => {
        if (!userId || !isAuthenticated) return;
        try {
            setLoading(true);
            setError(null);
            const status = statusFilter !== "all" ? statusFilter : undefined;
            const data = await technicianService.getReimbursements(userId, status);
            setReimbursements(data || []);
        } catch (err: any) {
            setError(err?.message || "Failed to load reimbursements");
            setReimbursements([]); // Reset to empty array on error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReimbursements();
    }, [userId, statusFilter, isAuthenticated]);

    const handleSubmit = async (data: CreateReimbursementRequest) => {
        try {
            setSubmitting(true);
            await technicianService.createReimbursement(data);
            showToast({
                title: "Reimbursement submitted",
                description: "Your reimbursement request has been submitted and is waiting for approval.",
                variant: "success",
            });
            setShowForm(false);
            await fetchReimbursements();
        } catch (err: any) {
            showToast({
                title: "Failed to submit reimbursement",
                description: err?.message || "An unexpected error occurred.",
                variant: "error",
            });
            throw err;
        } finally {
            setSubmitting(false);
        }
    };

    const handleView = async (id: string) => {
        try {
            const reimbursement = await technicianService.getReimbursement(id);
            setSelectedReimbursement(reimbursement);
        } catch (err: any) {
            showToast({
                title: "Failed to load reimbursement",
                description: err?.message || "An unexpected error occurred.",
                variant: "error",
            });
        }
    };

    const safeReimbursements = reimbursements || [];
    const filteredReimbursements =
        statusFilter === "all"
            ? safeReimbursements
            : safeReimbursements.filter((r) => r.status === statusFilter);

    if (error && safeReimbursements.length === 0) {
        return (
            <RoleGuard allowedRoles={["admin", "technician", "hr", "finance"]} redirectTo="/dashboard">
                <div className="p-6">
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        <p className="text-red-700">{error}</p>
                    </div>
                </div>
            </RoleGuard>
        );
    }

    return (
        <RoleGuard allowedRoles={["admin", "technician", "hr", "finance"]} redirectTo="/dashboard">
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Go back"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-2xl font-bold text-slate-900">Reimbursement</h1>
                    </div>
                    <Button onClick={() => setShowForm(true)}>
                        <PlusIcon className="h-5 w-5 mr-2" /> Submit Request
                    </Button>
                </div>

                {/* Status Filter */}
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={statusFilter === "all" ? "default" : "outline"}
                        onClick={() => setStatusFilter("all")}
                        size="sm"
                    >
                        All ({(reimbursements || []).length})
                    </Button>
                    <Button
                        variant={statusFilter === "submitted" ? "default" : "outline"}
                        onClick={() => setStatusFilter("submitted")}
                        size="sm"
                    >
                        Pending ({(reimbursements || []).filter((r) => r.status === "submitted").length})
                    </Button>
                    <Button
                        variant={statusFilter === "approved" ? "default" : "outline"}
                        onClick={() => setStatusFilter("approved")}
                        size="sm"
                    >
                        Approved ({(reimbursements || []).filter((r) => r.status === "approved").length})
                    </Button>
                    <Button
                        variant={statusFilter === "rejected" ? "default" : "outline"}
                        onClick={() => setStatusFilter("rejected")}
                        size="sm"
                    >
                        Rejected ({(reimbursements || []).filter((r) => r.status === "rejected").length})
                    </Button>
                </div>

                {/* Reimbursements List */}
                {loading && (reimbursements || []).length === 0 ? (
                    <div className="flex justify-center items-center h-48">
                        <LoadingSpinner size={40} />
                    </div>
                ) : filteredReimbursements.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <p>
                            {statusFilter === "all"
                                ? "No reimbursement requests yet."
                                : `No ${statusFilter} reimbursements.`}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredReimbursements.map((reimbursement) => (
                            <ReimbursementCard
                                key={reimbursement.id}
                                reimbursement={reimbursement}
                                onView={handleView}
                            />
                        ))}
                    </div>
                )}

                {/* Submit Form Modal */}
                {showForm && (
                    <Modal
                        isOpen={showForm}
                        onClose={() => setShowForm(false)}
                        title="Submit Reimbursement Request"
                        className="bg-white"
                    >
                        <ReimbursementForm
                            onSubmit={handleSubmit}
                            onCancel={() => setShowForm(false)}
                            isLoading={submitting}
                        />
                    </Modal>
                )}

                {/* Detail Modal */}
                {selectedReimbursement && (
                    <Modal
                        isOpen={!!selectedReimbursement}
                        onClose={() => setSelectedReimbursement(null)}
                        title="Reimbursement Details"
                        className="bg-white"
                    >
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-600">Amount</p>
                                    <p className="text-lg font-semibold text-slate-900">
                                        {new Intl.NumberFormat("id-ID", {
                                            style: "currency",
                                            currency: "IDR",
                                            minimumFractionDigits: 0,
                                        }).format(selectedReimbursement.amount)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600">Category</p>
                                    <p className="text-sm font-medium text-slate-900 capitalize">
                                        {selectedReimbursement.category.replace(/_/g, " ")}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-slate-600">Date</p>
                                <p className="text-sm font-medium text-slate-900">
                                    {format(new Date(selectedReimbursement.date), "PP")}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-600">Description</p>
                                <p className="text-sm text-slate-900 mt-1">{selectedReimbursement.description}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-600">Status</p>
                                <span
                                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium mt-1 border ${selectedReimbursement.status === "approved"
                                        ? "bg-green-100 text-green-800 border-green-200"
                                        : selectedReimbursement.status === "rejected"
                                            ? "bg-red-100 text-red-800 border-red-200"
                                            : "bg-amber-100 text-amber-800 border-amber-200"
                                        }`}
                                >
                                    {selectedReimbursement.status === "approved"
                                        ? "Approved"
                                        : selectedReimbursement.status === "rejected"
                                            ? "Rejected"
                                            : "Pending Approval"}
                                </span>
                            </div>
                            {selectedReimbursement.rejection_reason && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-sm font-medium text-red-800">Rejection Reason</p>
                                    <p className="text-sm text-red-700 mt-1">
                                        {selectedReimbursement.rejection_reason}
                                    </p>
                                </div>
                            )}
                            {selectedReimbursement.attachment_url && (
                                <div>
                                    <p className="text-sm text-slate-600 mb-2">Attachment</p>
                                    <a
                                        href={selectedReimbursement.attachment_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:text-indigo-700 text-sm underline"
                                    >
                                        View attachment
                                    </a>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}
            </div>
        </RoleGuard>
    );
}

