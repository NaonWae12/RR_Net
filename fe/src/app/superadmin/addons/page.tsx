"use client";

import { useEffect, useState } from "react";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { useRouter } from "next/navigation";
import { PageLayout } from "@/components/layouts";
import { DataTable, type DataTableColumn } from "@/components/tables";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/modals";
import { toast } from "@/components/feedback";
import { StatusBadge } from "@/components/utilities";
import { Plus, Eye, Edit, Trash2, Package } from "lucide-react";
import { format } from "date-fns";
import type { Addon } from "@/lib/api/types";

export default function AddonsPage() {
  const router = useRouter();
  const store = useSuperAdminStore();
  const addons = store.addons || [];
  const { loading, error, fetchAddons, deleteAddon } = store;
  const [selectedAddon, setSelectedAddon] = useState<Addon | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    fetchAddons();
  }, [fetchAddons]);

  const handleDelete = async () => {
    if (!selectedAddon) return;
    try {
      await deleteAddon(selectedAddon.id);
      toast({
        type: "success",
        title: "Addon deleted",
        message: `Addon "${selectedAddon.name}" has been successfully deleted.`,
      });
      setDeleteModalOpen(false);
      setSelectedAddon(null);
    } catch (err: any) {
      toast({
        type: "error",
        title: "Failed to delete addon",
        message: err?.message || "An unexpected error occurred.",
      });
    }
  };

  const formatCurrency = (amount: number, currency: string = "IDR") => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getBillingCycleLabel = (cycle: string) => {
    switch (cycle) {
      case "one_time":
        return "One Time";
      case "monthly":
        return "Monthly";
      case "yearly":
        return "Yearly";
      default:
        return cycle;
    }
  };

  const getAddonTypeLabel = (type: string) => {
    switch (type) {
      case "limit_boost":
        return "Limit Boost";
      case "feature":
        return "Feature";
      default:
        return type;
    }
  };

  const columns: DataTableColumn<Addon>[] = [
    {
      key: "code",
      title: "Code",
      sortable: true,
      filterable: true,
      render: (value) => (
        <code className="text-xs bg-slate-100 px-2 py-1 rounded font-medium text-slate-900">{value}</code>
      ),
    },
    {
      key: "name",
      title: "Name",
      sortable: true,
      filterable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-slate-900">{value}</div>
          {row.description && (
            <div className="text-xs text-slate-600 mt-1 line-clamp-1">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: "addon_type",
      title: "Type",
      sortable: true,
      filterable: true,
      render: (value) => (
        <StatusBadge
          status={getAddonTypeLabel(value)}
          variant={value === "limit_boost" ? "info" : "success"}
          size="sm"
        />
      ),
    },
    {
      key: "price",
      title: "Price",
      sortable: true,
      render: (value, row) => <span className="text-slate-900">{formatCurrency(value, row.currency)}</span>,
    },
    {
      key: "billing_cycle",
      title: "Billing Cycle",
      sortable: true,
      filterable: true,
      render: (value) => (
        <StatusBadge
          status={getBillingCycleLabel(value)}
          variant="info"
          size="sm"
        />
      ),
    },
    {
      key: "is_active",
      title: "Status",
      sortable: true,
      filterable: true,
      render: (value) => (
        <StatusBadge
          status={value ? "Active" : "Inactive"}
          variant={value ? "success" : "info"}
          size="sm"
        />
      ),
    },
    {
      key: "created_at",
      title: "Created At",
      sortable: true,
      render: (value) => <span className="text-slate-900">{format(new Date(value), "PPp")}</span>,
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
            onClick={() => router.push(`/superadmin/addons/${row.id}`)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/superadmin/addons/${row.id}/edit`)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setSelectedAddon(row);
              setDeleteModalOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageLayout
        title="Addon Management"
        breadcrumbs={[
          { label: "Super Admin", href: "/superadmin" },
          { label: "Addons" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/superadmin/addons/requests")}>
              <Package className="h-4 w-4 mr-2" />
              View Requests
            </Button>
            <Button onClick={() => router.push("/superadmin/addons/create")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Addon
            </Button>
          </div>
        }
      >
        {error ? (
          <div className="p-6 text-red-600">
            Error loading addons: {error}
          </div>
        ) : (
          <DataTable
            data={addons}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10, pageSizeOptions: [10, 20, 50, 100] }}
            searchable
            filterable
            onRowClick={(row) => router.push(`/superadmin/addons/${row.id}`)}
            onExport={(format) => {
              toast({ type: "info", title: "Export", message: `Exporting to ${format}...` });
            }}
            emptyMessage="No addons found. Create your first addon to get started."
          />
        )}
      </PageLayout>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedAddon(null);
        }}
        onConfirm={handleDelete}
        title="Delete Addon"
        message={`Are you sure you want to delete addon "${selectedAddon?.name}"? This action cannot be undone.`}
        danger
        confirmationText="DELETE"
      />
    </>
  );
}
