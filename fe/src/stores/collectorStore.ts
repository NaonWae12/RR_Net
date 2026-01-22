import { create } from "zustand";
import { Invoice, CollectorAssignment, CollectorWorkflowStatus, Payment, RecordPaymentRequest } from "@/lib/api/types";
import { useBillingStore } from "./billingStore";
import { billingService } from "@/lib/api/billingService";
import { toApiError } from "@/lib/utils/errors";

interface CollectorState {
  // Assignments (FE-only state)
  assignments: CollectorAssignment[];
  
  // Client collection state (FE-only)
  paidFullClients: Set<string>; // Client IDs that paid in full
  notHomeClients: Set<string>; // Client IDs that are not home
  partialPayments: Map<string, number>; // Client ID -> partial amount
  
  // Daily collection summary
  todayCollection: number; // Total collected today
  todayDeposits: Array<{
    id: string;
    amount: number;
    client_count: number;
    deposited_at: string;
  }>;
  
  // UI State
  loading: boolean;
  error: string | null;
  
  // Filters
  statusFilter?: CollectorWorkflowStatus;
  clientNameFilter?: string;
  selectedDate: Date; // Date filter for viewing different months
  
  // Payments data
  payments: Payment[]; // Payments for selected date
  depositHistory: Array<{
    date: string;
    amount: number;
    client_count: number;
    payments: Payment[];
  }>;
  
  // Selected assignment for detail view
  selectedAssignment: CollectorAssignment | null;
  
  // Modal state
  partialPaymentModal: {
    open: boolean;
    clientId: string | null;
  };
  depositModal: {
    open: boolean;
  };
}

interface CollectorActions {
  // Fetch assignments (from invoices with status pending/overdue)
  fetchAssignments: () => Promise<void>;
  
  // Workflow actions
  markVisitSuccess: (invoiceId: string, notes?: string, photoFile?: File) => Promise<void>;
  markVisitFailed: (invoiceId: string, notes?: string) => Promise<void>;
  submitDepositReport: (invoiceId: string, proofFile: File) => Promise<void>;
  
  // Client collection actions
  markClientPaidFull: (clientId: string) => Promise<void>;
  markClientNotHome: (clientId: string) => Promise<void>;
  addPartialPayment: (clientId: string, invoiceId: string, amount: number, collectorId: string, paymentDate?: string) => Promise<Payment>;
  removePartialPayment: (clientId: string) => Promise<void>;
  isClientPaidFull: (clientId: string) => boolean;
  isClientNotHome: (clientId: string) => boolean;
  getClientPartialAmount: (clientId: string) => number;
  getClientPayments: (clientId: string) => Payment[];
  
  // Deposit actions
  submitDeposit: (amount: number, clientIds: string[], paymentIds: string[]) => Promise<void>;
  fetchTodayCollection: () => Promise<void>;
  fetchDepositHistory: (startDate?: string, endDate?: string) => Promise<void>;
  fetchPaymentsForDate: (date: Date) => Promise<void>;
  
  // Modal actions
  openPartialPaymentModal: (clientId: string) => void;
  closePartialPaymentModal: () => void;
  openDepositModal: () => void;
  closeDepositModal: () => void;
  
  // Filters
  setStatusFilter: (status?: CollectorWorkflowStatus) => void;
  setClientNameFilter: (name?: string) => void;
  setSelectedDate: (date: Date) => void;
  
  // Selection
  setSelectedAssignment: (assignment: CollectorAssignment | null) => void;
  
  // Clear
  clearError: () => void;
}

/**
 * Collector Store - FE-only state management
 * Manages collector workflow state without backend changes
 */
