import { create } from "zustand";
import { 
  Invoice, 
  CollectorAssignment, 
  CollectorWorkflowStatus, 
  Payment, 
  RecordPaymentRequest, 
  Settlement 
} from "@/lib/api/types";
import { billingService } from "@/lib/api/billingService";
import { toApiError } from "@/lib/utils/errors";

interface CollectorState {
  assignments: CollectorAssignment[];
  payments: Payment[];
  paidFullClients: Set<string>;
  notHomeClients: Set<string>;
  partialPayments: Map<string, number>; // Current collector's partials
  allPartialPayments: Map<string, number>; // All collectors' partials today
  globallyPaidFullClients: Set<string>; // All collectors' full payments today
  markedClients: Map<string, any>;
  lockedAssignments: Set<string>;
  settledAssignments: Set<string>;
  depositHistory: Settlement[];
  loading: boolean;
  error: string | null;
  selectedDate: Date;
  selectedAssignment: CollectorAssignment | null;
  todayCollection: number;
  todayDeposits: any[];
  isRecording: boolean;
  
  partialPaymentModal: {
    open: boolean;
    client: any | null;
  };
  depositModal: {
    open: boolean;
  };
}

interface CollectorActions {
  fetchAssignments: (date: Date, collectorId?: string) => Promise<void>;
  markVisitSuccess: (invoiceId: string, notes?: string, photoFile?: File) => Promise<void>;
  markVisitFailed: (invoiceId: string, notes?: string) => Promise<void>;
  submitDepositReport: (invoiceId: string, proofFile: File) => Promise<void>;
  markClientPaidFull: (client: any, collectorId: string) => Promise<void>;
  markClientNotHome: (client: any) => Promise<void>;
  addPartialPayment: (client: any, invoiceId: string, amount: number, collectorId: string, paymentDate?: string) => Promise<Payment>;
  removePartialPayment: (clientId: string, collectorId?: string) => Promise<void>;
  submitDeposit: (amount: number, clientIds: string[], paymentIds: string[], collectorId?: string) => Promise<void>;
  fetchTodayCollection: () => Promise<void>;
  fetchDepositHistory: (collectorId: string, startDate?: Date, endDate?: Date) => Promise<void>;
  fetchPaymentsForDate: (date: Date) => Promise<void>;
  getClientPayments: (clientId: string) => Payment[];
  isClientPaidFull: (clientId: string) => boolean;
  isClientNotHome: (clientId: string) => boolean;
  getClientPartialAmount: (clientId: string) => number;
  isAssignmentLocked: (invoiceId: string) => boolean;
  openPartialPaymentModal: (client: any) => void;
  closePartialPaymentModal: () => void;
  openDepositModal: () => void;
  closeDepositModal: () => void;
  setSelectedDate: (date: Date) => void;
  setSelectedAssignment: (assignment: CollectorAssignment | null) => void;
  clearError: () => void;
}

