"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/hooks/useRole";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { PayslipCard } from "@/components/technician/PayslipCard";
import { PayslipDetail } from "@/components/technician/PayslipDetail";
import { Modal } from "@/components/ui/modal";
import { technicianService } from "@/lib/api/technicianService";
import { Payslip } from "@/lib/api/types";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";

export default function PayslipPage() {
    const router = useRouter();
    const { userId } = useRole();
    const { showToast } = useNotificationStore();
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchPayslips = async () => {
        if (!userId) return;
        try {
            setLoading(true);
            setError(null);
            const data = await technicianService.getPayslips(userId);
            setPayslips(data || []);
        } catch (err: any) {
            setError(err?.message || "Failed to load payslips");
            setPayslips([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayslips();
    }, [userId]);

    const handleView = async (id: string) => {
        try {
            const payslip = await technicianService.getPayslip(id);
            setSelectedPayslip(payslip);
        } catch (err: any) {
            showToast({
                title: "Failed to load payslip",
                description: err?.message || "An unexpected error occurred.",
                variant: "error",
            });
        }
    };

    const handleDownload = async (id: string) => {
        try {
            setDownloading(id);
            const blob = await technicianService.downloadPayslip(id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `payslip-${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast({
                title: "Download started",
                description: "Payslip PDF is being downloaded.",
                variant: "success",
            });
        } catch (err: any) {
            showToast({
                title: "Failed to download payslip",
                description: err?.message || "An unexpected error occurred.",
                variant: "error",
            });
        } finally {
            setDownloading(null);
        }
    };

    // Group payslips by year
    const groupedPayslips = (payslips || []).reduce((acc, payslip) => {
        const year = payslip.period.split("-")[0];
        if (!acc[year]) {
            acc[year] = [];
        }
        acc[year].push(payslip);
        return acc;
    }, {} as Record<string, Payslip[]>);

    const sortedYears = Object.keys(groupedPayslips).sort((a, b) => b.localeCompare(a));

    if (error && payslips.length === 0) {
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
                    <h1 className="text-2xl font-bold text-slate-900">Payslips</h1>
                </div>

                {loading && payslips.length === 0 ? (
                    <div className="flex justify-center items-center h-48">
                        <LoadingSpinner size={40} />
                    </div>
                ) : payslips.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <p>No payslips available yet.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {sortedYears.map((year) => (
                            <div key={year}>
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">{year}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {groupedPayslips[year]
                                        .sort((a, b) => b.period.localeCompare(a.period))
                                        .map((payslip) => (
                                            <PayslipCard
                                                key={payslip.id}
                                                payslip={payslip}
                                                onView={handleView}
                                                onDownload={handleDownload}
                                                loading={downloading === payslip.id}
                                            />
                                        ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Detail Modal */}
                {selectedPayslip && (
                    <Modal
                        isOpen={!!selectedPayslip}
                        onClose={() => setSelectedPayslip(null)}
                        title="Payslip Details"
                        className="bg-white"
                    >
                        <PayslipDetail
                            payslip={selectedPayslip}
                            onDownload={handleDownload}
                            onClose={() => setSelectedPayslip(null)}
                            loading={downloading === selectedPayslip.id}
                        />
                    </Modal>
                )}
            </div>
        </RoleGuard>
    );
}