export const useCollectorStore = create<CollectorState & CollectorActions>((set, get) => ({
  assignments: [],
  paidFullClients: new Set<string>(),
  notHomeClients: new Set<string>(),
  partialPayments: new Map<string, number>(), // Keep for backward compatibility, but will sync with payments
  todayCollection: 0,
  todayDeposits: [],
  loading: false,
  error: null,
  statusFilter: undefined,
  clientNameFilter: undefined,
  selectedDate: new Date(), // Default to today
  payments: [],
  depositHistory: [],
  selectedAssignment: null,
  partialPaymentModal: {
    open: false,
    clientId: null,
  },
  depositModal: {
    open: false,
  },

  fetchAssignments: async () => {
    set({ loading: true, error: null });
    try {
      // Fetch invoices with status pending or overdue (these are collectible)
      const billingStore = useBillingStore.getState();
      
      // Get existing assignments from local state first (to preserve workflow status)
      const existingAssignments = get().assignments;
      const assignmentsMap = new Map(
        existingAssignments.map((a) => [a.invoice_id, a])
      );
      
      // Fetch pending invoices
      billingStore.setInvoiceFilters({ status: "pending" });
      await billingStore.fetchInvoices();
      const pendingInvoices = billingStore.invoices.filter(
        (inv) => inv.status === "pending"
      );
      
      // Fetch overdue invoices
      await billingStore.fetchOverdueInvoices();
      const overdueInvoices = billingStore.overdueInvoices || [];
      
      // Combine all collectible invoices
      const allCollectibleInvoices = [
        ...pendingInvoices,
        ...overdueInvoices.filter(
          (inv) => !pendingInvoices.find((p) => p.id === inv.id)
        ),
      ];
      
      // Create or update assignments
      const assignments: CollectorAssignment[] = allCollectibleInvoices.map((invoice) => {
        const existing = assignmentsMap.get(invoice.id);
        return {
          invoice_id: invoice.id,
          invoice,
          workflow_status: existing?.workflow_status || "assigned",
          assigned_at: existing?.assigned_at || new Date().toISOString(),
          visit_notes: existing?.visit_notes,
          visit_photo_url: existing?.visit_photo_url,
          deposit_proof_url: existing?.deposit_proof_url,
          deposit_submitted_at: existing?.deposit_submitted_at,
          confirmed_at: existing?.confirmed_at,
        };
      });
      
      // Also include assignments that might be in other states (visit_success, deposited, confirmed)
      // but invoice might have changed status (for history tracking)
      existingAssignments.forEach((assignment) => {
        if (!assignments.find((a) => a.invoice_id === assignment.invoice_id)) {
          // Update invoice data if available, but keep workflow status
          const updatedInvoice = allCollectibleInvoices.find(
            (inv) => inv.id === assignment.invoice_id
          );
          if (updatedInvoice) {
            assignments.push({
              ...assignment,
              invoice: updatedInvoice,
            });
          } else {
            // Keep assignment for history even if invoice is no longer collectible
            assignments.push(assignment);
          }
        }
      });
      
      set({ assignments, loading: false });
    } catch (err) {
      set({
        error: toApiError(err).message,
        loading: false,
        assignments: get().assignments, // Keep existing assignments on error
      });
    }
  },

  markVisitSuccess: async (invoiceId: string, notes?: string, photoFile?: File) => {
    set({ loading: true, error: null });
    try {
      const assignments = get().assignments;
      const assignment = assignments.find((a) => a.invoice_id === invoiceId);
      
      if (!assignment) {
        throw new Error("Assignment not found");
      }
      
      // Update assignment state (FE-only)
      const updatedAssignment: CollectorAssignment = {
        ...assignment,
        workflow_status: "visit_success",
        visit_notes: notes || assignment.visit_notes,
        visit_photo_url: photoFile
          ? URL.createObjectURL(photoFile) // Create local URL for preview
          : assignment.visit_photo_url,
        _local_state: {
          visit_notes: notes,
          visit_photo_file: photoFile,
        },
      };
      
      const updatedAssignments = assignments.map((a) =>
        a.invoice_id === invoiceId ? updatedAssignment : a
      );
      
      set({
        assignments: updatedAssignments,
        loading: false,
        selectedAssignment: updatedAssignment,
      });
      
      // Note: In real implementation, this would call backend API
      // For now, we only update FE state
    } catch (err) {
      set({
        error: toApiError(err).message,
        loading: false,
      });
      throw err;
    }
  },

  markVisitFailed: async (invoiceId: string, notes?: string) => {
    set({ loading: true, error: null });
    try {
      const assignments = get().assignments;
      const assignment = assignments.find((a) => a.invoice_id === invoiceId);
      
      if (!assignment) {
        throw new Error("Assignment not found");
      }
      
      // Update assignment state (FE-only)
      const updatedAssignment: CollectorAssignment = {
        ...assignment,
        workflow_status: "visit_failed",
        visit_notes: notes || assignment.visit_notes,
      };
      
      const updatedAssignments = assignments.map((a) =>
        a.invoice_id === invoiceId ? updatedAssignment : a
      );
      
      set({
        assignments: updatedAssignments,
        loading: false,
        selectedAssignment: updatedAssignment,
      });
    } catch (err) {
      set({
        error: toApiError(err).message,
        loading: false,
      });
      throw err;
    }
  },

  submitDepositReport: async (invoiceId: string, proofFile: File) => {
    set({ loading: true, error: null });
    try {
      const assignments = get().assignments;
      const assignment = assignments.find((a) => a.invoice_id === invoiceId);
      
      if (!assignment) {
        throw new Error("Assignment not found");
      }
      
      if (assignment.workflow_status !== "visit_success") {
        throw new Error("Can only submit deposit report after successful visit");
      }
      
      // Update assignment state (FE-only)
      const updatedAssignment: CollectorAssignment = {
        ...assignment,
        workflow_status: "deposited",
        deposit_proof_url: URL.createObjectURL(proofFile), // Create local URL for preview
        deposit_submitted_at: new Date().toISOString(),
        _local_state: {
          ...assignment._local_state,
          deposit_proof_file: proofFile,
        },
      };
      
      const updatedAssignments = assignments.map((a) =>
        a.invoice_id === invoiceId ? updatedAssignment : a
      );
      
      set({
        assignments: updatedAssignments,
        loading: false,
        selectedAssignment: updatedAssignment,
      });
      
      // Note: In real implementation, this would:
      // 1. Upload proof file to backend
      // 2. Call API to submit deposit report
      // For now, we only update FE state
    } catch (err) {
      set({
        error: toApiError(err).message,
        loading: false,
      });
      throw err;
    }
  },

  setStatusFilter: (status?: CollectorWorkflowStatus) => {
    set({ statusFilter: status });
  },

  setClientNameFilter: (name?: string) => {
    set({ clientNameFilter: name });
  },

  setSelectedDate: (date: Date) => {
    set({ selectedDate: date });
  },

  setSelectedAssignment: (assignment: CollectorAssignment | null) => {
    set({ selectedAssignment: assignment });
  },

  clearError: () => {
    set({ error: null });
  },

  // Client collection actions
  markClientPaidFull: async (clientId: string) => {
    set((state) => {
      const newPaidFull = new Set(state.paidFullClients);
      const isCurrentlyPaid = newPaidFull.has(clientId);
      
      // Toggle: if already paid, remove it; otherwise add it
      if (isCurrentlyPaid) {
        newPaidFull.delete(clientId);
      } else {
        newPaidFull.add(clientId);
        // Remove from not home if was there
        const newNotHome = new Set(state.notHomeClients);
        newNotHome.delete(clientId);
        // Remove partial payment if exists
        const newPartialPayments = new Map(state.partialPayments);
        newPartialPayments.delete(clientId);
        return {
          paidFullClients: newPaidFull,
          notHomeClients: newNotHome,
          partialPayments: newPartialPayments,
        };
      }
      
      return {
        paidFullClients: newPaidFull,
      };
    });
  },

  markClientNotHome: async (clientId: string) => {
    set((state) => {
      const newNotHome = new Set(state.notHomeClients);
      const isCurrentlyNotHome = newNotHome.has(clientId);
      
      // Toggle: if already not home, remove it; otherwise add it
      if (isCurrentlyNotHome) {
        newNotHome.delete(clientId);
      } else {
        newNotHome.add(clientId);
        // Remove from paid full if was there
        const newPaidFull = new Set(state.paidFullClients);
        newPaidFull.delete(clientId);
        // Remove partial payment if exists
        const newPartialPayments = new Map(state.partialPayments);
        newPartialPayments.delete(clientId);
        return {
          notHomeClients: newNotHome,
          paidFullClients: newPaidFull,
          partialPayments: newPartialPayments,
        };
      }
      
      return {
        notHomeClients: newNotHome,
      };
    });
  },

  removePartialPayment: async (clientId: string) => {
    // Remove from local state
    set((state) => {
      const newPartialPayments = new Map(state.partialPayments);
      newPartialPayments.delete(clientId);
      return {
        partialPayments: newPartialPayments,
      };
    });
    
    // Note: In real implementation, we might need to delete payment record from backend
    // For now, we only remove from local state
  },

  addPartialPayment: async (clientId: string, invoiceId: string, amount: number, collectorId: string, paymentDate?: string): Promise<Payment> => {
    set({ loading: true, error: null });
    try {
      // Create payment record via API
      const paymentData: RecordPaymentRequest = {
        invoice_id: invoiceId,
        amount,
        method: 'collector',
        collector_id: collectorId,
        received_at: paymentDate || new Date().toISOString(),
        notes: `Partial payment collected by collector`,
      };
      
      const payment = await billingService.recordPayment(paymentData);
      
      // Update local state
      set((state) => {
        const newPartialPayments = new Map(state.partialPayments);
        newPartialPayments.set(clientId, amount);
        return {
          partialPayments: newPartialPayments,
          payments: [payment, ...state.payments],
          loading: false,
        };
      });
      
      return payment;
    } catch (err) {
      set({
        error: toApiError(err).message,
        loading: false,
      });
      throw err;
    }
  },

  getClientPayments: (clientId: string) => {
    return get().payments.filter((p) => p.client_id === clientId);
  },

  isClientPaidFull: (clientId: string) => {
    return get().paidFullClients.has(clientId);
  },

  isClientNotHome: (clientId: string) => {
    return get().notHomeClients.has(clientId);
  },

  getClientPartialAmount: (clientId: string) => {
    return get().partialPayments.get(clientId) || 0;
  },

  // Deposit actions
  submitDeposit: async (amount: number, clientIds: string[], paymentIds: string[]) => {
    set({ loading: true, error: null });
    try {
      // Update payments status to 'deposited' (if backend supports it)
      // For now, we'll just mark them in local state
      const depositId = `deposit_${Date.now()}`;
      const newDeposit = {
        id: depositId,
        amount,
        client_count: clientIds.length,
        deposited_at: new Date().toISOString(),
      };

      set((state) => ({
        todayCollection: state.todayCollection + amount,
        todayDeposits: [newDeposit, ...state.todayDeposits],
        loading: false,
      }));

      // Note: In real implementation, this would:
      // 1. Update payment records with deposit_id
      // 2. Call backend API to create deposit record
      // 3. Update payment status to 'deposited'
    } catch (err) {
      set({
        error: toApiError(err).message,
        loading: false,
      });
      throw err;
    }
  },

  fetchTodayCollection: async () => {
    // Calculate from today's payments
    const today = new Date().toISOString().split('T')[0];
    const todayPayments = get().payments.filter((p) => 
      p.received_at.startsWith(today) && p.method === 'collector'
    );
    const total = todayPayments.reduce((sum, p) => sum + p.amount, 0);
    set({ todayCollection: total });
  },

  fetchPaymentsForDate: async (date: Date) => {
    set({ loading: true, error: null });
    try {
      // Fetch payments for the selected date
      // Note: Backend might need to support date filtering
      // For now, we'll fetch all payments and filter client-side
      const startDate = new Date(date);
      startDate.setDate(1); // First day of month
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0); // Last day of month
      endDate.setHours(23, 59, 59, 999);
      
      // Fetch payments with method='collector' for the month
      // Note: This assumes backend supports date range filtering
      // If not, we'll need to fetch all and filter client-side
      const response = await billingService.getPayments(1, 1000, undefined, 'collector');
      
      // Filter payments by date range
      const filteredPayments = response.data.filter((p) => {
        const paymentDate = new Date(p.received_at);
        return paymentDate >= startDate && paymentDate <= endDate;
      });
      
      set({
        payments: filteredPayments,
        loading: false,
      });
    } catch (err) {
      set({
        error: toApiError(err).message,
        loading: false,
        payments: [],
      });
    }
  },

  fetchDepositHistory: async (startDate?: string, endDate?: string) => {
    set({ loading: true, error: null });
    try {
      // Fetch payments grouped by date
      const response = await billingService.getPayments(1, 1000, undefined, 'collector');
      
      // Group payments by date
      const paymentsByDate = new Map<string, Payment[]>();
      response.data.forEach((payment) => {
        const paymentDate = new Date(payment.received_at).toISOString().split('T')[0];
        if (!paymentsByDate.has(paymentDate)) {
          paymentsByDate.set(paymentDate, []);
        }
        paymentsByDate.get(paymentDate)!.push(payment);
      });
      
      // Convert to deposit history format
      const depositHistory = Array.from(paymentsByDate.entries())
        .map(([date, payments]) => ({
          date,
          amount: payments.reduce((sum, p) => sum + p.amount, 0),
          client_count: new Set(payments.map((p) => p.client_id)).size,
          payments,
        }))
        .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
      
      set({
        depositHistory,
        loading: false,
      });
    } catch (err) {
      set({
        error: toApiError(err).message,
        loading: false,
        depositHistory: [],
      });
    }
  },

  // Modal actions
  openPartialPaymentModal: (clientId: string) => {
    set({
      partialPaymentModal: {
        open: true,
        clientId,
      },
    });
  },

  closePartialPaymentModal: () => {
    set({
      partialPaymentModal: {
        open: false,
        clientId: null,
      },
    });
  },

  openDepositModal: () => {
    set({
      depositModal: {
        open: true,
      },
    });
  },

  closeDepositModal: () => {
    set({
      depositModal: {
        open: false,
      },
    });
  },
}));