export const useCollectorStore = create<CollectorState & CollectorActions>((set, get) => ({
  assignments: [],
  payments: [],
  paidFullClients: new Set<string>(),
  globallyPaidFullClients: new Set<string>(),
  notHomeClients: new Set<string>(),
  partialPayments: new Map<string, number>(),
  allPartialPayments: new Map<string, number>(),
  markedClients: new Map<string, any>(),
  lockedAssignments: new Set(),
  settledAssignments: new Set(),
  depositHistory: [],
  loading: false,
  error: null,
  selectedDate: new Date(),
  selectedAssignment: null,
  todayCollection: 0,
  todayDeposits: [],
  isRecording: false,
  partialPaymentModal: { open: false, client: null },
  depositModal: { open: false },

  fetchAssignments: async (dateArg?: Date | string, collectorId?: string) => {
    const date = dateArg ? (typeof dateArg === 'string' ? new Date(dateArg) : dateArg) : new Date();
    set({ loading: true, error: null });
    try {
      // Use any for flexible API mapping
      // getInvoices(page, pageSize, clientId, status, ...)
      const res: any = await billingService.getInvoices(1, 1000, undefined, 'pending');
      const overdueRes: any = await billingService.getOverdueInvoices();
      
      const invoices: Invoice[] = [
        ...(Array.isArray(res) ? res : (res.data || [])),
        ...(Array.isArray(overdueRes) ? overdueRes : (overdueRes.data || []))
      ];
      
      const uniqueInvoices = invoices.filter((inv, index, self) =>
        index === self.findIndex((i) => i.id === inv.id)
      );

      const pad = (n: number) => n.toString().padStart(2, '0');
      const startStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const endStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(lastDay)}`;

      const paymentsRes: any = await billingService.getPayments({
        method: 'collector',
        start_date: startStr,
        end_date: endStr,
        page_size: 2000
      });
      const dailyPayments: Payment[] = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes.data || []);

      const newPaidFull = new Set<string>();
      const newGloballyPaidFull = new Set<string>();
      const newPartialPayments = new Map<string, number>();
      const newAllPartialPayments = new Map<string, number>();
      const newMarkedClients = new Map<string, any>();
      const newLockedAssignments = new Set<string>();
      const newSettledAssignments = new Set<string>(); // Verified by current collector

      const mappedAssignments: CollectorAssignment[] = uniqueInvoices.map((invoice): CollectorAssignment => {
        const invoicePayments = dailyPayments.filter(p => p.invoice_id === invoice.id);
        const totalPaidToday = invoicePayments.reduce((sum, p) => sum + p.amount, 0);

        // Lock if anyone else has a payment for this invoice today,
        // OR if I have a payment that is already 'verified' (meaning I already clicked "Setorkan" for it)
        const otherPayments = invoicePayments.filter(p => collectorId && (p as any).collector_id !== collectorId);
        const myVerifiedPayments = invoicePayments.filter(p => collectorId && (p as any).collector_id === collectorId && (p as any).status === 'verified');
        
        if (otherPayments.length > 0) {
          newLockedAssignments.add(invoice.id);
        }
        if (myVerifiedPayments.length > 0) {
          newSettledAssignments.add(invoice.id);
        }

        if (totalPaidToday > 0) {
          // Only count MY payments (from this collector) toward paidFull/partialPayments.
          // Other collectors' payments should only cause locking, not populate our own state.
          const myPaymentsToday = invoicePayments.filter(p => collectorId && (p as any).collector_id === collectorId);
          const myTotalToday = myPaymentsToday.reduce((sum, p) => sum + p.amount, 0);

          if (totalPaidToday > 0) {
            const isFull = invoice.paid_amount >= invoice.total_amount;
            if (isFull) {
                newGloballyPaidFull.add(invoice.client_id);
            } else {
                newAllPartialPayments.set(invoice.client_id, totalPaidToday);
            }
          }

          if (myTotalToday > 0) {
            const isFull = invoice.paid_amount >= invoice.total_amount;
            if (isFull) {
              newPaidFull.add(invoice.client_id);
            } else {
              newPartialPayments.set(invoice.client_id, myTotalToday);
            }
            newMarkedClients.set(invoice.client_id, { 
              id: invoice.client_id, 
              name: invoice.client_name || `Client #${invoice.client_id.substring(0, 5)}`,
              monthly_fee: invoice.total_amount,
              discount_type: 'fixed',
              discount_value: 0
            });
          }
        }

        return {
          invoice_id: invoice.id,
          invoice,
          workflow_status: 'assigned' as CollectorWorkflowStatus,
          _local_state: {}
        };
      });

      // Robustness check: Iterate through dailyPayments to catch clients whose invoices 
      // might have been marked 'paid' and are missing from the pending/overdue results.
      dailyPayments.forEach(p => {
        const pid = ((p as any).collector_id || (p as any).collectorId || '').toString().toLowerCase();
        const targetPid = (collectorId || '').toString().toLowerCase();
        
        if (collectorId && pid === targetPid) {
          const cid = (p.client_id || '').toString().toLowerCase();
          
          if (!newMarkedClients.has(p.client_id) && !get().markedClients.has(p.client_id)) {
            // Client collected today but invoice not in pending list
            const myTotal = dailyPayments
              .filter(dp => dp.client_id === p.client_id && (dp as any).collector_id === collectorId)
              .reduce((s, dp) => s + dp.amount, 0);
            
            if (myTotal > 0) {
              // We assume it's full if the invoice is gone from pending, or at least we want to show it.
              newPaidFull.add(p.client_id);
              newMarkedClients.set(p.client_id, {
                id: p.client_id,
                name: (p as any).client_name || `Client #${p.client_id.substring(0, 5)}`,
                monthly_fee: myTotal,
                discount_type: 'fixed',
                discount_value: 0
              });
            }
          }
        }
      });

      set((state) => {
        const updatedMarkedClients = new Map(state.markedClients);
        newMarkedClients.forEach((val, key) => updatedMarkedClients.set(key, val));
        
        return { 
          assignments: mappedAssignments,
          payments: dailyPayments,
          paidFullClients: newPaidFull,
          partialPayments: newPartialPayments,
          markedClients: updatedMarkedClients,
          lockedAssignments: newLockedAssignments,
          settledAssignments: newSettledAssignments,
          allPartialPayments: newAllPartialPayments,
          globallyPaidFullClients: newGloballyPaidFull,
          loading: false 
        };
      });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
    }
  },

  markVisitSuccess: async (invoiceId: string, notes?: string, photoFile?: File) => {
    set({ loading: true, error: null });
    try {
      const { assignments } = get();
      const assignment = assignments.find((a) => a.invoice_id === invoiceId);
      if (!assignment) throw new Error("Assignment not found");
      const updated: CollectorAssignment = {
        ...assignment,
        workflow_status: "visit_success",
        visit_notes: notes || assignment.visit_notes,
        visit_photo_url: photoFile ? URL.createObjectURL(photoFile) : assignment.visit_photo_url,
        _local_state: { ...assignment._local_state, visit_notes: notes, visit_photo_file: photoFile },
      };
      set({ assignments: assignments.map((a) => a.invoice_id === invoiceId ? updated : a), loading: false, selectedAssignment: updated });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  markVisitFailed: async (invoiceId: string, notes?: string) => {
    set({ loading: true, error: null });
    try {
      const { assignments } = get();
      const assignment = assignments.find((a) => a.invoice_id === invoiceId);
      if (!assignment) throw new Error("Assignment not found");
      const updated: CollectorAssignment = { ...assignment, workflow_status: "visit_failed", visit_notes: notes || assignment.visit_notes };
      set({ assignments: assignments.map((a) => a.invoice_id === invoiceId ? updated : a), loading: false, selectedAssignment: updated });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  submitDepositReport: async (invoiceId: string, proofFile: File) => {
    set({ loading: true, error: null });
    try {
      const { assignments } = get();
      const assignment = assignments.find((a) => a.invoice_id === invoiceId);
      if (!assignment) throw new Error("Assignment not found");
      const updated: CollectorAssignment = {
        ...assignment,
        workflow_status: "deposited",
        deposit_proof_url: URL.createObjectURL(proofFile),
        deposit_submitted_at: new Date().toISOString(),
        _local_state: { ...assignment._local_state, deposit_proof_file: proofFile },
      };
      set({ assignments: assignments.map((a) => a.invoice_id === invoiceId ? updated : a), loading: false, selectedAssignment: updated });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  markClientPaidFull: async (client: any, collectorId: string) => {
    const { paidFullClients, assignments, selectedDate, isRecording } = get();
    if (isRecording) return;
    const clientId = client.id;
    const isCurrentlyPaid = paidFullClients.has(clientId);
    set({ loading: true, error: null, isRecording: true });
    try {
      if (isCurrentlyPaid) {
        // Broadly refresh payments to ensure we have the most recent list
        await get().fetchPaymentsForDate(selectedDate);
        const { payments: latestPayments } = get();

        const toDelete = latestPayments.filter((p) => {
          const pid = ((p as any).collector_id || (p as any).collectorId || '').toString().toLowerCase();
          const targetPid = (collectorId || '').toString().toLowerCase();
          const cid = (p.client_id || '').toString().toLowerCase();
          const targetCid = (clientId || '').toString().toLowerCase();
          
          // Match by client and pending status. Prefer our collector but fall back to client only if ours is missing
          return cid === targetCid && p.status === 'pending' && (!targetPid || pid === targetPid || pid === '');
        });
        
        if (toDelete.length === 0) {
           console.warn(`[markClientPaidFull] No matching pending payments found for client ${clientId}`);
           // If we can't find it, we just update local state to allow re-marking
        }
        
        for (const p of toDelete) await billingService.deletePayment(p.id);
        
        // Optimistically update state
        const newPaidFull = new Set(get().paidFullClients);
        newPaidFull.delete(clientId);
        set({ paidFullClients: newPaidFull });
      } else {
        const clientInvoices = assignments.filter(a => a.invoice.client_id === clientId);
        for (const a of clientInvoices) {
          const remaining = a.invoice.total_amount - (a.invoice.paid_amount || 0);
          if (remaining > 0) {
            await billingService.recordPayment({
              invoice_id: a.invoice.id, amount: remaining, method: 'collector', collector_id: collectorId, notes: 'Full payment marked by collector'
            });
          }
        }
      }
      await get().fetchAssignments(selectedDate, collectorId);
      await get().fetchPaymentsForDate(selectedDate);
      set({ loading: false, isRecording: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false, isRecording: false });
      throw err;
    }
  },

  markClientNotHome: async (client: any) => {
    set((state) => {
      const clientId = client.id;
      const newNotHome = new Set(state.notHomeClients);
      const newMarked = new Map(state.markedClients);
      if (newNotHome.has(clientId)) {
        newNotHome.delete(clientId);
        if (!state.paidFullClients.has(clientId) && !state.partialPayments.has(clientId)) newMarked.delete(clientId);
      } else {
        newNotHome.add(clientId);
        newMarked.set(clientId, client);
        const newPaidFull = new Set(state.paidFullClients);
        newPaidFull.delete(clientId);
        const newPartials = new Map(state.partialPayments);
        newPartials.delete(clientId);
        return { notHomeClients: newNotHome, paidFullClients: newPaidFull, partialPayments: newPartials, markedClients: newMarked };
      }
      return { notHomeClients: newNotHome, markedClients: newMarked };
    });
  },

  addPartialPayment: async (client: any, invoiceId: string, amount: number, collectorId: string, paymentDate?: string) => {
    set({ loading: true, error: null });
    try {
      const payment = await billingService.recordPayment({
        invoice_id: invoiceId, amount, method: 'collector', collector_id: collectorId,
        received_at: paymentDate || new Date().toISOString(), notes: `Partial payment collected`,
      });
      await get().fetchAssignments(get().selectedDate, collectorId);
      await get().fetchPaymentsForDate(get().selectedDate);
      return payment;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  removePartialPayment: async (clientId: string, collectorId?: string) => {
    const { selectedDate } = get();
    set({ loading: true, error: null });
    try {
      // Refresh to get latest list before filtering
      await get().fetchPaymentsForDate(selectedDate);
      const { payments: latestPayments } = get();

      const pendingPayments = latestPayments.filter(p => {
        const cid = (p.client_id || '').toString().toLowerCase();
        const targetCid = (clientId || '').toString().toLowerCase();
        const pid = ((p as any).collector_id || (p as any).collectorId || '').toString().toLowerCase();
        const targetPid = (collectorId || '').toString().toLowerCase();
        
        // Filter by user collector if provided, else just by client and pending
        return cid === targetCid && p.status === 'pending' && (!targetPid || pid === targetPid || pid === '');
      });
      
      if (pendingPayments.length === 0) {
         console.warn(`[removePartialPayment] No matching pending payments found for client ${clientId}`);
      }
      
      for (const p of pendingPayments) {
        await billingService.deletePayment(p.id);
      }

      // Optimistic update
      const newPartials = new Map(get().partialPayments);
      newPartials.delete(clientId);
      const newMarked = new Map(get().markedClients);
      if (!get().paidFullClients.has(clientId) && !get().notHomeClients.has(clientId)) {
          newMarked.delete(clientId);
      }
      set({ partialPayments: newPartials, markedClients: newMarked });

      // Identify collector from cache if not provided to refresh assignments
      const finalCollectorId = collectorId || (get().assignments as any[]).find(a => a.invoice.client_id === clientId)?.invoice?.collector_id;
      
      if (finalCollectorId) {
        await get().fetchAssignments(selectedDate, finalCollectorId);
        await get().fetchPaymentsForDate(selectedDate);
      }
      set({ loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  submitDeposit: async (amount: number, clientIds: string[], paymentIds: string[], collectorId?: string) => {
    set({ loading: true, error: null });
    try {
      if (!collectorId) throw new Error("Collector ID required");
      const dateStr = get().selectedDate.toISOString().split('T')[0];
      await billingService.verifySettlement(collectorId, dateStr);
      set({ 
        loading: false, 
        paidFullClients: new Set(), 
        partialPayments: new Map(), 
        markedClients: new Map(),
        lockedAssignments: new Set(),
        settledAssignments: new Set()
      });
      await get().fetchAssignments(get().selectedDate, collectorId);
      await get().fetchPaymentsForDate(get().selectedDate);
      await get().fetchDepositHistory(collectorId);
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  fetchTodayCollection: async () => {
    const today = new Date().toISOString().split('T')[0];
    const { payments = [] } = get();
    const total = payments
      .filter(p => {
        const date = (p.received_at || '').toString().split('T')[0];
        return date === today && p.method === 'collector';
      })
      .reduce((sum, p) => sum + p.amount, 0);
    set({ todayCollection: total });
  },

  fetchPaymentsForDate: async (date: Date) => {
    set({ loading: true, error: null });
    try {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const startStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const endStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(lastDay)}`;

      const res: any = await billingService.getPayments({ page: 1, page_size: 1000, method: 'collector', start_date: startStr, end_date: endStr });
      set({ payments: (Array.isArray(res) ? res : (res.data || [])), loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false, payments: [] });
    }
  },

  fetchDepositHistory: async (collectorId: string, startDate?: Date | string, endDate?: Date | string) => {
    set({ loading: true, error: null });
    const startObj = startDate ? (typeof startDate === 'string' ? new Date(startDate) : startDate) : undefined;
    const endObj = endDate ? (typeof endDate === 'string' ? new Date(endDate) : endDate) : undefined;
    try {
      const res: any = await billingService.getSettlements({ 
        collector_id: collectorId,
        start_date: startObj?.toISOString().split('T')[0], 
        end_date: endObj?.toISOString().split('T')[0] 
      } as any);
      set({ depositHistory: (Array.isArray(res) ? res : (res.data || [])), loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false, depositHistory: [] });
    }
  },

  getClientPayments: (clientId: string) => (get().payments || []).filter(p => p.client_id === clientId),
  isClientPaidFull: (clientId: string) => get().paidFullClients.has(clientId),
  isClientNotHome: (clientId: string) => get().notHomeClients.has(clientId),
  getClientPartialAmount: (clientId: string) => get().partialPayments.get(clientId) || 0,
  isAssignmentLocked: (invoiceId: string) => get().lockedAssignments.has(invoiceId),
  openPartialPaymentModal: (client: any) => set({ partialPaymentModal: { open: true, client } }),
  closePartialPaymentModal: () => set({ partialPaymentModal: { open: false, client: null } }),
  openDepositModal: () => set({ depositModal: { open: true } }),
  closeDepositModal: () => set({ depositModal: { open: false } }),
  setSelectedDate: (date: Date) => set({ selectedDate: date }),
  setSelectedAssignment: (assignment: CollectorAssignment | null) => set({ selectedAssignment: assignment }),
  clearError: () => set({ error: null }),
}));
