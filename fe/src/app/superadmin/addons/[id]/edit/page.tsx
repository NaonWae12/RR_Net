"use client";

import { useEffect } from "react";
import { AddonForm } from "@/components/superadmin/AddonForm";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { useParams, useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { UpdateAddonRequest } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EditAddonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addon, loading, error, fetchAddon, updateAddon, clearAddon } = useSuperAdminStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchAddon(id);
    }
    return () => {
      clearAddon();
    };
  }, [id, fetchAddon, clearAddon]);

  const handleSubmit = async (data: UpdateAddonRequest) => {
    if (!id) return;
    try {
      await updateAddon(id, data);
      showToast({
        title: "Addon updated",
        description: "Addon information has been successfully updated.",
        variant: "success",
      });
      router.push(`/superadmin/addons/${id}`);
    } catch (err: any) {
      showToast({
        title: "Failed to update addon",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push(`/superadmin/addons/${id}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading addon: {error}
      </div>
    );
  }

  if (!addon) {
    return (
      <div className="p-6 text-slate-500">
        Addon not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Addon Details
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Edit Addon: {addon.name}</h1>
      <AddonForm initialData={addon} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

