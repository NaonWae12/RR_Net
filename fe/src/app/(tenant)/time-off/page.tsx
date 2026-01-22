"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/hooks/useRole";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { TimeOffForm } from "@/components/technician/TimeOffForm";
import { TimeOffCalendar } from "@/components/technician/TimeOffCalendar";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { technicianService } from "@/lib/api/technicianService";
import { TimeOff, CreateTimeOffRequest } from "@/lib/api/types";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function TimeOffPage() {
    const router = useRouter();
    const { userId } = useRole();
    const { showToast } = useNotificationStore();
    const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
    const [selectedTimeOff, setSelectedTimeOff] = useState<TimeOff | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTimeOffs = async () => {
        if (!userId) return;
        try {
            setLoading(true);
            setError(null);
            const status = statusFilter !== "all" ? statusFilter : undefined;
            const data = await technicianService.getTimeOffs(userId, status);
            setTimeOffs(data || []);
        } catch (err: any) {
            setError(err?.message || "Failed to load time-off requests");
            setTimeOffs([]); // Reset to empty array on error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimeOffs();
    }, [userId, statusFilter]);

    const handleSubmit = async (data: CreateTimeOffRequest) => {
        try {
            setSubmitting(true);
            await technicianService.createTimeOff(data);
            showToast({
                title: "Time-off request submitted",
                description: "Your time-off request has been submitted and is waiting for approval.",
                variant: "success",
            });
            setShowForm(false);
            await fetchTimeOffs();
        } catch (err: any) {
            showToast({
                title: "Failed to submit time-off request",
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
            const timeOff = await technicianService.getTimeOff(id);
            setSelectedTimeOff(timeOff);
        } catch (err: any) {
            showToast({
                title: "Failed to load time-off request",
                description: err?.message || "An unexpected error occurred.",
                variant: "error",
            });
        }
    };

    const handlePreviousMonth = () => {
        setCurrentMonth((prev) => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() - 1);
            return startOfMonth(newDate);
        });
    };

    const handleNextMonth = () => {
        setCurrentMonth((prev) => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + 1);
            return startOfMonth(newDate);
        });
    };

    const safeTimeOffs = timeOffs || [];
    const filteredTimeOffs =
        statusFilter === "all"
            ? safeTimeOffs
            : safeTimeOffs.filter((to) => to.status === statusFilter);

    if (error && safeTimeOffs.length === 0) {
        return (
            <RoleGuard allowedRoles={["admin", "technician", "hr", "finance"]} redirectTo="/dashboard">
                <div className="p-6">
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {error}
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
                        <h1 className="text-2xl font-bold text-slate-900">Time Off</h1>
                    </div>
                    <Button onClick={() => setShowForm(true)}>
                        <PlusIcon className="h-5 w-5 mr-2" /> Request Time Off
                    </Button>
                </div>

                {/* Status Filter */}
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={statusFilter === "all" ? "default" : "outline"}
                        onClick={() => setStatusFilter("all")}
                        size="sm"
                    >
                        All ({(timeOffs || []).length})
                    </Button>
                    <Button
                        variant={statusFilter === "pending_approval" ? "default" : "outline"}
                        onClick={() => setStatusFilter("pending_approval")}
                        size="sm"
                    >
                        Pending ({(timeOffs || []).filter((to) => to.status === "pending_approval").length})
                    </Button>
                    <Button
                        variant={statusFilter === "approved" ? "default" : "outline"}
                        onClick={() => setStatusFilter("approved")}
                        size="sm"
                    >
                        Approved ({(timeOffs || []).filter((to) => to.status === "approved").length})
                    </Button>
                    <Button
                        variant={statusFilter === "rejected" ? "default" : "outline"}
                        onClick={() => setStatusFilter("rejected")}
                        size="sm"
                    >
                        Rejected ({(timeOffs || []).filter((to) => to.status === "rejected").length})
                    </Button>
                </div>

                {/* Calendar */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">Calendar View</h2>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                                <ChevronLeftIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleNextMonth}>
                                <ChevronRightIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <TimeOffCalendar
                        timeOffs={(timeOffs || []).filter((to) => to.status === "approved")}
                        currentMonth={currentMonth}
                        onDateClick={(date) => {
                            // Could show detail for selected date
                            console.log("Selected date:", date);
                        }}
                    />
                </div>

                {/* Time Off List */}
                <div>
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Requests</h2>
                    {loading && (timeOffs || []).length === 0 ? (
                        <div className="flex justify-center items-center h-48">
                            <LoadingSpinner size={40} />
                        </div>
                    ) : filteredTimeOffs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <p>
                                {statusFilter === "all"
                                    ? "No time-off requests yet."
                                    : `No ${statusFilter} time-off requests.`}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredTimeOffs.map((timeOff) => (
                                <div
                                    key={timeOff.id}
                                    className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => handleView(timeOff.id)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span
                                                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium capitalize ${timeOff.status === "approved"
                                                        ? "bg-green-100 text-green-800"
                                                        : timeOff.status === "rejected"
                                                            ? "bg-red-100 text-red-800"
                                                            : "bg-yellow-100 text-yellow-800"
                                                        }`}
                                                >
                                                    {timeOff.status === "approved"
                                                        ? "Approved"
                                                        : timeOff.status === "rejected"
                                                            ? "Rejected"
                                                            : "Pending Approval"}
                                                </span>
                                                <span className="text-xs text-slate-500 capitalize">{timeOff.type}</span>
                                            </div>
                                            <p className="text-sm font-medium text-slate-900">
                                                {format(new Date(timeOff.start_date), "PP")} -{" "}
                                                {format(new Date(timeOff.end_date), "PP")}
                                            </p>
                                            <p className="text-xs text-slate-600 mt-1">
                                                {timeOff.days_count} day{timeOff.days_count > 1 ? "s" : ""}
                                            </p>
                                            <p className="text-sm text-slate-700 mt-2 line-clamp-2">
                                                {timeOff.reason}
                                            </p>
                                        </div>
                                    </div>
                                    {timeOff.rejection_reason && timeOff.status === "rejected" && (
                                        <div className="mt-3 pt-3 border-t border-slate-200">
                                            <p className="text-xs text-red-600">
                                                <span className="font-medium">Rejection reason:</span>{" "}
                                                {timeOff.rejection_reason}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Submit Form Modal */}
                {showForm && (
                    <Modal
                        isOpen={showForm}
                        onClose={() => setShowForm(false)}
                        title="Request Time Off"
                        className="bg-white"
                    >
                        <TimeOffForm
                            onSubmit={handleSubmit}
                            onCancel={() => setShowForm(false)}
                            isLoading={submitting}
                        />
                    </Modal>
                )}

                {/* Detail Modal */}
                {selectedTimeOff && (
                    <Modal
                        isOpen={!!selectedTimeOff}
                        onClose={() => setSelectedTimeOff(null)}
                        title="Time Off Details"
                        className="bg-white"
                    >
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-600">Type</p>
                                    <p className="text-sm font-medium text-slate-900 capitalize">
                                        {selectedTimeOff.type}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600">Days</p>
                                    <p className="text-sm font-medium text-slate-900">
                                        {selectedTimeOff.days_count} day{selectedTimeOff.days_count > 1 ? "s" : ""}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-slate-600">Date Range</p>
                                <p className="text-sm font-medium text-slate-900">
                                    {format(new Date(selectedTimeOff.start_date), "PP")} -{" "}
                                    {format(new Date(selectedTimeOff.end_date), "PP")}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-600">Reason</p>
                                <p className="text-sm text-slate-900 mt-1">{selectedTimeOff.reason}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-600">Status</p>
                                <span
                                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium mt-1 ${selectedTimeOff.status === "approved"
                                        ? "bg-green-100 text-green-800"
                                        : selectedTimeOff.status === "rejected"
                                            ? "bg-red-100 text-red-800"
                                            : "bg-yellow-100 text-yellow-800"
                                        }`}
                                >
                                    {selectedTimeOff.status === "approved"
                                        ? "Approved"
                                        : selectedTimeOff.status === "rejected"
                                            ? "Rejected"
                                            : "Pending Approval"}
                                </span>
                            </div>
                            {selectedTimeOff.rejection_reason && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-sm font-medium text-red-800">Rejection Reason</p>
                                    <p className="text-sm text-red-700 mt-1">{selectedTimeOff.rejection_reason}</p>
                                </div>
                            )}
                            {selectedTimeOff.attachment_url && (
                                <div>
                                    <p className="text-sm text-slate-600 mb-2">Attachment</p>
                                    <a
                                        href={selectedTimeOff.attachment_url}
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

