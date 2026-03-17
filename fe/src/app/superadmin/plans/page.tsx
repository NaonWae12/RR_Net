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
  List, 
  Layers, 
  TrendingUp, 
  Globe, 
  Lock, 
  MoreVertical,
  Activity,
  CreditCard,
  Target,
  Settings2
} from "lucide-react";
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
  color: "indigo" | "emerald" | "blue" | "violet";
  description: string;
}

function SummaryCard({ title, value, icon: Icon, color, description }: SummaryCardProps) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100",
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

export default function PlansPage() {
  const router = useRouter();
  const store = useSuperAdminStore();
  const plans = store.plans || [];
  const { loading, error, fetchPlans, deletePlan } = store;
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const activePlans = plans.filter(p => p.is_active).length;
  const publicPlans = plans.filter(p => p.is_public).length;
  const avgMonthly = plans.length > 0 
    ? plans.reduce((acc, p) => acc + p.price_monthly, 0) / plans.length 
    : 0;

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

  const columns: DataTableColumn<Plan>[] = [
    {
      key: "name",
      title: "Plan Strategy",
      sortable: true,
      filterable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
            <Layers size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 leading-none mb-1">{value}</span>
            <div className="flex items-center gap-2">
              <code className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-mono font-bold uppercase">
                {row.code}
              </code>
              <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
                {row.description || "No description provided"}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "price_monthly",
      title: "Pricing (Monthly)",
      sortable: true,
      render: (value) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{formatCurrency(value)}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">per month</span>
        </div>
      ),
    },
    {
      key: "price_yearly",
      title: "Pricing (Yearly)",
      sortable: true,
      render: (value) => (
        <div className="flex flex-col">
          <span className="font-bold text-emerald-600">{value ? formatCurrency(value) : "-"}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">billed annually</span>
        </div>
      ),
    },
    {
      key: "is_active",
      title: "Status",
      sortable: true,
      filterable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          {value ? (
            <StatusBadge status="Active" variant="success" size="sm" />
          ) : (
            <StatusBadge status="Draft" variant="info" size="sm" />
          )}
        </div>
      ),
    },
    {
      key: "is_public",
      title: "Visibility",
      sortable: true,
      filterable: true,
      render: (value) => (
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-tight">
          {value ? (
            <span className="text-blue-600 flex items-center gap-1">
              <Globe size={12} /> Public
            </span>
          ) : (
            <span className="text-slate-400 flex items-center gap-1">
              <Lock size={12} /> Private
            </span>
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
              onClick={() => router.push(`/superadmin/plans/${row.id}`)}
            >
              <Eye size={14} className="text-slate-400" />
              <span className="text-xs font-semibold">View Details</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="flex items-center gap-2 py-2 px-3 rounded-lg focus:bg-slate-50 cursor-pointer"
              onClick={() => router.push(`/superadmin/plans/${row.id}/edit`)}
            >
              <Edit size={14} className="text-slate-400" />
              <span className="text-xs font-semibold">Edit Configuration</span>
            </DropdownMenuItem>
            
            <div className="h-px bg-slate-100 my-1 mx-1" />
            
            <DropdownMenuItem 
              className="flex items-center gap-2 py-2 px-3 rounded-lg focus:bg-red-50 text-red-600 cursor-pointer"
              onClick={() => {
                setSelectedPlan(row);
                setDeleteModalOpen(true);
              }}
            >
              <Trash2 size={14} />
              <span className="text-xs font-bold">Retire Plan</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <PageLayout
        title="Subscription Plans"
        subtitle="Design and manage tiers, pricing models, and system features for your tenants."
        breadcrumbs={[
          { label: "Super Admin", href: "/superadmin" },
          { label: "Plans" },
        ]}
        actions={
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="font-bold flex items-center gap-2 bg-white">
                  <List className="h-4 w-4" />
                  Compare Features
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-0 border-none shadow-2xl">
                <div className="p-8">
                  <DialogHeader className="mb-8 flex flex-row items-center justify-between">
                    <div>
                      <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <Target className="text-indigo-600" /> Feature Matrix
                      </DialogTitle>
                      <DialogDescription className="text-slate-500 font-medium mt-1">
                        Detailed comparison of system capabilities across subscription tiers.
                      </DialogDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => router.push("/superadmin/plans/matrix")}
                      className="hidden md:flex items-center gap-2"
                    >
                      <Settings2 className="h-4 w-4" />
                      Configure Matrix
                    </Button>
                  </DialogHeader>
                  <FeatureComparisonTable />
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" className="font-bold flex items-center gap-2 shadow-sm" onClick={() => router.push("/superadmin/plans/create")}>
              <Plus className="h-4 w-4" />
              New Tier
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
              title="Global Plans" 
              value={plans.length} 
              icon={Layers} 
              color="indigo" 
              description="Total tier types"
            />
            <SummaryCard 
              title="Market Active" 
              value={activePlans} 
              icon={Activity} 
              color="emerald" 
              description="Active in commerce"
            />
            <SummaryCard 
              title="Public Offer" 
              value={publicPlans} 
              icon={Globe} 
              color="blue" 
              description="Visible to prospects"
            />
            <SummaryCard 
              title="Avg. Monthly" 
              value={formatCurrency(avgMonthly, true)} 
              icon={CreditCard} 
              color="violet" 
              description="Revenue baseline"
            />
          </div>

          {/* Table Section */}
          <motion.div variants={item} className="bg-white rounded-3xl border border-slate-100/20 shadow-sm overflow-hidden">
            {error ? (
              <div className="p-10 text-center">
                <TrendingUp className="mx-auto h-10 w-10 text-red-500 mb-4 rotate-180" />
                <h3 className="text-lg font-bold text-slate-800">Operational Sync Error</h3>
                <p className="text-slate-500 max-w-sm mx-auto mt-1">{error}</p>
                <Button variant="outline" className="mt-6" onClick={() => fetchPlans()}>Retry Fetch</Button>
              </div>
            ) : (
              <div className="p-1">
                <DataTable
                  data={plans}
                  columns={columns}
                  loading={loading}
                  pagination={{ pageSize: 10, pageSizeOptions: [10, 20, 50, 100] }}
                  searchable
                  filterable
                  onRowClick={(row) => router.push(`/superadmin/plans/${row.id}`)}
                  emptyMessage="No catalog data found. Start by defining your first subscription tier."
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
          setSelectedPlan(null);
        }}
        onConfirm={handleDelete}
        title="Retire Tier"
        message={`Retiring the "${selectedPlan?.name}" plan will stop new signups. Active tenants will maintain access until migration. Continue?`}
        danger
        confirmationText="RETIRE PLAN"
      />
    </>
  );
}
