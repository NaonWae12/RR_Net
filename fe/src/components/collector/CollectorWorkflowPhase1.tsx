"use client";

import { useState } from "react";
import { CollectorAssignment } from "@/lib/api/types";
import { useCollectorStore } from "@/stores/collectorStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";

interface CollectorWorkflowPhase1Props {
  assignment: CollectorAssignment;
}

export function CollectorWorkflowPhase1({
  assignment,
}: CollectorWorkflowPhase1Props) {
  const { markVisitSuccess, markVisitFailed, fetchAssignments } =
    useCollectorStore();
  const { showToast } = useNotificationStore();
  const [notes, setNotes] = useState(assignment.visit_notes || "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    assignment.visit_photo_url || null
  );
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<"success" | "failed" | null>(
    null
  );

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        showToast({
          title: "Invalid file type",
          description: "Please select an image file.",
          variant: "error",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast({
          title: "File too large",
          description: "Please select an image smaller than 5MB.",
          variant: "error",
        });
        return;
      }

      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVisitSuccess = async () => {
    if (loading) return;
    setLoading(true);
    setActionType("success");

    try {
      await markVisitSuccess(assignment.invoice_id, notes || undefined, photoFile || undefined);
      await fetchAssignments();
      showToast({
        title: "Visit marked as successful",
        description: "You can now proceed to submit deposit report.",
        variant: "success",
      });
      // Refresh page to show Phase 2
      window.location.reload();
    } catch (err: any) {
      showToast({
        title: "Failed to mark visit",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const handleVisitFailed = async () => {
    if (loading) return;
    setLoading(true);
    setActionType("failed");

    try {
      await markVisitFailed(assignment.invoice_id, notes || undefined);
      await fetchAssignments();
      showToast({
        title: "Visit marked as failed",
        description: "Visit status has been updated.",
        variant: "success",
      });
      // Refresh page to show updated status
      window.location.reload();
    } catch (err: any) {
      showToast({
        title: "Failed to mark visit",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Phase 1: Visit
        </h2>
        <p className="text-sm text-slate-600">
          Mark the visit result and add notes or photo if needed.
        </p>
      </div>

      <div className="space-y-4">
        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Visit Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about the visit..."
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={loading}
          />
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Visit Photo (Optional)
          </label>
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              disabled={loading}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {photoPreview && (
              <div className="mt-2">
                <img
                  src={photoPreview}
                  alt="Visit photo preview"
                  className="max-w-full h-auto max-h-64 rounded-lg border border-slate-200"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                  }}
                  className="mt-2"
                  disabled={loading}
                >
                  Remove Photo
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <Button
            onClick={handleVisitSuccess}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {loading && actionType === "success" ? (
              <>
                <LoadingSpinner size={16} className="mr-2" />
                Processing...
              </>
            ) : (
              "✓ Mark Visit Success"
            )}
          </Button>
          <Button
            onClick={handleVisitFailed}
            disabled={loading}
            variant="outline"
            className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
          >
            {loading && actionType === "failed" ? (
              <>
                <LoadingSpinner size={16} className="mr-2" />
                Processing...
              </>
            ) : (
              "✗ Mark Visit Failed"
            )}
          </Button>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> After marking visit success, you can proceed
            to submit deposit report. Visit failed status cannot be changed.
          </p>
        </div>
      </div>
    </div>
  );
}

