"use client";

import { useState } from "react";
import { CollectorAssignment } from "@/lib/api/types";
import { useCollectorStore } from "@/stores/collectorStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";

interface CollectorWorkflowPhase2Props {
  assignment: CollectorAssignment;
}

export function CollectorWorkflowPhase2({
  assignment,
}: CollectorWorkflowPhase2Props) {
  const { submitDepositReport, fetchAssignments } = useCollectorStore();
  const { showToast } = useNotificationStore();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(
    assignment.deposit_proof_url || null
  );
  const [loading, setLoading] = useState(false);

  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (image or PDF)
      const validTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "application/pdf",
      ];
      if (!validTypes.includes(file.type)) {
        showToast({
          title: "Invalid file type",
          description: "Please select an image (JPG, PNG, GIF) or PDF file.",
          variant: "error",
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast({
          title: "File too large",
          description: "Please select a file smaller than 10MB.",
          variant: "error",
        });
        return;
      }

      setProofFile(file);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setProofPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        // For PDF, show file name
        setProofPreview(null);
      }
    }
  };

  const handleSubmitDeposit = async () => {
    if (!proofFile) {
      showToast({
        title: "Proof required",
        description: "Please upload payment proof before submitting.",
        variant: "error",
      });
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      await submitDepositReport(assignment.invoice_id, proofFile);
      await fetchAssignments();
      showToast({
        title: "Deposit report submitted",
        description: "Your deposit report has been submitted successfully.",
        variant: "success",
      });
      // Refresh page to show Phase 3
      window.location.reload();
    } catch (err: any) {
      showToast({
        title: "Failed to submit deposit report",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Phase 2: Deposit Report
        </h2>
        <p className="text-sm text-slate-600">
          Upload payment proof and submit deposit report.
        </p>
      </div>

      <div className="space-y-4">
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
          <p className="text-xs text-slate-500 mt-2">
            This amount is read-only and cannot be edited.
          </p>
        </div>

        {/* Visit Notes (if available) */}
        {assignment.visit_notes && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-1">
              Visit Notes:
            </p>
            <p className="text-sm text-blue-800">{assignment.visit_notes}</p>
          </div>
        )}

        {/* Visit Photo (if available) */}
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

        {/* Payment Proof Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Payment Proof <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleProofChange}
              disabled={loading}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {proofPreview && (
              <div className="mt-2">
                {proofFile?.type.startsWith("image/") ? (
                  <img
                    src={proofPreview}
                    alt="Payment proof preview"
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
                      {proofFile?.name}
                    </span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setProofFile(null);
                    setProofPreview(null);
                  }}
                  className="mt-2"
                  disabled={loading}
                >
                  Remove File
                </Button>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Accepted formats: JPG, PNG, GIF, PDF (max 10MB)
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-200">
          <Button
            onClick={handleSubmitDeposit}
            disabled={loading || !proofFile}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? (
              <>
                <LoadingSpinner size={16} className="mr-2" />
                Submitting...
              </>
            ) : (
              "Submit Deposit Report"
            )}
          </Button>
        </div>

        {/* Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            <strong>Important:</strong> Once submitted, the deposit report cannot
            be edited. Make sure the payment proof is clear and valid.
          </p>
        </div>
      </div>
    </div>
  );
}

