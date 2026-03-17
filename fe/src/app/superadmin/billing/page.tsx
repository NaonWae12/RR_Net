"use client";

import React, { useEffect, useState } from "react";
import { PageLayout } from "@/components/layouts";
import { subscriptionService, PlatformInvoice } from "@/lib/api/subscriptionService";
import { paymentMethodService, PaymentMethod, CreatePaymentMethodRequest } from "@/lib/api/paymentMethodService";
import { platformDiscountService, PlatformDiscount, CreatePlatformDiscountRequest } from "@/lib/api/platformDiscountService";
import { LoadingSpinner } from "@/components/utilities";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  Download,
  MoreVertical,
  Plus,
  RefreshCcw,
  FileText,
  DollarSign,
  Wallet,
  Edit,
  Trash2,
  Ticket,
  Percent,
  Calendar,
  Tag
} from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/tables";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "@/components/feedback";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/utilities";
import { PaymentMethodModal } from "@/components/superadmin/PaymentMethodModal";
import { DiscountModal } from "@/components/superadmin/DiscountModal";

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

type TabType = "invoices" | "payment-methods" | "discounts";

export default function SuperAdminBillingPage() {
  const [activeTab, setActiveTab] = useState<TabType>("invoices");
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [discounts, setDiscounts] = useState<PlatformDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<PlatformDiscount | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [discountModalMode, setDiscountModalMode] = useState<"create" | "edit">("create");

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const data = await subscriptionService.listAllInvoices();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("[BillingPage] Failed to fetch invoices:", error);
      toast({
        type: "error",
        title: "Sync Error",
        message: error.message || "Failed to retrieve platform billing records."
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const data = await paymentMethodService.listSuperAdmin();
      setPaymentMethods(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("[BillingPage] Failed to fetch payment methods:", error);
      toast({
        type: "error",
        title: "Fetch Error",
        message: error.message || "Failed to retrieve payment methods."
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const data = await platformDiscountService.list();
      setDiscounts(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("[BillingPage] Failed to fetch discounts:", error);
      toast({
        type: "error",
        title: "Fetch Error",
        message: error.message || "Failed to retrieve promotional discounts."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMethod = async (data: any) => {
    try {
      const payload: CreatePaymentMethodRequest = {
        ...data,
        metadata: {},
      };
      await paymentMethodService.createSuperAdmin(payload);
      toast({
        type: "success",
        title: "Success",
        message: "Payment method created successfully"
      });
      fetchPaymentMethods();
    } catch (error: any) {
      toast({
        type: "error",
        title: "Creation Failed",
        message: error.message || "Failed to create payment method"
      });
      throw error;
    }
  };

  const handleUpdateMethod = async (data: any) => {
    if (!selectedMethod) return;
    try {
      await paymentMethodService.updateSuperAdmin(selectedMethod.id, {
        ...data,
        metadata: {},
      });
      toast({
        type: "success",
        title: "Success",
        message: "Payment method updated successfully"
      });
      fetchPaymentMethods();
    } catch (error: any) {
      toast({
        type: "error",
        title: "Update Failed",
        message: error.message || "Failed to update payment method"
      });
      throw error;
    }
  };

  const handleDeleteMethod = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment method?")) return;
    
    try {
      await paymentMethodService.deleteSuperAdmin(id);
      toast({
        type: "success",
        title: "Success",
        message: "Payment method deleted successfully"
      });
      fetchPaymentMethods();
    } catch (error: any) {
      toast({
        type: "error",
        title: "Deletion Failed",
        message: error.message || "Failed to delete payment method"
      });
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await paymentMethodService.toggleSuperAdminStatus(id);
      toast({
        type: "success",
        title: "Success",
        message: "Payment method status updated"
      });
      fetchPaymentMethods();
    } catch (error: any) {
      toast({
        type: "error",
        title: "Update Failed",
        message: error.message || "Failed to update status"
      });
    }
  };

  const handleCreateDiscount = async (data: CreatePlatformDiscountRequest) => {
    try {
      await platformDiscountService.create(data);
      toast({
        type: "success",
        title: "Success",
        message: "Discount code created successfully"
      });
      fetchDiscounts();
    } catch (error: any) {
      toast({
        type: "error",
        title: "Creation Failed",
        message: error.message || "Failed to create discount code"
      });
      throw error;
    }
  };

  const handleUpdateDiscount = async (data: CreatePlatformDiscountRequest) => {
    if (!selectedDiscount) return;
    try {
      await platformDiscountService.update(selectedDiscount.id, data);
      toast({
        type: "success",
        title: "Success",
        message: "Discount updated successfully"
      });
      fetchDiscounts();
    } catch (error: any) {
      toast({
        type: "error",
        title: "Update Failed",
        message: error.message || "Failed to update discount"
      });
      throw error;
    }
  };

  const handleDeleteDiscount = async (id: string) => {
    if (!confirm("Are you sure you want to delete this discount?")) return;
    try {
      await platformDiscountService.delete(id);
      toast({
        type: "success",
        title: "Success",
        message: "Discount deleted successfully"
      });
      fetchDiscounts();
    } catch (error: any) {
      toast({
        type: "error",
        title: "Deletion Failed",
        message: error.message || "Failed to delete discount"
      });
    }
  };

  const openCreateModal = () => {
    setSelectedMethod(null);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const openEditModal = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (activeTab === "invoices") {
      fetchInvoices();
    } else if (activeTab === "payment-methods") {
      fetchPaymentMethods();
    } else if (activeTab === "discounts") {
      fetchDiscounts();
    }
  }, [activeTab]);

  const handleVerify = async (invoiceId: string, approved: boolean) => {
    try {
      const payments = await subscriptionService.listPayments(invoiceId);
      const pendingPayment = payments.find((p) => p.status === 'pending');
      
      if (!pendingPayment) {
        toast({
          type: "warning",
          title: "No Pending Payment",
          message: "Could not find a pending payment record for this invoice."
        });
        return;
      }

      await subscriptionService.verifyPayment(pendingPayment.id, approved);
      toast({
        type: "success",
        title: approved ? "Payment Verified" : "Payment Rejected",
        message: `Invoice #${invoices.find(i => i.id === invoiceId)?.invoice_number} has been updated.`
      });
      fetchInvoices();
    } catch (error) {
      console.error("[BillingPage] Verification failed:", error);
      toast({
        type: "error",
        title: "Action Failed",
        message: "Unable to process payment verification at this time."
      });
    }
  };

  const stats = {
    total: invoices.length,
    pending: Array.isArray(invoices) ? invoices.filter((i) => i.status === "pending").length : 0,
    overdue: Array.isArray(invoices) ? invoices.filter((i) => i.status === "overdue").length : 0,
    revenue: Array.isArray(invoices) 
      ? invoices
          .filter((i) => i.status === "paid")
          .reduce((acc, curr) => acc + curr.amount, 0)
      : 0,
  };

  const invoiceColumns: DataTableColumn<PlatformInvoice>[] = [
    {
      key: "invoice_number",
      title: "Invoice Identity",
      sortable: true,
      filterable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
            <FileText size={18} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 leading-none mb-1">{value}</span>
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">Ref: {row.id.substring(0, 8)}</span>
          </div>
        </div>
      ),
    },
    {
      key: "tenant_name",
      title: "Organization",
      sortable: true,
      filterable: true,
      render: (value) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-700">{value}</span>
          <span className="text-[10px] text-slate-400 font-medium">Platform Partner</span>
        </div>
      ),
    },
    {
      key: "plan_name",
      title: "Tier Type",
      sortable: true,
      filterable: true,
      render: (value) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 w-fit uppercase tracking-tight">
          {value}
        </div>
      ),
    },
    {
      key: "amount",
      title: "Billable Amount",
      sortable: true,
      render: (value, row: PlatformInvoice) => (
        <div className="flex flex-col">
          {row.discount_amount > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 line-through">{formatCurrency(row.subtotal)}</span>
              <span className="text-[10px] text-emerald-500 font-bold">-{formatCurrency(row.discount_amount)}</span>
            </div>
          )}
          <span className="font-bold text-slate-900">{formatCurrency(value)}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Revenue Pool</span>
        </div>
      ),
    },
    {
      key: "period_start",
      title: "Billed For",
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <Clock size={12} className="text-slate-400" />
          {format(new Date(value), "MMMM yyyy")}
        </div>
      ),
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      filterable: true,
      render: (value) => (
        <StatusBadge 
          status={value} 
          variant={value === "paid" ? "success" : value === "pending" ? "warning" : "error"}
          size="sm"
        />
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
          <DropdownMenuContent align="end" className="w-56 p-1 rounded-xl shadow-xl border-slate-100">
            {row.status === "pending" && (
              <>
                <DropdownMenuItem 
                  className="flex items-center gap-2 py-2 px-3 rounded-lg focus:bg-emerald-50 text-emerald-600 cursor-pointer"
                  onClick={() => handleVerify(row.id, true)}
                >
                  <CheckCircle size={14} />
                  <span className="text-xs font-bold font-jakarta">Approve Settlements</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 py-2 px-3 rounded-lg focus:bg-rose-50 text-rose-600 cursor-pointer"
                  onClick={() => handleVerify(row.id, false)}
                >
                  <XCircle size={14} />
                  <span className="text-xs font-bold font-jakarta">Reject Evidence</span>
                </DropdownMenuItem>
                <div className="h-px bg-slate-100 my-1 mx-1" />
              </>
            )}
            <DropdownMenuItem 
              className="flex items-center gap-2 py-2 px-3 rounded-lg focus:bg-slate-50 cursor-pointer font-jakarta"
              onClick={() => {}}
            >
              <Download size={14} className="text-slate-400" />
              <span className="text-xs font-semibold">Download PDF Statement</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const discountColumns: DataTableColumn<PlatformDiscount>[] = [
    {
      key: "code",
      title: "Promo Code",
      sortable: true,
      filterable: true,
      render: (value) => (
        <div className="flex items-center gap-3 py-1">
          <div className="h-9 w-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Ticket size={18} />
          </div>
          <span className="font-black italic tracking-widest text-purple-600">{value}</span>
        </div>
      ),
    },
    {
      key: "name",
      title: "Discount Name",
      sortable: true,
      filterable: true,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800">{value}</span>
          <span className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{row.description || "No description"}</span>
        </div>
      ),
    },
    {
      key: "type",
      title: "Type",
      render: (value, row) => (
        <div className="flex items-center gap-2">
          {value === "percent" ? <Percent size={14} className="text-blue-500" /> : <DollarSign size={14} className="text-emerald-500" />}
          <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{value}</span>
        </div>
      ),
    },
    {
      key: "value",
      title: "Reward Value",
      sortable: true,
      render: (value, row) => (
        <div className="font-black text-slate-900">
          {row.type === "percent" ? `${value}%` : formatCurrency(value)}
        </div>
      ),
    },
    {
      key: "used_count",
      title: "Usage",
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-700">{value} Redemptions</span>
          <span className="text-[10px] text-slate-400 font-medium">Limit: {row.usage_limit || "∞"}</span>
        </div>
      ),
    },
    {
      key: "expires_at",
      title: "Availability",
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium whitespace-nowrap">
          <Calendar size={12} className="text-slate-400" />
          {value ? format(new Date(value), "MMM d, yyyy") : <span className="text-slate-400 italic">No Expiry</span>}
        </div>
      ),
    },
    {
      key: "is_active",
      title: "Status",
      sortable: true,
      render: (value) => (
        <StatusBadge 
          status={value ? "active" : "inactive"} 
          variant={value ? "success" : "default"}
          size="sm"
        />
      ),
    },
    {
      key: "actions",
      title: "",
      align: "right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-slate-100 text-slate-400 hover:text-purple-600"
            onClick={() => {
              setSelectedDiscount(row);
              setDiscountModalMode("edit");
              setIsDiscountModalOpen(true);
            }}
          >
            <Edit size={16} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-slate-100 text-slate-400 hover:text-rose-600"
            onClick={() => handleDeleteDiscount(row.id)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  const handleGenerateInvoices = async () => {
    try {
      await subscriptionService.generateInvoices();
      toast({
        type: "success",
        title: "Batch Generation Success",
        message: "New period invoices have been provisioned for all tenants."
      });
      fetchInvoices();
    } catch (error) {
      toast({
        type: "error",
        title: "Generation Error",
        message: "Could not initiate batch invoice generation."
      });
    }
  };

  const tabs = [
    { id: "invoices" as TabType, label: "Platform Invoices", icon: FileText },
    { id: "payment-methods" as TabType, label: "Payment Methods", icon: Wallet },
    { id: "discounts" as TabType, label: "Platform Discounts", icon: Tag },
  ];

  return (
    <PageLayout
      title="Settlements & Billing"
      subtitle="Oversee platform revenue, subscription invoices, and payment configurations."
      breadcrumbs={[
        { label: "Super Admin", href: "/superadmin" },
        { label: "Billing" },
      ]}
      actions={
        activeTab === "invoices" ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="font-bold flex items-center gap-2 bg-white" onClick={fetchInvoices}>
              <RefreshCcw className="h-4 w-4" />
              Sync Ledger
            </Button>
            <Button size="sm" className="font-bold flex items-center gap-2 shadow-sm" onClick={handleGenerateInvoices}>
              <Plus className="h-4 w-4" />
              Generate Period Batch
            </Button>
          </div>
        ) : activeTab === "payment-methods" ? (
          <Button size="sm" className="font-bold flex items-center gap-2 shadow-sm" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Add Payment Method
          </Button>
        ) : (
          <Button size="sm" className="font-bold flex items-center gap-2 shadow-sm" onClick={() => {
            setSelectedDiscount(null);
            setDiscountModalMode("create");
            setIsDiscountModalOpen(true);
          }}>
            <Plus className="h-4 w-4" />
            Create Discount Code
          </Button>
        )
      }
    >
      {/* Tab Navigation */}
      <div className="border-b border-slate-200 mb-8">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all relative",
                  activeTab === tab.id
                    ? "text-purple-600"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Icon size={16} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "invoices" && (
          <motion.div
            key="invoices"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Analytics Section */}
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <SummaryCard 
                title="Registry Total" 
                value={stats.total} 
                icon={CreditCard} 
                color="blue" 
                description="All platform records"
              />
              <SummaryCard 
                title="Pending Verification" 
                value={stats.pending} 
                icon={Clock} 
                color="amber" 
                description="Awaiting admin action"
              />
              <SummaryCard 
                title="Overdue Accounts" 
                value={stats.overdue} 
                icon={AlertCircle} 
                color="rose" 
                description="Subscription risk"
              />
              <SummaryCard 
                title="Gross Revenue" 
                value={formatCurrency(stats.revenue, true)} 
                icon={TrendingUp} 
                color="emerald" 
                description="Settled settlements"
              />
            </motion.div>

            {/* Audit Log / Table Section */}
            <motion.div variants={item} className="bg-white rounded-3xl border border-slate-100/20 shadow-sm overflow-hidden">
              <div className="p-1">
                <DataTable
                  data={invoices}
                  columns={invoiceColumns}
                  loading={loading}
                  pagination={{ pageSize: 15, pageSizeOptions: [15, 30, 50] }}
                  searchable
                  filterable
                  emptyMessage="Ledger is empty. Use 'Generate Period Batch' to initiate billing cycles."
                  className="border-none shadow-none"
                />
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "payment-methods" && (
          <motion.div
            key="payment-methods"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Payment Methods Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner />
              </div>
            ) : paymentMethods.length === 0 ? (
              <motion.div
                variants={item}
                className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl border border-purple-100 p-12 text-center"
              >
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <Wallet className="w-10 h-10 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No Payment Methods Yet</h3>
                <p className="text-slate-600 mb-6 max-w-md mx-auto">
                  Configure payment methods that will be displayed to tenants during subscription payments.
                </p>
                <Button size="sm" className="font-bold bg-purple-600 hover:bg-purple-700" onClick={openCreateModal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Payment Method
                </Button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.isArray(paymentMethods) && paymentMethods.map((method) => {
                  const getCategoryIcon = () => {
                    switch (method.category) {
                      case "bank":
                        return { icon: CreditCard, color: "blue" };
                      case "e-wallet":
                        return { icon: Wallet, color: "emerald" };
                      case "cash":
                        return { icon: DollarSign, color: "amber" };
                      default:
                        return { icon: CreditCard, color: "blue" };
                    }
                  };

                  const { icon: Icon, color } = getCategoryIcon();
                  const colorClasses = {
                    blue: "bg-blue-50 text-blue-600",
                    emerald: "bg-emerald-50 text-emerald-600",
                    amber: "bg-amber-50 text-amber-600",
                  };

                  return (
                    <motion.div
                      key={method.id}
                      variants={item}
                      className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", colorClasses[color])}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">{method.name}</h3>
                            <p className="text-xs text-slate-400 font-medium capitalize">{method.category}</p>
                          </div>
                        </div>
                        <StatusBadge 
                          status={method.is_active ? "active" : "inactive"} 
                          variant={method.is_active ? "success" : "default"} 
                          size="sm" 
                        />
                      </div>

                      <div className="space-y-3 mb-4">
                        {method.provider && (
                          <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-xs text-slate-500 font-medium">
                              {method.category === "bank" ? "Bank Name" : "Provider"}
                            </span>
                            <span className="text-sm font-bold text-slate-900">{method.provider}</span>
                          </div>
                        )}
                        {method.account_number && (
                          <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-xs text-slate-500 font-medium">
                              {method.category === "bank" ? "Account Number" : "Phone Number"}
                            </span>
                            <span className="text-sm font-bold text-slate-900">{method.account_number}</span>
                          </div>
                        )}
                        {method.account_name && (
                          <div className="flex justify-between items-center py-2">
                            <span className="text-xs text-slate-500 font-medium">Account Name</span>
                            <span className="text-sm font-bold text-slate-900">{method.account_name}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 font-bold"
                          onClick={() => openEditModal(method)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={cn(
                            "font-bold",
                            method.is_active 
                              ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
                              : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          )}
                          onClick={() => handleToggleStatus(method.id)}
                        >
                          {method.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteMethod(method.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Info Card */}
            <motion.div
              variants={item}
              className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl border border-purple-100 p-8"
            >
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <AlertCircle className="w-8 h-8 text-purple-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-900">Payment Method Configuration</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Configure payment methods that will be displayed to tenants during subscription payments. 
                    Active methods will appear on tenant invoices and payment pages. You can add bank transfers, 
                    e-wallets, or integrate with payment gateways like Midtrans, Xendit, or Stripe.
                  </p>
                  <div className="pt-2">
                    <Button size="sm" className="font-bold bg-purple-600 hover:bg-purple-700" onClick={openCreateModal}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Payment Method
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "discounts" && (
          <motion.div
            key="discounts"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6 font-jakarta"
          >
            {/* Discounts Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                  <Tag size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Coupons</p>
                  <p className="text-2xl font-black text-slate-800 tracking-tighter">{discounts.length}</p>
                </div>
              </div>
              <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Promos</p>
                  <p className="text-2xl font-black text-slate-800 tracking-tighter">
                    {Array.isArray(discounts) ? discounts.filter(d => d.is_active).length : 0}
                  </p>
                </div>
              </div>
              <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Redemptions</p>
                  <p className="text-2xl font-black text-slate-800 tracking-tighter">
                    {Array.isArray(discounts) ? discounts.reduce((acc, curr) => acc + curr.used_count, 0) : 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Discounts Table */}
            <motion.div variants={item} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-1">
                <DataTable
                  data={discounts}
                  columns={discountColumns}
                  loading={loading}
                  pagination={{ pageSize: 15 }}
                  searchable
                  emptyMessage="No platform discounts configured yet."
                  className="border-none shadow-none"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Method Modal */}
      <PaymentMethodModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={modalMode === "create" ? handleCreateMethod : handleUpdateMethod}
        initialData={selectedMethod ? {
          name: selectedMethod.name,
          category: selectedMethod.category,
          provider: selectedMethod.provider || undefined,
          account_number: selectedMethod.account_number || undefined,
          account_name: selectedMethod.account_name || undefined,
          is_active: selectedMethod.is_active,
        } : undefined}
        mode={modalMode}
      />

      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        onSubmit={discountModalMode === "create" ? handleCreateDiscount : handleUpdateDiscount}
        initialData={selectedDiscount ? {
          code: selectedDiscount.code,
          name: selectedDiscount.name,
          description: selectedDiscount.description,
          type: selectedDiscount.type,
          value: selectedDiscount.value,
          min_purchase: selectedDiscount.min_purchase,
          max_discount: selectedDiscount.max_discount,
          usage_limit: selectedDiscount.usage_limit,
          expires_at: selectedDiscount.expires_at,
          is_active: selectedDiscount.is_active,
        } : undefined}
        mode={discountModalMode}
      />
    </PageLayout>
  );
}
