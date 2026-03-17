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
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Package, 
  Cpu, 
  Zap, 
  Boxes, 
  MoreVertical,
  Activity,
  CreditCard,
  Layers,
  Sparkles,
  ClipboardList
} from "lucide-react";
import { format } from "date-fns";
import type { Addon } from "@/lib/api/types";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: any;
  color: "blue" | "purple" | "rose" | "emerald";
  description: string;
}

function SummaryCard({ title, value, icon: Icon, color, description }: SummaryCardProps) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  };

  return (
    <motion.div variants={item} className={cn("p-5 rounded-2xl border border-slate-100/20 bg-white shadow-sm flex items-start gap-4")}>
      <div className={cn("p-3 rounded-xl", colors[color])}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 leading-none mb-1">{value}</h3>
        <p className="text-xs text-slate-500 font-medium">{description}</p>
      </div>
    </motion.div>
  );
}

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

  const featureCount = addons.filter(a => a.addon_type === "feature").length;
  const limitBoostCount = addons.filter(a => a.addon_type === "limit_boost").length;
  const activeAddons = addons.filter(a => a.is_active).length;

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

  const getBillingCycleLabel = (cycle: string) => {
    switch (cycle) {
      case "one_time": return "One-Time";
      case "monthly": return "Monthly";
      case "yearly": return "Yearly";
      default: return cycle;
    }
  };

  const columns: DataTableColumn<Addon>[] = [
    {
      key: "name",
      title: "Add-on Modality",
      sortable: true,
      filterable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3 py-1">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
            row.addon_type === "feature" 
              ? "bg-purple-50 text-purple-600 border-purple-100" 
              : "bg-blue-50 text-blue-600 border-blue-100"
          )}>
            {row.addon_type === "feature" ? <Sparkles size={20} /> : <Zap size={20} />}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 leading-none mb-1">{value}</span>
            <div className="flex items-center gap-2">
              <code className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-mono font-bold uppercase">
                {row.code}
              </code>
              <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
                {row.description || "System extension"}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "addon_type",
      title: "Category",
      sortable: true,
      filterable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <StatusBadge
            status={value === "limit_boost" ? "Limit Boost" : "Feature"}
            variant={value === "limit_boost" ? "info" : "success"}
            size="sm"
          />
        </div>
      ),
    },
    {
      key: "price",
      title: "Cost",
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{formatCurrency(value)}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
            {getBillingCycleLabel(row.billing_cycle)}
          </span>
        </div>
      ),
    },
    {
      key: "is_active",
      title: "Market Status",
      sortable: true,
      filterable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          {value ? (
            <StatusBadge status="Marketplace" variant="success" size="sm" />
          ) : (
            <StatusBadge status="Draft" variant="info" size="sm" />
          )}
        </div>
      ),
    },
    {
      key: "actions",
      title: "",
      align: "right",
      render: (_, row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
              <MoreVertical size={16} className="text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl shadow-xl border-slate-100">
            <DropdownMenuItem 
              className="flex items-center gap-2 py-2 px-3 rounded-lg focus:bg-slate-50 cursor-pointer"
              onClick={() => router.push(`/superadmin/addons/${row.id}`)}
            >
              <Eye size={14} className="text-slate-400" />
              <span className="text-xs font-semibold">View Anatomy</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="flex items-center gap-2 py-2 px-3 rounded-lg focus:bg-slate-50 cursor-pointer"
              onClick={() => router.push(`/superadmin/addons/${row.id}/edit`)}
            >
              <Edit size={14} className="text-slate-400" />
              <span className="text-xs font-semibold">Modify Config</span>
            </DropdownMenuItem>
            
            <div className="h-px bg-slate-100 my-1 mx-1" />
            
            <DropdownMenuItem 
              className="flex items-center gap-2 py-2 px-3 rounded-lg focus:bg-red-50 text-red-600 cursor-pointer"
              onClick={() => {
                setSelectedAddon(row);
                setDeleteModalOpen(true);
              }}
            >
              <Trash2 size={14} />
              <span className="text-xs font-bold">Destroy Addon</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <PageLayout
        title="Add-on Marketplace"
        subtitle="Manage modular features and resource upgrades available for subscription expansion."
        breadcrumbs={[
          { label: "Super Admin", href: "/superadmin" },
          { label: "Addons" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="font-bold flex items-center gap-2 bg-white" onClick={() => router.push("/superadmin/addons/requests")}>
              <ClipboardList className="h-4 w-4" />
              Fulfillment Requests
            </Button>
            <Button size="sm" className="font-bold flex items-center gap-2 shadow-sm" onClick={() => router.push("/superadmin/addons/create")}>
              <Plus className="h-4 w-4" />
              New Add-on
            </Button>
          </div>
        }
      >
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard 
              title="Total Catalog" 
              value={addons.length} 
              icon={Boxes} 
              color="purple" 
              description="Extensions available"
            />
            <SummaryCard 
              title="Feature Packs" 
              value={featureCount} 
              icon={Sparkles} 
              color="emerald" 
              description="New capabilities"
            />
            <SummaryCard 
              title="Limit Boosters" 
              value={limitBoostCount} 
              icon={Zap} 
              color="blue" 
              description="Resource upgrades"
            />
            <SummaryCard 
              title="Active Now" 
              value={activeAddons} 
              icon={Activity} 
              color="emerald" 
              description="Published modules"
            />
          </div>

          {/* Table Section */}
          <motion.div variants={item} className="bg-white rounded-3xl border border-slate-100/20 shadow-sm overflow-hidden">
            {error ? (
              <div className="p-10 text-center">
                <Layers className="mx-auto h-10 w-10 text-red-500 mb-4" />
                <h3 className="text-lg font-bold text-slate-800">Marketplace Sync Error</h3>
                <p className="text-slate-500 max-w-sm mx-auto mt-1">{error}</p>
                <Button variant="outline" className="mt-6" onClick={() => fetchAddons()}>Retry Sync</Button>
              </div>
            ) : (
              <div className="p-1">
                <DataTable
                  data={addons}
                  columns={columns}
                  loading={loading}
                  pagination={{ pageSize: 10, pageSizeOptions: [10, 20, 50, 100] }}
                  searchable
                  filterable
                  onRowClick={(row) => router.push(`/superadmin/addons/${row.id}`)}
                  emptyMessage="Marketplace is empty. Start by creating modular system add-ons."
                  className="border-none shadow-none"
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      </PageLayout>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedAddon(null);
        }}
        onConfirm={handleDelete}
        title="Destroy Addon"
        message={`Warning: Destroying "${selectedAddon?.name}" is permanent. This module will be removed from all future tenant catalogs. Continue?`}
        danger
        confirmationText="DESTROY PERMANENTLY"
      />
    </>
  );
}
