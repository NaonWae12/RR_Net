"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { TenantStatusBadge } from "@/components/superadmin/TenantStatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tenant, loading, error, fetchTenant, clearTenant } = useSuperAdminStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchTenant(id);
    }
    return () => {
      clearTenant();
    };
  }, [id, fetchTenant, clearTenant]);

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
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Tenants
        </Button>
        <Button variant="outline" onClick={() => router.push(`/superadmin/tenants/${tenant.id}/edit`)}>
          <Pencil className="h-4 w-4 mr-2" /> Edit
        </Button>
      </div>

      <h1 className="text-3xl font-bold text-slate-900">{tenant.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white shadow rounded-lg p-6">
        <div>
          <p className="text-sm font-medium text-slate-500">Status</p>
          <TenantStatusBadge status={tenant.status} className="text-lg mt-1" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Billing Status</p>
          <p className="text-lg font-semibold capitalize">{tenant.billing_status}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Slug</p>
          <p className="text-lg font-semibold">{tenant.slug}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Domain</p>
          <p className="text-lg">{tenant.domain || "-"}</p>
        </div>
        {tenant.plan_id && (
          <div>
            <p className="text-sm font-medium text-slate-500">Plan ID</p>
            <p className="text-lg font-semibold">{tenant.plan_id}</p>
          </div>
        )}
        {tenant.trial_ends_at && (
          <div>
            <p className="text-sm font-medium text-slate-500">Trial Ends At</p>
            <p className="text-lg">{format(new Date(tenant.trial_ends_at), "PPp")}</p>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-slate-500">Created At</p>
          <p className="text-lg">{format(new Date(tenant.created_at), "PPp")}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Updated At</p>
          <p className="text-lg">{format(new Date(tenant.updated_at), "PPp")}</p>
        </div>
      </div>
    </div>
  );
}

