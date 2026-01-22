import { CollectorAssignment, CollectorWorkflowStatus } from "@/lib/api/types";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface CollectorAssignmentCardProps {
  assignment: CollectorAssignment;
  onClick?: () => void;
}

const statusColors: Record<CollectorWorkflowStatus, string> = {
  assigned: "bg-blue-100 text-blue-800",
  visit_success: "bg-green-100 text-green-800",
  visit_failed: "bg-red-100 text-red-800",
  deposited: "bg-purple-100 text-purple-800",
  confirmed: "bg-slate-100 text-slate-800",
};

const statusLabels: Record<CollectorWorkflowStatus, string> = {
  assigned: "Assigned",
  visit_success: "Visit Success",
  visit_failed: "Visit Failed",
  deposited: "Deposited",
  confirmed: "Confirmed",
};

export function CollectorAssignmentCard({
  assignment,
  onClick,
}: CollectorAssignmentCardProps) {
  const { invoice, workflow_status } = assignment;
  const isOverdue = new Date(invoice.due_date) < new Date() && invoice.status !== "paid";

  return (
    <div
      className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-slate-900">
            {invoice.client_name || "Unknown Client"}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Invoice: {invoice.invoice_number}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${statusColors[workflow_status]}`}
        >
          {statusLabels[workflow_status]}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Amount:</span>
          <span className="font-semibold text-slate-900">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: invoice.currency || "IDR",
            }).format(invoice.total_amount)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600">Due Date:</span>
          <span
            className={isOverdue ? "font-semibold text-red-600" : "text-slate-900"}
          >
            {format(new Date(invoice.due_date), "PP")}
            {isOverdue && " (Overdue)"}
          </span>
        </div>

        {invoice.client_phone && (
          <div className="flex justify-between">
            <span className="text-slate-600">Phone:</span>
            <span className="text-slate-900">{invoice.client_phone}</span>
          </div>
        )}

        {invoice.client_address && (
          <div className="pt-2 border-t border-slate-200">
            <span className="text-slate-600 text-xs">Address:</span>
            <p className="text-xs text-slate-700 mt-1 line-clamp-2">
              {invoice.client_address}
            </p>
          </div>
        )}

        {assignment.visit_notes && (
          <div className="pt-2 border-t border-slate-200">
            <span className="text-slate-600 text-xs">Visit Notes:</span>
            <p className="text-xs text-slate-700 mt-1 line-clamp-2">
              {assignment.visit_notes}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-200">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          View Details
        </Button>
      </div>
    </div>
  );
}

