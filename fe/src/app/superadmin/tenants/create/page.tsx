"use client";

import { useSuperAdminStore } from "@/stores/superAdminStore";
import { useRouter } from "next/navigation";
import { PageLayout } from "@/components/layouts";
import { TenantForm } from "@/components/superadmin/TenantForm";
import { toast } from "@/components/feedback";
import { CreateTenantRequest } from "@/lib/api/types";

export default function CreateTenantPage() {
  const router = useRouter();
  const { createTenant, loading } = useSuperAdminStore();

  const handleCreate = async (data: any) => {
    try {
      await createTenant(data as CreateTenantRequest);
      toast({
        type: "success",
        title: "Tenant created",
        message: `Tenant "${data.name}" has been created successfully.`,
      });
      router.push("/superadmin/tenants");
    } catch (err: any) {
      toast({
        type: "error",
        title: "Failed to create tenant",
        message: err?.message || "An unexpected error occurred.",
      });
    }
  };

  return (
    <PageLayout
      title="Create New Organization"
      subtitle="Register a new tenant entity and provision their system environment."
      breadcrumbs={[
        { label: "Super Admin", href: "/superadmin" },
        { label: "Tenants", href: "/superadmin/tenants" },
        { label: "Create" },
      ]}
    >
      <div className="max-w-2xl bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <TenantForm
          onSubmit={handleCreate}
          onCancel={() => router.back()}
          isLoading={loading}
        />
      </div>
    </PageLayout>
  );
}
