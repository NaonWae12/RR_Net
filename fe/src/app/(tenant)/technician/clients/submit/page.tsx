"use client";

import { useState } from "react";
import { useRole } from "@/lib/hooks/useRole";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { ClientSubmissionForm } from "@/components/technician/ClientSubmissionForm";
import { technicianService } from "@/lib/api/technicianService";
import { CreateClientSubmissionRequest } from "@/lib/api/types";
import { useNotificationStore } from "@/stores/notificationStore";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

export default function SubmitClientPage() {
  const router = useRouter();
  const { showToast } = useNotificationStore();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: CreateClientSubmissionRequest) => {
    try {
      setSubmitting(true);
      await technicianService.createClientSubmission(data);
      showToast({
        title: "Client submitted",
        description: "Your client submission has been submitted and is waiting for admin approval.",
        variant: "success",
      });
      router.push("/technician/clients/submissions");
    } catch (err: any) {
      showToast({
        title: "Failed to submit client",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/technician/clients/submissions");
  };

  return (
    <RoleGuard allowedRoles={["owner", "admin", "technician"]} redirectTo="/dashboard">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleCancel}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Submissions
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Submit New Client</h1>
        <ClientSubmissionForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
        />
      </div>
    </RoleGuard>
  );
}


