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
import { 
  Plus, 
  Eye, 
  Ban, 
  CheckCircle2, 
  Search, 
  Filter, 
  Download,
  Users,
  TrendingUp,
  AlertCircle,
  Clock,
  Globe,
  MoreVertical,
  Activity
} from "lucide-react";
import { format } from "date-fns";
import type { SuperAdminTenant } from "@/lib/api/types";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
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
  value: number;
  icon: any;
  color: "blue" | "emerald" | "amber" | "rose";
  description: string;
}

function SummaryCard({ title, value, icon: Icon, color, description }: SummaryCardProps) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };

  return (
    <motion.div variants={item} className={cn("p-5 rounded-2xl border border-slate-100/20 bg-white shadow-sm flex items-start gap-4", colors[color])}>
      <div className={cn("p-3 rounded-xl", colors[color])}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold tracking-widest opacity-70 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 leading-none mb-1">{value}</h3>
        <p className="text-xs text-slate-500 font-medium">{description}</p>
      </div>
    </motion.div>
  );
}

export default function TenantsPage() {
  const router = useRouter();
  const store = useSuperAdminStore();
  const tenants = store.tenants || [];
  const { loading, error, fetchTenants, suspendTenant, unsuspendTenant } = store;
  const [selectedTenant, setSelectedTenant] = useState<SuperAdminTenant | null>(null);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [unsuspendModalOpen, setUnsuspendModalOpen] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const activeCount = tenants.filter(t => t.status === "active").length;
  const suspendedCount = tenants.filter(t => t.status === "suspended").length;
  const pendingCount = tenants.filter(t => t.status === "pending").length;

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
      title: "Organization",
      sortable: true,
      filterable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
            {String(value).charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 leading-none mb-1">{value}</span>
            <span className="text-[10px] font-medium text-slate-400 font-mono">ID: {row.id ? row.id.substring(0, 8) : "N/A"}...</span>
          </div>
        </div>
      ),
    },
    {
      key: "plan",
      title: "Plan",
      sortable: true,
      filterable: true,
      render: (_, row) => {
        const planDisplay = row.plan_name || row.plan_code || "Unassigned";
        return (
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-tight",
            row.plan_name || row.plan_code 
              ? "bg-purple-50 text-purple-600 border-purple-100" 
              : "bg-slate-50 text-slate-400 border-slate-100"
          )}>
            {planDisplay}
          </span>
        );
      },
    },
    {
      key: "domain",
      title: "System URL",
      filterable: true,
      render: (value, row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <Globe size={12} className="text-slate-400" />
            {value || "pending-dns.com"}
          </div>
          <code className="w-fit text-[10px] bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded border border-slate-100">
            /{row.slug}
          </code>
        </div>
      ),
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      filterable: true,
      render: (value, row) => <TenantStatusBadge status={row.status} size="sm" />,
    },
    {
      key: "billing_status",
      title: "Billing",
      sortable: true,
      filterable: true,
      render: (value) => (
        <StatusBadge
          status={value || "active"}
          variant={value === "active" ? "success" : value === "overdue" ? "error" : "info"}
          size="sm"
        />
      ),
    },
    {
      key: "created_at",
      title: "Registered",
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Clock size={12} className="text-slate-400" />
          {format(new Date(value), "MMM d, yyyy")}
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
              onClick={() => router.push(`/superadmin/tenants/${row.id}`)}
            >
              <Eye size={14} className="text-slate-400" />
              <span className="text-xs font-semibold">View Operations</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="flex items-center gap-2 py-2 px-3 rounded-lg focus:bg-slate-50 cursor-pointer"
              onClick={() => router.push(`/superadmin/tenants/${row.id}/edit`)}
            >
              <Plus size={14} className="text-slate-400" rotate={45} />
              <span className="text-xs font-semibold text-slate-600">Modify Data</span>
            </DropdownMenuItem>
            
            <div className="h-px bg-slate-100 my-1 mx-1" />
            
            {row.status === "active" ? (
              <DropdownMenuItem 
                className="flex items-center gap-2 py-2 px-3 rounded-lg focus:bg-red-50 text-red-600 cursor-pointer"
                onClick={() => {
                  setSelectedTenant(row);
                  setSuspendModalOpen(true);
                }}
              >
                <Ban size={14} />
                <span className="text-xs font-bold">Suspend System</span>
              </DropdownMenuItem>
            ) : row.status === "suspended" ? (
              <DropdownMenuItem 
                className="flex items-center gap-2 py-2 px-3 rounded-lg focus:bg-green-50 text-green-600 cursor-pointer"
                onClick={() => {
                  setSelectedTenant(row);
                  setUnsuspendModalOpen(true);
                }}
              >
                <CheckCircle2 size={14} />
                <span className="text-xs font-bold">Unsuspend Access</span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <PageLayout
        title="Tenant Management"
        subtitle="Manage platform organizations, system access, and subscription statuses."
        breadcrumbs={[
          { label: "Super Admin", href: "/superadmin" },
          { label: "Tenants" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2 font-bold bg-white">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="sm" className="flex items-center gap-2 font-bold shadow-sm" onClick={() => router.push("/superadmin/tenants/create")}>
              <Plus className="h-4 w-4" />
              New Organization
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
              title="Total Entities" 
              value={tenants.length} 
              icon={Users} 
              color="blue" 
              description="Registered organizations"
            />
            <SummaryCard 
              title="Active Now" 
              value={activeCount} 
              icon={TrendingUp} 
              color="emerald" 
              description="Running systems"
            />
            <SummaryCard 
              title="Pending" 
              value={pendingCount} 
              icon={Activity} 
              color="amber" 
              description="Awaiting verification"
            />
            <SummaryCard 
              title="Suspended" 
              value={suspendedCount} 
              icon={AlertCircle} 
              color="rose" 
              description="Access restricted"
            />
          </div>

          {/* Table Section */}
          <motion.div variants={item} className="bg-white rounded-3xl border border-slate-100/20 shadow-sm overflow-hidden">
            {error ? (
              <div className="p-10 text-center">
                <AlertCircle className="mx-auto h-10 w-10 text-red-500 mb-4" />
                <h3 className="text-lg font-bold text-slate-800">Error loading tenants</h3>
                <p className="text-slate-500 max-w-sm mx-auto mt-1">{error}</p>
                <Button variant="outline" className="mt-6" onClick={() => fetchTenants()}>Retry Loading</Button>
              </div>
            ) : (
              <div className="p-1">
                <DataTable
                  data={tenants}
                  columns={columns}
                  loading={loading}
                  pagination={{ pageSize: 10, pageSizeOptions: [10, 20, 50, 100] }}
                  searchable
                  filterable
                  onRowClick={(row) => router.push(`/superadmin/tenants/${row.id}`)}
                  emptyMessage="No organizations found. Start by creating a new tenant entity."
                  className="border-none shadow-none"
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      </PageLayout>

      <ConfirmModal
        isOpen={suspendModalOpen}
        onClose={() => {
          setSuspendModalOpen(false);
          setSelectedTenant(null);
        }}
        onConfirm={handleSuspend}
        title="Suspend Access"
        message={`Are you sure you want to suspend access for "${selectedTenant?.name}"? All users under this organization will be locked out immediately.`}
        danger
        confirmationText="BLOCK ACCESS"
      />

      <ConfirmModal
        isOpen={unsuspendModalOpen}
        onClose={() => {
          setUnsuspendModalOpen(false);
          setSelectedTenant(null);
        }}
        onConfirm={handleUnsuspend}
        title="Restore Access"
        message={`Restore system access for "${selectedTenant?.name}"? users will be able to log in again immediately.`}
        confirmationText="RESTORE ACCESS"
      />
    </>
  );
}
