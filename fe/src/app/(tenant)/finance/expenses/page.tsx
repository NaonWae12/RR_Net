"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PageLayout } from "@/components/layouts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  PlusIcon, 
  ArrowUpRightIcon, 
  BanknotesIcon,
  ShoppingBagIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  EyeIcon,
  CalendarIcon,
  TagIcon,
  DocumentTextIcon,
  UserIcon,
  CheckBadgeIcon
} from "@heroicons/react/24/outline";
import { financeService } from "@/lib/api/financeService";
import { hrService } from "@/lib/api/hrService";
import { Reimbursement } from "@/lib/api/types";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format, addDays, isAfter } from "date-fns";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";

interface PaymentMethodAccount {
  id: string;
  name: string;
  category: string;
  provider?: string;
  account_number?: string;
  is_active: boolean;
}

export default function ExpensesPage() {
  const [filter, setFilter] = useState("all");
  const { showToast } = useNotificationStore();
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]); // Added expenses state
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Confirmation Modal State
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    id: string;
    type: "reimbursement" | "payslip" | "payroll_run" | "equipment" | "expense";
    title: string;
    amount: number;
  } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodAccount[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  
  // New Equipment Modal State
  const [showNewEquip, setShowNewEquip] = useState(false);
  const [newEquip, setNewEquip] = useState({
    title: "",
    amount: 0,
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    payNow: false,
    paymentMethodId: "",
    paymentRef: ""
  });

  // New Operational Expense Modal State
  const [showNewExpense, setShowNewExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({
    title: "",
    amount: 0,
    date: format(new Date(), "yyyy-MM-dd"),
    category: "bandwidth",
    description: "",
    isRecurring: false,
    recurringDay: 1,
    recurringEndAt: "",
    payNow: false,
    paymentMethodId: "",
    paymentRef: ""
  });

  const fetchData = useCallback(async () => {
    try {
      const [reimbData, payrollData, methodsData, expensesData] = await Promise.all([
        financeService.getAllReimbursements(),
        hrService.getPayrollRuns(),
        financeService.getPaymentMethods(),
        financeService.getExpenses() // Fetch expenses
      ]);
      setReimbursements(reimbData);
      setPayrollRuns(payrollData);
      setExpenses(expensesData); // Set expenses state
      setPaymentMethods(methodsData.filter((m: any) => m.is_active));
      if (methodsData.length > 0) {
        const firstActive = methodsData.find((m: any) => m.is_active);
        if (firstActive) setSelectedPaymentMethodId(firstActive.id);
      }
    } catch (err: any) {
      showToast({
        title: "Error",
        description: err?.message || "Failed to load data",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkAsPaid = async (id: string, method?: string, ref?: string) => {
    try {
      setProcessingId(id);
      
      const expense = [...mappedReimbursements, ...mappedExpenses].find(e => e.id === id);
      
      if (expense?.type === "equipment" || expense?.type === "expense") {
        // Use expense API
        await financeService.markExpenseAsPaid(id, method || "", ref || "");
      } else {
        // Use reimbursement API
        await financeService.markAsPaid(id, method, ref);
      }
      
      showToast({
        title: "Payment Recorded",
        description: (expense?.type === "equipment" || expense?.type === "expense") ? "Expense has been marked as paid." : "Reimbursement has been marked as paid.",
        variant: "success",
      });
      
      const [reimbData, payrollData, expensesData] = await Promise.all([
        financeService.getAllReimbursements(),
        hrService.getPayrollRuns(),
        financeService.getExpenses()
      ]);
      setReimbursements(reimbData);
      setPayrollRuns(payrollData);
      setExpenses(expensesData);

      // Update selectedExpense if it's the one we just paid
      if (selectedExpense) {
        if ((selectedExpense.type === "reimbursement" || selectedExpense.type === "equipment" || selectedExpense.type === "expense") && selectedExpense.id === id) {
          const updatedReimb = reimbData.find(r => r.id === id);
          if (updatedReimb) {
            setSelectedExpense({
              ...selectedExpense,
              status: updatedReimb.status,
              original: updatedReimb
            });
          } else {
             // Try find in expenses
             const updatedExpense = expensesData.find((e: any) => e.id === id);
             if (updatedExpense) {
               setSelectedExpense({
                 ...selectedExpense,
                 status: updatedExpense.status,
                 original: updatedExpense
               });
             }
          }
        }
      }
      setShowConfirm(false);
    } catch (err: any) {
      showToast({
        title: "Payment Failed",
        description: err?.message || "Failed to record payment",
        variant: "error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handlePayRun = async (runId: string, method?: string, ref?: string) => {
    try {
      setProcessingId(runId);
      await hrService.payPayrollRun(runId, method, ref);
      showToast({
        title: "Payroll Paid",
        description: "The entire payroll run has been marked as paid.",
        variant: "success",
      });
      
      const [reimbData, payrollData] = await Promise.all([
        financeService.getAllReimbursements(),
        hrService.getPayrollRuns()
      ]);
      setReimbursements(reimbData);
      setPayrollRuns(payrollData);
      
      if (selectedExpense && selectedExpense.id === runId) {
        const updated = payrollData.find((r: any) => r.id === runId);
        if (updated) {
          setSelectedExpense({
            ...selectedExpense,
            status: updated.status,
            original: updated
          });
        }
      }
      setShowConfirm(false);
    } catch (err: any) {
      showToast({
        title: "Payment Failed",
        description: err?.message || "Failed to process payroll payment",
        variant: "error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handlePayPayslip = async (payslipId: string, method?: string, ref?: string) => {
    try {
      setProcessingId(payslipId);
      await hrService.payPayslip(payslipId, method, ref);
      showToast({
        title: "Payslip Paid",
        description: "Employee has been marked as paid.",
        variant: "success",
      });
      // Refresh data
      const [reimbData, payrollData] = await Promise.all([
        financeService.getAllReimbursements(),
        hrService.getPayrollRuns()
      ]);
      setReimbursements(reimbData);
      setPayrollRuns(payrollData);
      
      // Find and update the selected expense in modal
      if (selectedExpense) {
        const updatedRun = payrollData.find((r: any) => r.id === selectedExpense.id);
        if (updatedRun) {
           setSelectedExpense({
             ...selectedExpense,
             status: updatedRun.status,
             original: updatedRun
           });
        }
      }
      setShowConfirm(false);
    } catch (err: any) {
      showToast({
        title: "Payment Failed",
        description: err?.message || "Failed to process payslip payment",
        variant: "error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openConfirmPayload = (id: string, type: any, title: string, amount: number) => {
    setConfirmData({ id, type, title, amount });
    if (paymentMethods.length > 0) {
      setSelectedPaymentMethodId(paymentMethods[0].id);
    }
    setPaymentRef("");
    setShowConfirm(true);
  };

  const handleCreateEquipment = async () => {
    try {
      setLoading(true);
      
      // Prepare expense data
      const expenseData: any = {
        title: newEquip.title,
        amount: newEquip.amount,
        date: new Date(newEquip.date).toISOString(), // Convert to ISO for backend
        category: "equipment",
        description: newEquip.description || ""
      };

      // If paying now, add payment details
      if (newEquip.payNow && newEquip.paymentMethodId) {
        expenseData.payment_method_id = newEquip.paymentMethodId;
        expenseData.payment_reference = newEquip.paymentRef || "";
      }

      await financeService.createExpense(expenseData);
      
      showToast({
        title: "Success",
        description: "Equipment record created successfully",
        variant: "success"
      });
      
      setShowNewEquip(false);
      setNewEquip({
        title: "",
        amount: 0,
        date: format(new Date(), "yyyy-MM-dd"),
        description: "",
        payNow: false,
        paymentMethodId: "",
        paymentRef: ""
      });
      await fetchData();
    } catch (err: any) {
      showToast({
        title: "Error",
        description: err.message || "Failed to create equipment",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async () => {
    try {
      setLoading(true);
      
      // Prepare operational expense data
      const expenseData: any = {
        title: newExpense.title,
        amount: Number(newExpense.amount),
        date: new Date(newExpense.date).toISOString(),
        category: newExpense.category,
        description: newExpense.description || "",
        is_recurring: newExpense.isRecurring,
      };

      // Handle recurring template fields
      if (newExpense.isRecurring) {
        expenseData.recurring_day = Number(newExpense.recurringDay);
        if (newExpense.recurringEndAt) {
          expenseData.recurring_end_at = new Date(newExpense.recurringEndAt).toISOString();
        }
      } else {
        // Instant payment for non-recurring expenses
        if (newExpense.payNow && newExpense.paymentMethodId) {
          expenseData.payment_method_id = newExpense.paymentMethodId;
          expenseData.payment_reference = newExpense.paymentRef || "";
        }
      }

      await financeService.createExpense(expenseData);
      
      showToast({
        title: "Success",
        description: newExpense.isRecurring ? "Recurring template created successfully" : "Expense record created successfully",
        variant: "success"
      });
      
      setShowNewExpense(false);
      setNewExpense({
        title: "",
        amount: 0,
        date: format(new Date(), "yyyy-MM-dd"),
        category: "bandwidth",
        description: "",
        isRecurring: false,
        recurringDay: 1,
        recurringEndAt: "",
        payNow: false,
        paymentMethodId: "",
        paymentRef: ""
      });
      await fetchData();
    } catch (err: any) {
      showToast({
        title: "Error",
        description: err.message || "Failed to create expense",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePayroll = async (id: string, enabled: boolean) => {
    // Save previous state for rollback
    const previousExpense = { ...selectedExpense };
    
    // Optimistic update for smooth animation
    if (selectedExpense?.id === id) {
      setSelectedExpense({
        ...selectedExpense,
        pay_with_payroll: enabled,
        original: { ...selectedExpense.original, pay_with_payroll: enabled }
      });
    }

    try {
      setProcessingId(id);
      await financeService.consolidateWithPayroll(id, enabled);
      showToast({
        title: "Preference Updated",
        description: enabled ? "Linked to next payroll payment." : "Removed from payroll consolidation.",
        variant: "success",
      });
      await fetchData();
    } catch (err: any) {
      // Rollback on failure
      if (selectedExpense?.id === id) {
        setSelectedExpense(previousExpense);
      }
      showToast({
        title: "Update Failed",
        description: err?.message || "Failed to update preference",
        variant: "error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy");
    } catch (e) {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string, payWithPayroll?: boolean, isRecurring?: boolean) => {
    if (isRecurring) {
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200">🔁 Recurring</Badge>;
    }
    if (status === "approved" && payWithPayroll) {
      return (
        <div className="flex flex-col items-center gap-1">
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] leading-tight px-1.5">Approved</Badge>
          <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] leading-tight px-1 uppercase font-bold tracking-tighter italic">Link to Payroll</Badge>
        </div>
      );
    }
    switch (status) {
      case "paid": return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Paid</Badge>;
      case "approved": return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Approved</Badge>;
      case "submitted": return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Submitted</Badge>;
      case "rejected": return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
      case "pending_payment": return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending Payment</Badge>;
      case "processing":
      case "draft": return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
      case "processed": return <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">Processed</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string, isRecurring?: boolean) => {
    if (isRecurring) {
      return <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><CalendarIcon className="w-5 h-5" /></div>;
    }
    switch (type) {
      case "reimbursement": return <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><ClipboardDocumentCheckIcon className="w-5 h-5" /></div>;
      case "salary": return <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><UserGroupIcon className="w-5 h-5" /></div>;
      case "equipment": return <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><ShoppingBagIcon className="w-5 h-5" /></div>;
      default: return <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><BanknotesIcon className="w-5 h-5" /></div>;
    }
  };

  const mappedReimbursements = reimbursements.map(r => ({
    id: r.id,
    type: "reimbursement",
    title: `${r.description} (${r.user_name || "Employee"})`,
    amount: r.amount,
    date: r.date,
    status: r.status,
    pay_with_payroll: r.pay_with_payroll,
    is_recurring: false,
    approved_by: "System Admin",
    original: r 
  }));

  const mappedPayroll = payrollRuns.map(run => ({
    id: run.id,
    type: "salary",
    title: `Payroll Period ${run.period}`,
    amount: run.total_amount,
    date: run.processed_at || run.created_at,
    status: run.status,
    pay_with_payroll: false,
    is_recurring: false,
    approved_by: run.processed_at ? "HR System" : "System Admin",
    original: run
  }));

  const mappedExpenses = expenses.map(e => ({
    id: e.id,
    type: e.category === "equipment" ? "equipment" : "expense", 
    title: e.title,
    amount: e.amount,
    date: e.date.split("T")[0], 
    status: e.status,
    pay_with_payroll: false,
    approved_by: e.is_recurring ? "System (Template)" : "Finance Manager", 
    description: e.description,
    category: e.category,
    is_recurring: !!e.is_recurring,
    recurring_day: e.recurring_day,
    recurring_end_at: e.recurring_end_at,
    parent_expense_id: e.parent_expense_id,
    original: e
  }));

  const allExpenses = [...mappedReimbursements, ...mappedPayroll, ...mappedExpenses];

  const currentMonthPrefix = format(new Date(), "yyyy-MM");
  const monthlyBurn = allExpenses
    .filter(e => e.date.startsWith(currentMonthPrefix))
    .reduce((sum, e) => sum + e.amount, 0);

  const pendingPayroll = payrollRuns
    .filter(r => r.status !== 'paid')
    .reduce((sum, r) => sum + r.total_amount, 0);

  const filteredExpenses = allExpenses.sort((a, b) => isAfter(new Date(b.date), new Date(a.date)) ? 1 : -1)
    .filter(e => filter === "all" || e.type === filter);

  const openDetails = (expense: any) => {
    setSelectedExpense(expense);
    setShowDetails(true);
  };

  return (
    <PageLayout
      title="Expense Management"
      breadcrumbs={[
        { label: "Finance", href: "/finance/dashboard" },
        { label: "Expenses" }
      ]}
    >
      <div className="space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-none shadow-sm bg-linear-to-br from-indigo-500 to-indigo-600 text-white">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">Monthly Burn Rate</p>
                  <h3 className="text-3xl font-bold mt-1">{formatCurrency(monthlyBurn)}</h3>
                </div>
                <ArrowUpRightIcon className="w-8 h-8 text-white/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Pending Payments</p>
                  <h3 className="text-3xl font-bold mt-1 text-slate-900">
                    {formatCurrency(reimbursements.filter(r => r.status === "approved" && !r.pay_with_payroll).reduce((sum, r) => sum + r.amount, 0))}
                  </h3>
                  <p className="text-xs text-amber-600 mt-1 font-medium">
                    {reimbursements.filter(r => r.status === "approved" && !r.pay_with_payroll).length} Pending now / {reimbursements.filter(r => r.status === "approved" && r.pay_with_payroll).length} Linked to Payroll
                  </p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl text-amber-500"><ClipboardDocumentCheckIcon className="w-6 h-6" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Upcoming Payroll</p>
                  <h3 className="text-3xl font-bold mt-1 text-slate-900">{formatCurrency(pendingPayroll)}</h3>
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    {payrollRuns.filter(r => r.status !== 'paid').length} Period(s) pending
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl text-blue-500"><UserGroupIcon className="w-6 h-6" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-300">
          <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs">
            {["all", "reimbursement", "salary", "equipment", "expense"].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-200 ${
                  filter === t 
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t === "expense" ? "operasional" : t}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
             <div className={`transition-all duration-300 transform ${filter === 'equipment' ? 'opacity-100 scale-100' : 'hidden opacity-0 scale-95 pointer-events-none'}`}>
                <Button 
                  onClick={() => setShowNewEquip(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 h-11 rounded-xl shadow-xl shadow-indigo-100 border-0 flex items-center gap-2 group active:scale-95 transition-all"
                >
                   <div className="bg-white/20 p-1 rounded-lg group-hover:rotate-90 transition-transform duration-300">
                     <PlusIcon className="w-4 h-4" />
                   </div>
                   <span>New Equipment</span>
                </Button>
             </div>

             <div className={`transition-all duration-300 transform ${filter === 'all' || filter === 'expense' ? 'opacity-100 scale-100' : 'hidden opacity-0 scale-95 pointer-events-none'}`}>
                <Button 
                  onClick={() => setShowNewExpense(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 h-11 rounded-xl shadow-xl shadow-emerald-100 border-0 flex items-center gap-2 group active:scale-95 transition-all"
                >
                   <div className="bg-white/20 p-1 rounded-lg group-hover:rotate-90 transition-transform duration-300">
                     <PlusIcon className="w-4 h-4" />
                   </div>
                   <span>Pengeluaran Lainnya</span>
                </Button>
             </div>
          </div>
        </div>

        {/* Expense List */}
        <Card className="border-slate-200 overflow-hidden min-h-[400px]">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">Expense Details</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Approved By</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-200">
                             <ShoppingBagIcon className="w-8 h-8" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-black text-slate-900 uppercase tracking-widest text-xs">No Records Found</p>
                            <p className="text-slate-400 text-xs font-medium">There are no {filter === 'all' ? 'expenses' : filter} recorded in this period.</p>
                          </div>
                          {filter === 'equipment' && (
                             <Button 
                               variant="outline" 
                               className="mt-4 rounded-xl font-bold border-slate-200"
                               onClick={() => setShowNewEquip(true)}
                             >
                               Get Started with Procurement
                             </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => openDetails(expense)}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            {getTypeIcon(expense.type, expense.is_recurring)}
                            <div>
                              <p className="font-bold text-slate-900">{expense.title}</p>
                              <p className="text-xs text-slate-500 capitalize">{expense.type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">{formatDateLabel(expense.date)}</td>
                        <td className="px-6 py-4 text-slate-600">{expense.approved_by}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">{formatCurrency(expense.amount)}</td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">{getStatusBadge(expense.status, expense.pay_with_payroll, expense.is_recurring)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(expense.type === "reimbursement" || expense.type === "equipment" || expense.type === "expense") && expense.status === "approved" && !expense.pay_with_payroll && !expense.is_recurring && (
                              <Button 
                                size="sm" 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-3"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openConfirmPayload(expense.id, expense.type, expense.title, expense.amount);
                                }}
                                disabled={processingId === expense.id}
                              >
                                {processingId === expense.id ? "..." : "Pay"}
                              </Button>
                            )}
                            <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <EyeIcon className="w-5 h-5 text-indigo-500" />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Expense Details"
        size="lg"
      >
        {selectedExpense && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              {getTypeIcon(selectedExpense.type, selectedExpense.is_recurring)}
              <div>
                <h4 className="text-xl font-black text-slate-900">{selectedExpense.title}</h4>
                <p className="text-sm text-slate-500 uppercase tracking-widest font-bold">{selectedExpense.type}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 leading-none">
                  <CalendarIcon className="w-3 h-3" /> Date
                </label>
                <p className="text-slate-900 font-bold">{formatDateLabel(selectedExpense.date)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 leading-none">
                  <TagIcon className="w-3 h-3" /> Category
                </label>
                <p className="text-slate-900 font-bold capitalize">{selectedExpense.original?.category || selectedExpense.type}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 leading-none">
                  <UserIcon className="w-3 h-3" /> Requested By
                </label>
                <p className="text-slate-900 font-bold">{selectedExpense.original?.user_name || (selectedExpense.is_recurring ? "System (Template)" : "System")}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 leading-none">
                   Amount
                </label>
                <p className="text-2xl font-black text-indigo-600">{formatCurrency(selectedExpense.amount)}</p>
              </div>
            </div>

            {selectedExpense.is_recurring && (
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-purple-600/60 uppercase leading-none">🔁 Recurring Schedule</label>
                  <p className="text-purple-900 font-bold">
                    Generates monthly on day {selectedExpense.recurring_day}
                  </p>
                </div>
                {selectedExpense.recurring_end_at && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-purple-600/60 uppercase leading-none">Ends On</label>
                    <p className="text-purple-900 font-bold">{formatDateLabel(selectedExpense.recurring_end_at)}</p>
                  </div>
                )}
              </div>
            )}

            {selectedExpense.parent_expense_id && (
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100/50 text-indigo-950 text-xs flex items-center gap-2">
                <span>🔁 Generated automatically from monthly recurring template.</span>
              </div>
            )}

            {selectedExpense.status === "paid" && (selectedExpense.original?.payment_method_id || selectedExpense.original?.payment_method || selectedExpense.original?.payment_reference) && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-600/60 uppercase leading-none">Paid Via Account</label>
                  <p className="text-emerald-900 font-bold">
                    {paymentMethods.find(m => m.id === selectedExpense.original?.payment_method_id)?.name || selectedExpense.original?.payment_method || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-600/60 uppercase leading-none">Reference / Note</label>
                  <p className="text-emerald-900 font-bold">{selectedExpense.original?.payment_reference || "-"}</p>
                </div>
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 leading-none">
                <DocumentTextIcon className="w-3 h-3" /> Description
              </label>
              <p className="text-slate-600 text-sm italic">"{selectedExpense.original?.description || selectedExpense.title}"</p>
            </div>

            {selectedExpense.type === "salary" && selectedExpense.original?.payslips && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 leading-none">
                     Employee Payroll List
                  </label>
                  {selectedExpense.status !== "paid" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-6 text-[9px] font-black uppercase text-emerald-600 border-emerald-200 hover:bg-emerald-50 gap-1"
                      onClick={() => openConfirmPayload(selectedExpense.id, "payroll_run", `Payroll Period ${selectedExpense.original.period}`, selectedExpense.amount)}
                      disabled={processingId === selectedExpense.id}
                    >
                      {processingId === selectedExpense.id ? "Processing..." : (
                        <>
                          <CheckBadgeIcon className="w-3 h-3" />
                          Pay Entire Run
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
                  {selectedExpense.original.payslips.map((ps: any) => (
                    <div key={ps.id} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                          {ps.user_name?.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{ps.user_name}</span>
                          <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider flex items-center gap-2">
                            Net Salary 
                            {ps.status === "paid" && <span className="text-emerald-500 font-bold lowercase italic text-[8px] border border-emerald-200 bg-emerald-50 px-1 rounded-sm">Paid</span>}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-slate-900">{formatCurrency(ps.net_salary)}</span>
                        {ps.status !== "paid" && (
                          <Button 
                            size="sm" 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              openConfirmPayload(ps.id, "payslip", `Pay for ${ps.user_name}`, ps.net_salary);
                            }}
                            disabled={processingId === ps.id}
                          >
                            {processingId === ps.id ? "..." : "Pay"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {selectedExpense.original.payslips.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400 italic">No payslips generated for this period yet.</div>
                  )}
                </div>
              </div>
            )}

            {selectedExpense.type === "reimbursement" && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  selectedExpense.status === "approved" 
                    ? "bg-indigo-50 border-indigo-200" 
                    : "bg-slate-50 border-slate-200"
                }`}>
                  <div>
                    <h5 className={`text-sm font-bold ${selectedExpense.status === "approved" ? "text-indigo-900" : "text-slate-400"}`}>
                      Consolidate with Payroll
                    </h5>
                    <p className={`text-xs ${selectedExpense.status === "approved" ? "text-indigo-700/70" : "text-slate-400"}`}>
                      Pay this reimbursement together with next salary
                    </p>
                  </div>
                  <Switch
                    checked={selectedExpense.pay_with_payroll}
                    onCheckedChange={(checked) => handleTogglePayroll(selectedExpense.id, checked)}
                    disabled={selectedExpense.status !== "approved" || !!selectedExpense.original?.paid_with_payroll_id || processingId === selectedExpense.id}
                    className="data-[state=unchecked]:bg-slate-300 data-[state=checked]:bg-indigo-600 shadow-sm"
                  />
                </div>

                {selectedExpense.status === "approved" && !selectedExpense.pay_with_payroll && (
                  <Button 
                    variant="default" 
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-black flex items-center justify-center gap-2"
                    onClick={() => openConfirmPayload(selectedExpense.id, "reimbursement", selectedExpense.title, selectedExpense.amount)}
                    disabled={processingId === selectedExpense.id}
                  >
                    {processingId === selectedExpense.id ? "Processing..." : (
                      <>
                        <CheckBadgeIcon className="w-5 h-5" />
                        Mark as Paid Now
                      </>
                    )}
                  </Button>
                )}
                
                {selectedExpense.pay_with_payroll && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 flex items-center gap-3">
                    <div className="p-1.5 bg-purple-100 rounded text-purple-600">
                      <BanknotesIcon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-purple-700">This request will be included in the next automated payroll processing.</span>
                  </div>
                )}
              </div>
            )}

            {selectedExpense.type === "equipment" && selectedExpense.status === "approved" && (
              <div className="pt-2 border-t border-slate-100">
                <Button 
                  variant="default" 
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                  onClick={() => openConfirmPayload(selectedExpense.id, "equipment", selectedExpense.title, selectedExpense.amount)}
                  disabled={processingId === selectedExpense.id}
                >
                  {processingId === selectedExpense.id ? "Processing..." : (
                    <>
                      <CheckBadgeIcon className="w-5 h-5" />
                      Mark as Paid Now
                    </>
                  )}
                </Button>
              </div>
            )}

            {selectedExpense.type === "expense" && selectedExpense.status === "approved" && !selectedExpense.is_recurring && (
              <div className="pt-2 border-t border-slate-100">
                <Button 
                  variant="default" 
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                  onClick={() => openConfirmPayload(selectedExpense.id, "expense", selectedExpense.title, selectedExpense.amount)}
                  disabled={processingId === selectedExpense.id}
                >
                  {processingId === selectedExpense.id ? "Processing..." : (
                    <>
                      <CheckBadgeIcon className="w-5 h-5" />
                      Mark as Paid Now
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowDetails(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Payment"
        size="md"
      >
        {confirmData && (
          <div className="space-y-6">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">Paying for</p>
              <h4 className="text-lg font-black text-indigo-900">{confirmData.title}</h4>
              <p className="text-2xl font-black text-indigo-600 mt-2">{formatCurrency(confirmData.amount)}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">Payment Account / Method</label>
                {paymentMethods.length === 0 ? (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
                    Belum ada metode pembayaran yang diatur. Silakan atur di <a href="/finance/billing?tab=settings" className="underline font-bold">Setup Billing</a> terlebih dahulu.
                  </div>
                ) : (
                  <select
                    value={selectedPaymentMethodId}
                    onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.category.toUpperCase()}) {m.provider ? `- ${m.provider}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">Reference Number / Note</label>
                <input
                  type="text"
                  placeholder="e.g. TRF-123456 or Receipt No."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                className="flex-1 h-12 font-bold" 
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 font-black text-white"
                onClick={() => {
                   if (confirmData.type === 'reimbursement' || confirmData.type === 'equipment' || confirmData.type === 'expense') handleMarkAsPaid(confirmData.id, selectedPaymentMethodId, paymentRef);
                   else if (confirmData.type === 'payslip') handlePayPayslip(confirmData.id, selectedPaymentMethodId, paymentRef);
                   else if (confirmData.type === 'payroll_run') handlePayRun(confirmData.id, selectedPaymentMethodId, paymentRef);
                }}
                disabled={processingId === confirmData.id || !selectedPaymentMethodId}
              >
                {processingId === confirmData.id ? "Processing..." : "Confirm Payment"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Equipment Modal */}
      <Modal
        isOpen={showNewEquip}
        onClose={() => setShowNewEquip(false)}
        title="Procurement / New Equipment"
        size="lg"
      >
        <div className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Item Name / Title</label>
                 <input 
                   type="text" 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                   placeholder="e.g. Printer Epson L3110"
                   value={newEquip.title}
                   onChange={(e) => setNewEquip({...newEquip, title: e.target.value})}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Total Amount (IDR)</label>
                 <input 
                   type="number" 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                   placeholder="0"
                   value={newEquip.amount}
                   onChange={(e) => setNewEquip({...newEquip, amount: Number(e.target.value)})}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Purchase Date</label>
                 <input 
                   type="date" 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                   value={newEquip.date}
                   onChange={(e) => setNewEquip({...newEquip, date: e.target.value})}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Description</label>
                 <input 
                   type="text" 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                   placeholder="Purpose of purchase..."
                   value={newEquip.description}
                   onChange={(e) => setNewEquip({...newEquip, description: e.target.value})}
                 />
              </div>
           </div>

           <div className={`p-4 rounded-2xl border transition-all duration-300 ${newEquip.payNow ? 'bg-white border-indigo-200 shadow-xl shadow-indigo-100/50' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl transition-colors ${newEquip.payNow ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-200 text-slate-500'}`}>
                       <BanknotesIcon className="w-5 h-5" />
                    </div>
                    <div>
                       <p className={`text-sm font-black transition-colors ${newEquip.payNow ? 'text-indigo-900' : 'text-slate-900'}`}>Instant Payment</p>
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Record transaction now</p>
                    </div>
                 </div>
                 <Switch 
                   checked={newEquip.payNow} 
                   onCheckedChange={(v) => setNewEquip({...newEquip, payNow: v})}
                   className="data-[state=unchecked]:bg-slate-300 data-[state=checked]:bg-indigo-600 ring-offset-white focus-visible:ring-indigo-500"
                 />
              </div>

              {newEquip.payNow && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Payment Source</label>
                       <select 
                         className="w-full px-3 py-2 bg-white border border-indigo-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500/20"
                         value={newEquip.paymentMethodId}
                         onChange={(e) => setNewEquip({...newEquip, paymentMethodId: e.target.value})}
                       >
                          <option value="">Select Account...</option>
                          {paymentMethods.map(m => (
                             <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Ref Number</label>
                       <input 
                         type="text" 
                         className="w-full px-3 py-2 bg-white border border-indigo-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20"
                         placeholder="TRF-..."
                         value={newEquip.paymentRef}
                         onChange={(e) => setNewEquip({...newEquip, paymentRef: e.target.value})}
                       />
                    </div>
                 </div>
              )}
           </div>

           <div className="flex gap-3 pt-4 border-t border-slate-50">
              <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setShowNewEquip(false)}>Cancel</Button>
              <Button 
                className="flex-1 h-12 bg-slate-900 hover:bg-black text-white font-black rounded-xl shadow-xl shadow-slate-200"
                onClick={handleCreateEquipment}
                disabled={loading || !newEquip.title || !newEquip.amount}
              >
                 {loading ? "Saving..." : "Create Record"}
              </Button>
           </div>
        </div>
      </Modal>

      {/* New General/Operational/Recurring Expense Modal */}
      <Modal
        isOpen={showNewExpense}
        onClose={() => setShowNewExpense(false)}
        title="Tambah Pengeluaran Lainnya"
        size="lg"
      >
        <div className="space-y-5">
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase">Nama Pengeluaran</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                placeholder="e.g. Pembayaran Bandwidth ISP (Biznet), Langganan SaaS"
                value={newExpense.title}
                onChange={(e) => setNewExpense({...newExpense, title: e.target.value})}
              />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Jumlah (IDR)</label>
                 <input 
                   type="number" 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                   placeholder="0"
                   value={newExpense.amount || ""}
                   onChange={(e) => setNewExpense({...newExpense, amount: Number(e.target.value)})}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Kategori</label>
                 <select 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 bg-white"
                   value={newExpense.category}
                   onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                 >
                    <option value="bandwidth">Bandwidth</option>
                    <option value="layanan">Layanan Software/SaaS</option>
                    <option value="sewa">Sewa Kantor/Infrastruktur</option>
                    <option value="utilitas">Utilitas (Listrik/Air/Internet)</option>
                    <option value="others">Lainnya</option>
                 </select>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Tanggal Pengeluaran / Tanggal Mulai</label>
                 <input 
                   type="date" 
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                   value={newExpense.date}
                   onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                 />
              </div>
              <div className="flex items-center pt-6">
                 <label className="flex items-center gap-3 cursor-pointer">
                    <Switch 
                      checked={newExpense.isRecurring}
                      onCheckedChange={(checked) => setNewExpense({
                        ...newExpense, 
                        isRecurring: checked,
                        payNow: checked ? false : newExpense.payNow // cannot pay templates instantly
                      })}
                      className="data-[state=unchecked]:bg-slate-300 data-[state=checked]:bg-indigo-600"
                    />
                    <span className="text-sm font-bold text-slate-700">Berulang setiap bulan (Recurring)</span>
                 </label>
              </div>
           </div>

           {newExpense.isRecurring && (
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-purple-900 uppercase">Hari Tagihan Dibuat (Hari Ke-)</label>
                    <select
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500/20"
                      value={newExpense.recurringDay}
                      onChange={(e) => setNewExpense({...newExpense, recurringDay: Number(e.target.value)})}
                    >
                       {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>Tanggal {d} setiap bulan</option>
                       ))}
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-purple-900 uppercase">Tanggal Berakhir (Opsional)</label>
                    <input 
                      type="date"
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20"
                      value={newExpense.recurringEndAt}
                      onChange={(e) => setNewExpense({...newExpense, recurringEndAt: e.target.value})}
                    />
                 </div>
              </div>
           )}

           {!newExpense.isRecurring && (
              <div className={`p-4 rounded-2xl border transition-all duration-300 ${newExpense.payNow ? 'bg-white border-emerald-200 shadow-xl shadow-emerald-100/50' : 'bg-slate-50 border-slate-200'}`}>
                 <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                       <div className={`p-2.5 rounded-xl transition-colors ${newExpense.payNow ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-slate-200 text-slate-500'}`}>
                          <BanknotesIcon className="w-5 h-5" />
                       </div>
                       <div>
                          <p className={`text-sm font-black transition-colors ${newExpense.payNow ? 'text-emerald-900' : 'text-slate-900'}`}>Instant Payment</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Record payment now</p>
                       </div>
                    </div>
                    <Switch 
                      checked={newExpense.payNow} 
                      onCheckedChange={(v) => setNewExpense({...newExpense, payNow: v})}
                      className="data-[state=unchecked]:bg-slate-300 data-[state=checked]:bg-emerald-600"
                    />
                 </div>

                 {newExpense.payNow && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Payment Source</label>
                          <select 
                            className="w-full px-3 py-2 bg-white border border-emerald-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500/20"
                            value={newExpense.paymentMethodId}
                            onChange={(e) => setNewExpense({...newExpense, paymentMethodId: e.target.value})}
                          >
                             <option value="">Select Account...</option>
                             {paymentMethods.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                             ))}
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Ref Number</label>
                          <input 
                            type="text" 
                            className="w-full px-3 py-2 bg-white border border-emerald-100 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="TRF-..."
                            value={newExpense.paymentRef}
                            onChange={(e) => setNewExpense({...newExpense, paymentRef: e.target.value})}
                          />
                       </div>
                    </div>
                 )}
              </div>
           )}

           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase">Deskripsi / Catatan Tambahan</label>
              <textarea 
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Keterangan tambahan mengenai pengeluaran..."
                value={newExpense.description}
                onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
              />
           </div>

           <div className="flex gap-3 pt-4 border-t border-slate-100">
              <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setShowNewExpense(false)}>Cancel</Button>
              <Button 
                className="flex-1 h-12 bg-slate-900 hover:bg-black text-white font-black rounded-xl shadow-xl shadow-slate-200"
                onClick={handleCreateExpense}
                disabled={loading || !newExpense.title || !newExpense.amount}
              >
                 {loading ? "Saving..." : "Simpan Pengeluaran"}
              </Button>
           </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
