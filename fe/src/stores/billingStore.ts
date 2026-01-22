import { create } from "zustand";
import { billingService } from "@/lib/api/billingService";
import { Invoice, Payment, BillingSummary, CreateInvoiceRequest, RecordPaymentRequest } from "@/lib/api/types";
import { toApiError } from "@/lib/utils/errors";

interface BillingState {
  // Invoices
  invoices: Invoice[];
  invoice: Invoice | null;
  overdueInvoices: Invoice[];
  
  // Payments
  payments: Payment[];
  payment: Payment | null;
  
  // Summary
  summary: BillingSummary | null;
  
  // UI State
  loading: boolean;
  error: string | null;
  
  // Pagination
  invoicePagination: {
    page: number;
    page_size: number;
    total: number;
  };
  paymentPagination: {
    page: number;
    page_size: number;
    total: number;
  };
  
  // Filters
  invoiceFilters: {
    client_id?: string;
    client_name?: string;
    phone?: string;
    address?: string;
    group_id?: string;
    status?: string;
  };
  paymentFilters: {
    client_id?: string;
    method?: string;
  };
}

interface BillingActions {
  // Invoice actions
  fetchInvoices: () => Promise<void>;
  fetchInvoice: (id: string) => Promise<void>;
  createInvoice: (data: CreateInvoiceRequest) => Promise<Invoice>;
  cancelInvoice: (id: string) => Promise<void>;
  fetchOverdueInvoices: () => Promise<void>;
  fetchClientPendingInvoices: (clientId: string) => Promise<Invoice[]>;
  generateMonthlyInvoice: (clientId: string) => Promise<Invoice>;
  fetchInvoicePayments: (invoiceId: string) => Promise<Payment[]>;
  
  // Payment actions
  fetchPayments: () => Promise<void>;
  fetchPayment: (id: string) => Promise<void>;
  recordPayment: (data: RecordPaymentRequest) => Promise<Payment>;
  
  // Summary
  fetchBillingSummary: () => Promise<void>;
  
  // Filters & Pagination
  setInvoiceFilters: (filters: Partial<BillingState["invoiceFilters"]>) => void;
  setPaymentFilters: (filters: Partial<BillingState["paymentFilters"]>) => void;
  setInvoicePagination: (pagination: Partial<BillingState["invoicePagination"]>) => void;
  setPaymentPagination: (pagination: Partial<BillingState["paymentPagination"]>) => void;
  
  // Clear
  clearInvoice: () => void;
  clearPayment: () => void;
}

export const useBillingStore = create<BillingState & BillingActions>((set, get) => ({
  invoices: [],
  invoice: null,
  overdueInvoices: [],
  payments: [],
  payment: null,
  summary: null,
  loading: false,
  error: null,
  invoicePagination: {
    page: 1,
    page_size: 20,
    total: 0,
  },
  paymentPagination: {
    page: 1,
    page_size: 20,
    total: 0,
  },
  invoiceFilters: {},
  paymentFilters: {},

  fetchInvoices: async () => {
    // Prevent concurrent calls
    const state = get();
    if (state.loading) {
      return; // Already fetching, skip this call
    }
    
    set({ loading: true, error: null });
    try {
      const { page, page_size } = get().invoicePagination;
      const { client_id, client_name, phone, address, group_id, status } = get().invoiceFilters;
      const response = await billingService.getInvoices(page, page_size, client_id, status, client_name, phone, address, group_id);
      set({
        invoices: response.data || [],
        invoicePagination: { ...get().invoicePagination, total: response.total || 0 },
        loading: false,
      });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: false,
        invoices: [], // Ensure invoices is always an array
      });
    }
  },

  fetchInvoice: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const invoice = await billingService.getInvoice(id);
      set({ invoice, loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  createInvoice: async (data: CreateInvoiceRequest) => {
    set({ loading: true, error: null });
    try {
      const invoice = await billingService.createInvoice(data);
      set((state) => ({
        invoices: [invoice, ...state.invoices],
        loading: false,
      }));
      return invoice;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  cancelInvoice: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await billingService.cancelInvoice(id);
      set((state) => ({
        invoices: state.invoices.map((inv) =>
          inv.id === id ? { ...inv, status: "cancelled" as const } : inv
        ),
        invoice: state.invoice?.id === id ? { ...state.invoice, status: "cancelled" as const } : state.invoice,
        loading: false,
      }));
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  fetchOverdueInvoices: async () => {
    set({ loading: true, error: null });
    try {
      const invoices = await billingService.getOverdueInvoices();
      set({ overdueInvoices: invoices || [], loading: false });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: false,
        overdueInvoices: [], // Ensure overdueInvoices is always an array
      });
    }
  },

  fetchClientPendingInvoices: async (clientId: string) => {
    try {
      return await billingService.getClientPendingInvoices(clientId);
    } catch (err) {
      set({ error: toApiError(err).message });
      throw err;
    }
  },

  generateMonthlyInvoice: async (clientId: string) => {
    set({ loading: true, error: null });
    try {
      const invoice = await billingService.generateMonthlyInvoice(clientId);
      set((state) => ({
        invoices: [invoice, ...state.invoices],
        loading: false,
      }));
      return invoice;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  fetchInvoicePayments: async (invoiceId: string) => {
    try {
      return await billingService.getInvoicePayments(invoiceId);
    } catch (err) {
      set({ error: toApiError(err).message });
      throw err;
    }
  },

  fetchPayments: async () => {
    // Prevent concurrent calls
    const state = get();
    if (state.loading) {
      return; // Already fetching, skip this call
    }
    
    set({ loading: true, error: null });
    try {
      const { page, page_size } = get().paymentPagination;
      const { client_id, method } = get().paymentFilters;
      const response = await billingService.getPayments(page, page_size, client_id, method);
      set({
        payments: response.data || [],
        paymentPagination: { ...get().paymentPagination, total: response.total || 0 },
        loading: false,
      });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: false,
        payments: [], // Ensure payments is always an array
      });
    }
  },

  fetchPayment: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const payment = await billingService.getPayment(id);
      set({ payment, loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  recordPayment: async (data: RecordPaymentRequest) => {
    set({ loading: true, error: null });
    try {
      const payment = await billingService.recordPayment(data);
      set((state) => ({
        payments: [payment, ...state.payments],
        loading: false,
      }));
      // Refresh invoice if it's the same
      if (get().invoice?.id === data.invoice_id) {
        await get().fetchInvoice(data.invoice_id);
      }
      return payment;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  fetchBillingSummary: async () => {
    // Prevent concurrent calls - use separate loading flag check
    // Since this can be called independently, we'll allow it even if other operations are loading
    set({ error: null });
    try {
      const summary = await billingService.getBillingSummary();
      set({ summary });
    } catch (err) {
      set({ error: toApiError(err).message });
    }
  },

  setInvoiceFilters: (filters) => {
    set((state) => ({
      invoiceFilters: { ...state.invoiceFilters, ...filters },
      invoicePagination: { ...state.invoicePagination, page: 1 },
    }));
  },

  setPaymentFilters: (filters) => {
    set((state) => ({
      paymentFilters: { ...state.paymentFilters, ...filters },
      paymentPagination: { ...state.paymentPagination, page: 1 },
    }));
  },

  setInvoicePagination: (pagination) => {
    set((state) => ({
      invoicePagination: { ...state.invoicePagination, ...pagination },
    }));
  },

  setPaymentPagination: (pagination) => {
    set((state) => ({
      paymentPagination: { ...state.paymentPagination, ...pagination },
    }));
  },

  clearInvoice: () => set({ invoice: null }),
  clearPayment: () => set({ payment: null }),
}));

