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
import { Plus, Eye, Edit, Trash2, List } from "lucide-react";
import { format } from "date-fns";
import type { Plan } from "@/lib/api/types";
import { FeatureComparisonTable } from "@/components/superadmin/FeatureComparisonTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function PlansPage() {
  const router = useRouter();
  const store = useSuperAdminStore();
  const plans = store.plans || [];
  const { loading, error, fetchPlans, deletePlan } = store;
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async () => {
    if (!selectedPlan) return;
    try {
      await deletePlan(selectedPlan.id);
      toast({
        type: "success",
        title: "Plan deleted",
        message: `Plan "${selectedPlan.name}" has been successfully deleted.`,
      });
      setDeleteModalOpen(false);
      setSelectedPlan(null);
    } catch (err: any) {
      toast({
        type: "error",
        title: "Failed to delete plan",
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

  const columns: DataTableColumn<Plan>[] = [
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
      key: "price_monthly",
      title: "Monthly Price",
      sortable: true,
      render: (value, row) => <span className="text-slate-900">{formatCurrency(value, row.currency)}</span>,
    },
    {
      key: "price_yearly",
      title: "Yearly Price",
      sortable: true,
      render: (value, row) => value ? formatCurrency(value, row.currency) : <span className="text-slate-400">-</span>,
    },
    {
      key: "is_active",
      title: "Status",
      sortable: true,
      filterable: true,
      render: (value, row) => (
        <StatusBadge
          status={value ? "Active" : "Inactive"}
          variant={value ? "success" : "info"}
        />
      ),
    },
    {
      key: "is_public",
      title: "Visibility",
      sortable: true,
      filterable: true,
      render: (value) => (
        <StatusBadge
          status={value ? "Public" : "Private"}
          variant={value ? "info" : "warning"}
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
            onClick={() => router.push(`/superadmin/plans/${row.id}`)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/superadmin/plans/${row.id}/edit`)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={() => {
              setSelectedPlan(row);
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
        title="Plan Management"
        breadcrumbs={[
          { label: "Super Admin", href: "/superadmin" },
          { label: "Plans" },
        ]}
        actions={
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <List className="h-4 w-4 mr-2" />
                  View Features
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white">
                <DialogHeader>
                  <DialogTitle className="text-black">Feature Comparison by Plan</DialogTitle>
                  <DialogDescription className="text-black">
                    Compare features across all available plans
                  </DialogDescription>
                </DialogHeader>
                <FeatureComparisonTable />
              </DialogContent>
            </Dialog>
            <Button onClick={() => router.push("/superadmin/plans/create")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </div>
        }
      >
        {error ? (
          <div className="p-6 text-red-600">
            Error loading plans: {error}
          </div>
        ) : (
          <DataTable
            data={plans}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10, pageSizeOptions: [10, 20, 50, 100] }}
            searchable
            filterable
            onRowClick={(row) => router.push(`/superadmin/plans/${row.id}`)}
            onExport={(format) => {
              toast({ type: "info", title: "Export", message: `Exporting to ${format}...` });
            }}
            emptyMessage="No plans found. Create your first plan to get started."
          />
        )}
      </PageLayout>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedPlan(null);
        }}
        onConfirm={handleDelete}
        title="Delete Plan"
        message={`Are you sure you want to delete plan "${selectedPlan?.name}"? This action cannot be undone and will affect all tenants using this plan.`}
        danger
        confirmationText="DELETE"
      />
    </>
  );
}
