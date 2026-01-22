"use client";

import { CollectorAssignment } from "@/lib/api/types";
import { format } from "date-fns";

interface CollectorWorkflowPhase3Props {
  assignment: CollectorAssignment;
}

export function CollectorWorkflowPhase3({
  assignment,
}: CollectorWorkflowPhase3Props) {
  const isConfirmed = assignment.workflow_status === "confirmed";
  const isDeposited = assignment.workflow_status === "deposited";

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          {isConfirmed ? "Phase 3: Confirmed" : "Phase 3: Deposit Submitted"}
        </h2>
        <p className="text-sm text-slate-600">
          {isConfirmed
            ? "This assignment has been confirmed. View history below."
            : "Deposit report has been submitted. Waiting for confirmation."}
        </p>
      </div>

      <div className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-medium ${
              isConfirmed
                ? "bg-green-100 text-green-800"
                : "bg-purple-100 text-purple-800"
            }`}
          >
            {isConfirmed ? "✓ Confirmed" : "⏳ Pending Confirmation"}
          </span>
        </div>

        {/* Invoice Amount (Read Only) */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-700">
              Invoice Amount:
            </span>
            <span className="text-lg font-bold text-slate-900">
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: assignment.invoice.currency || "IDR",
              }).format(assignment.invoice.total_amount)}
            </span>
          </div>
        </div>

        {/* Visit Information */}
        {assignment.visit_notes && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-2">
              Visit Notes:
            </p>
            <p className="text-sm text-blue-800">{assignment.visit_notes}</p>
            {assignment.assigned_at && (
              <p className="text-xs text-blue-600 mt-2">
                Visit date: {format(new Date(assignment.assigned_at), "PPp")}
              </p>
            )}
          </div>
        )}

        {/* Visit Photo */}
        {assignment.visit_photo_url && (
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Visit Photo:
            </p>
            <img
              src={assignment.visit_photo_url}
              alt="Visit photo"
              className="max-w-full h-auto max-h-64 rounded-lg border border-slate-200"
            />
          </div>
        )}

        {/* Deposit Information */}
        {assignment.deposit_proof_url && (
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Payment Proof:
            </p>
            {assignment.deposit_proof_url.startsWith("blob:") ||
            assignment.deposit_proof_url.startsWith("data:") ? (
              <img
                src={assignment.deposit_proof_url}
                alt="Payment proof"
                className="max-w-full h-auto max-h-64 rounded-lg border border-slate-200"
              />
            ) : (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-sm font-medium text-slate-700">
                  Payment proof document
                </span>
              </div>
            )}
            {assignment.deposit_submitted_at && (
              <p className="text-xs text-slate-500 mt-2">
                Submitted:{" "}
                {format(
                  new Date(assignment.deposit_submitted_at),
                  "PPp"
                )}
              </p>
            )}
          </div>
        )}

        {/* Confirmation Date */}
        {assignment.confirmed_at && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <p className="text-sm font-medium text-green-900 mb-1">
              Confirmed At:
            </p>
            <p className="text-sm text-green-800">
              {format(new Date(assignment.confirmed_at), "PPp")}
            </p>
          </div>
        )}

        {/* Info Message */}
        <div
          className={`rounded-lg p-3 ${
            isConfirmed
              ? "bg-green-50 border border-green-200"
              : "bg-amber-50 border border-amber-200"
          }`}
        >
          <p
            className={`text-sm ${
              isConfirmed ? "text-green-800" : "text-amber-800"
            }`}
          >
            {isConfirmed ? (
              <>
                <strong>Confirmed:</strong> This assignment has been completed
                and confirmed. No further actions are available.
              </>
            ) : (
              <>
                <strong>Pending:</strong> Deposit report has been submitted and
                is waiting for confirmation. This is a read-only view.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

