"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCollectorStore } from "@/stores/collectorStore";
import { useBillingStore } from "@/stores/billingStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { CollectorWorkflowPhase1 } from "@/components/collector/CollectorWorkflowPhase1";
import { CollectorWorkflowPhase2 } from "@/components/collector/CollectorWorkflowPhase2";
import { CollectorWorkflowPhase3 } from "@/components/collector/CollectorWorkflowPhase3";
import { CollectorAssignment, CollectorWorkflowStatus } from "@/lib/api/types";
import { format } from "date-fns";

export default function CollectorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    assignments,
    selectedAssignment,
    loading,
    error,
    fetchAssignments,
    setSelectedAssignment,
  } = useCollectorStore();
  const { fetchInvoice } = useBillingStore();
  const { showToast } = useNotificationStore();
  const [assignment, setAssignment] = useState<CollectorAssignment | null>(null);

  useEffect(() => {
    if (id) {
      fetchAssignments().then(() => {
        const currentAssignments = useCollectorStore.getState().assignments;
        const found = currentAssignments.find((a) => a.invoice_id === id);
        if (found) {
          setAssignment(found);
          setSelectedAssignment(found);
        } else {
          // Try to fetch invoice and create assignment if not found
          fetchInvoice(id as string)
            .then(() => {
              const invoice = useBillingStore.getState().invoice;
              if (invoice && (invoice.status === "pending" || invoice.status === "overdue")) {
                const newAssignment: CollectorAssignment = {
                  invoice_id: invoice.id,
                  invoice,
                  workflow_status: "assigned",
                  assigned_at: new Date().toISOString(),
                };
                setAssignment(newAssignment);
                setSelectedAssignment(newAssignment);
              } else {
                showToast({
                  title: "Invoice not found",
                  description: "This invoice is not available for collection.",
                  variant: "error",
                });
                router.push("/collector");
              }
            })
            .catch(() => {
              showToast({
                title: "Error",
                description: "Failed to load invoice details.",
                variant: "error",
              });
              router.push("/collector");
            });
        }
      });
    }
  }, [id, fetchAssignments, fetchInvoice, router, showToast, setSelectedAssignment]);

  // Update assignment when assignments change
  useEffect(() => {
    if (id && assignments.length > 0) {
      const found = assignments.find((a) => a.invoice_id === id);
      if (found) {
        setAssignment(found);
        setSelectedAssignment(found);
      }
    }
  }, [assignments, id, setSelectedAssignment]);

  if (loading && !assignment) {
    return (
      <RoleGuard allowedRoles={["technician"]} redirectTo="/dashboard">
        <div className="p-6">
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size={40} />
          </div>
        </div>
      </RoleGuard>
    );
  }

  if (error && !assignment) {
    return (
      <RoleGuard allowedRoles={["technician"]} redirectTo="/dashboard">
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-red-700">Error: {error}</p>
            <Button
              onClick={() => router.push("/collector")}
              className="mt-2"
              variant="outline"
            >
              Back to Collector
            </Button>
          </div>
        </div>
      </RoleGuard>
    );
  }

  if (!assignment) {
    return (
      <RoleGuard allowedRoles={["technician"]} redirectTo="/dashboard">
        <div className="p-6">
          <div className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-3 rounded-lg">
            <p className="text-slate-700">Assignment not found</p>
            <Button
              onClick={() => router.push("/collector")}
              className="mt-2"
              variant="outline"
            >
              Back to Collector
            </Button>
          </div>
        </div>
      </RoleGuard>
    );
  }

  const renderWorkflowPhase = () => {
    switch (assignment.workflow_status) {
      case "assigned":
        return <CollectorWorkflowPhase1 assignment={assignment} />;
      case "visit_success":
        return <CollectorWorkflowPhase2 assignment={assignment} />;
      case "visit_failed":
        return (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-slate-900">
                Visit Failed
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                This visit was marked as failed. No further actions available.
              </p>
              {assignment.visit_notes && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-700">
                    <strong>Notes:</strong> {assignment.visit_notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      case "deposited":
        return <CollectorWorkflowPhase3 assignment={assignment} />;
      case "confirmed":
        return <CollectorWorkflowPhase3 assignment={assignment} />;
      default:
        return null;
    }
  };

  return (
    <RoleGuard allowedRoles={["technician"]} redirectTo="/dashboard">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/collector")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Collector Detail</h1>
            <p className="text-sm text-slate-600 mt-1">
              Invoice: {assignment.invoice.invoice_number}
            </p>
          </div>
        </div>

        {/* Invoice Info Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Invoice Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-slate-600">Client Name</span>
              <p className="font-medium text-slate-900">
                {assignment.invoice.client_name || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-sm text-slate-600">Client Phone</span>
              <p className="font-medium text-slate-900">
                {assignment.invoice.client_phone || "N/A"}
              </p>
            </div>
            <div>
              <span className="text-sm text-slate-600">Invoice Number</span>
              <p className="font-medium text-slate-900">
                {assignment.invoice.invoice_number}
              </p>
            </div>
            <div>
              <span className="text-sm text-slate-600">Due Date</span>
              <p className="font-medium text-slate-900">
                {format(new Date(assignment.invoice.due_date), "PP")}
              </p>
            </div>
            <div>
              <span className="text-sm text-slate-600">Total Amount</span>
              <p className="font-medium text-lg text-slate-900">
                {new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: assignment.invoice.currency || "IDR",
                }).format(assignment.invoice.total_amount)}
              </p>
            </div>
            <div>
              <span className="text-sm text-slate-600">Status</span>
              <p className="font-medium text-slate-900">
                {assignment.invoice.status}
              </p>
            </div>
            {assignment.invoice.client_address && (
              <div className="md:col-span-2">
                <span className="text-sm text-slate-600">Address</span>
                <p className="font-medium text-slate-900">
                  {assignment.invoice.client_address}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Workflow Phase */}
        {renderWorkflowPhase()}
      </div>
    </RoleGuard>
  );
}

