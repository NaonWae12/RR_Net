"use client";

import { useEffect, useState } from "react";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { useRouter } from "next/navigation";
import { PageLayout } from "@/components/layouts";
import { DataTable, type DataTableColumn } from "@/components/tables";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/modals";
import { toast } from "@/components/feedback";
import { TenantStatusBadge } from "@/components/superadmin/TenantStatusBadge";
import { StatusBadge } from "@/components/utilities";
import { Plus, Eye, Ban, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import type { SuperAdminTenant } from "@/lib/api/types";

export default function TenantsPage() {
  const router = useRouter();
  const store = useSuperAdminStore();
  const tenants = store.tenants || [];
  const { loading, error, fetchTenants, suspendTenant, unsuspendTenant } = store;
  const [selectedTenant, setSelectedTenant] = useState<SuperAdminTenant | null>(null);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [unsuspendModalOpen, setUnsuspendModalOpen] = useState(false);

  useEffect(() => {
    console.log("[TenantsPage] Component mounted, fetching tenants...");
    console.log("[TenantsPage] Store state - loading:", store.loading, "error:", store.error, "tenants count:", store.tenants?.length);
    fetchTenants();
  }, [fetchTenants]);
  
  // Debug: Log state changes
  useEffect(() => {
    console.log("[TenantsPage] State changed - loading:", store.loading, "error:", store.error, "tenants:", store.tenants);
  }, [store.loading, store.error, store.tenants]);

  const handleSuspend = async () => {
    if (!selectedTenant) return;
    try {
      await suspendTenant(selectedTenant.id);
      toast({
        type: "success",
        title: "Tenant suspended",
        message: `Tenant "${selectedTenant.name}" has been suspended.`,
      });
      setSuspendModalOpen(false);
      setSelectedTenant(null);
    } catch (err: any) {
      toast({
        type: "error",
        title: "Failed to suspend tenant",
        message: err?.message || "An unexpected error occurred.",
      });
    }
  };

  const handleUnsuspend = async () => {
    if (!selectedTenant) return;
    try {
      await unsuspendTenant(selectedTenant.id);
      toast({
        type: "success",
        title: "Tenant unsuspended",
        message: `Tenant "${selectedTenant.name}" has been unsuspended.`,
      });
      setUnsuspendModalOpen(false);
      setSelectedTenant(null);
    } catch (err: any) {
      toast({
        type: "error",
        title: "Failed to unsuspend tenant",
        message: err?.message || "An unexpected error occurred.",
      });
    }
  };

  const columns: DataTableColumn<SuperAdminTenant>[] = [
    {
      key: "name",
      title: "Name",
      sortable: true,
      filterable: true,
      render: (value, row) => (
        <div className="font-medium text-slate-900">{value}</div>
      ),
    },
    {
      key: "slug",
      title: "Slug",
      sortable: true,
      filterable: true,
      render: (value) => (
        <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-900">{value}</code>
      ),
    },
    {
      key: "domain",
      title: "Domain",
      filterable: true,
      render: (value) => value || <span className="text-slate-400">-</span>,
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      filterable: true,
      render: (value, row) => <TenantStatusBadge status={row.status} />,
    },
    {
      key: "billing_status",
      title: "Billing Status",
      sortable: true,
      filterable: true,
      render: (value) => (
        <StatusBadge
          status={value || "unknown"}
          variant={value === "active" ? "success" : value === "overdue" ? "error" : "info"}
          size="sm"
        />
      ),
    },
    {
      key: "created_at",
      title: "Created At",
      sortable: true,
      render: (value) => format(new Date(value), "PPp"),
    },
    {
      key: "actions",
      title: "Actions",
      align: "right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/superadmin/tenants/${row.id}`)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          {row.status === "active" ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setSelectedTenant(row);
                setSuspendModalOpen(true);
              }}
            >
              <Ban className="h-4 w-4 mr-1" />
              Suspend
            </Button>
          ) : row.status === "suspended" ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setSelectedTenant(row);
                setUnsuspendModalOpen(true);
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Unsuspend
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageLayout
        title="Tenant Management"
        breadcrumbs={[
          { label: "Super Admin", href: "/superadmin" },
          { label: "Tenants" },
        ]}
        actions={
          <Button onClick={() => router.push("/superadmin/tenants/create")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
          </Button>
        }
      >
        {error ? (
          <div className="p-6 text-red-600">
            Error loading tenants: {error}
          </div>
        ) : (
          <DataTable
            data={tenants}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10, pageSizeOptions: [10, 20, 50, 100] }}
            searchable
            filterable
            onRowClick={(row) => router.push(`/superadmin/tenants/${row.id}`)}
            onExport={(format) => {
              // TODO: Implement export functionality
              toast({ type: "info", title: "Export", message: `Exporting to ${format}...` });
            }}
            emptyMessage="No tenants found. Create your first tenant to get started."
          />
        )}
      </PageLayout>

      <ConfirmModal
        isOpen={suspendModalOpen}
        onClose={() => {
          setSuspendModalOpen(false);
          setSelectedTenant(null);
        }}
        onConfirm={handleSuspend}
        title="Suspend Tenant"
        message={`Are you sure you want to suspend tenant "${selectedTenant?.name}"? This will prevent all users from accessing the tenant's system.`}
        danger
        confirmationText="SUSPEND"
      />

      <ConfirmModal
        isOpen={unsuspendModalOpen}
        onClose={() => {
          setUnsuspendModalOpen(false);
          setSelectedTenant(null);
        }}
        onConfirm={handleUnsuspend}
        title="Unsuspend Tenant"
        message={`Are you sure you want to unsuspend tenant "${selectedTenant?.name}"? This will restore access to the tenant's system.`}
        confirmationText="UNSUSPEND"
      />
    </>
  );
}
