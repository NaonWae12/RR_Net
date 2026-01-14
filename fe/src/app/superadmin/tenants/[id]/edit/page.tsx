"use client";

import { useEffect } from "react";
import { TenantForm } from "@/components/superadmin/TenantForm";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { useParams, useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { UpdateTenantRequest } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EditTenantPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tenant, loading, error, fetchTenant, updateTenant, clearTenant } = useSuperAdminStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchTenant(id);
    }
    return () => {
      clearTenant();
    };
  }, [id, fetchTenant, clearTenant]);

  const handleSubmit = async (data: UpdateTenantRequest) => {
    if (!id) return;
    try {
      await updateTenant(id, data);
      showToast({
        title: "Tenant updated",
        description: "Tenant information has been successfully updated.",
        variant: "success",
      });
      router.push(`/superadmin/tenants/${id}`);
    } catch (err: any) {
      showToast({
        title: "Failed to update tenant",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push(`/superadmin/tenants/${id}`);
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
      <div className="p-6 text-red-600">
        Error loading tenant: {error}
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-6 text-slate-500">
        Tenant not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Tenant Details
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Edit Tenant: {tenant.name}</h1>
      <TenantForm initialData={tenant} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

