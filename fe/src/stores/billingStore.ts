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
  loadingInvoices: boolean;
  loadingPayments: boolean;
  loadingSummary: boolean;
  loadingOverdue: boolean;
  loading: boolean; // Legacy global flag, will be updated by individual flags
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
    start_date?: string;
    end_date?: string;
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
  reset: () => void;
}

export const useBillingStore = create<BillingState & BillingActions>((set, get) => ({
  invoices: [],
  invoice: null,
  overdueInvoices: [],
  payments: [],
  payment: null,
  summary: null,
  loadingInvoices: false,
  loadingPayments: false,
  loadingSummary: false,
  loadingOverdue: false,
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
    if (get().loadingInvoices) return; // Prevention
    
    set({ loadingInvoices: true, loading: true, error: null });
    
    // Safety timeout
    const timeoutId = setTimeout(() => {
      set({ loadingInvoices: false, loading: get().loadingPayments || get().loadingSummary || get().loadingOverdue });
    }, 15000);

    try {
      const { page, page_size } = get().invoicePagination;
      const { client_id, client_name, phone, address, group_id, status, start_date, end_date } = get().invoiceFilters;
      const response = await billingService.getInvoices(page, page_size, client_id, status, client_name, phone, address, group_id, start_date, end_date);
      set({
        invoices: response.data || [],
        invoicePagination: { ...get().invoicePagination, total: response.total || 0 },
        loadingInvoices: false,
        loading: get().loadingPayments || get().loadingSummary || get().loadingOverdue,
      });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      set({ 
        error: toApiError(err).message, 
        loadingInvoices: false,
        loading: get().loadingPayments || get().loadingSummary || get().loadingOverdue,
        invoices: [], 
      });
    }
  },

  fetchInvoice: async (id: string) => {
    if (id === 'create') return; // Prevent fetching 'create' as ID
    set({ loading: true, error: null });
    try {
      const invoice = await billingService.getInvoice(id);
      set({ 
        invoice, 
        loading: get().loadingInvoices || get().loadingPayments || get().loadingSummary || get().loadingOverdue 
      });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: get().loadingInvoices || get().loadingPayments || get().loadingSummary || get().loadingOverdue 
      });
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
    if (get().loadingOverdue) return;
    set({ loadingOverdue: true, loading: true, error: null });
    
    // Safety timeout
    const timeoutId = setTimeout(() => {
      set({ loadingOverdue: false, loading: get().loadingInvoices || get().loadingPayments || get().loadingSummary });
    }, 15000);

    try {
      const invoices = await billingService.getOverdueInvoices();
      clearTimeout(timeoutId);
      set({ 
        overdueInvoices: invoices || [], 
        loadingOverdue: false,
        loading: get().loadingInvoices || get().loadingPayments || get().loadingSummary,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      set({ 
        error: toApiError(err).message, 
        loadingOverdue: false,
        loading: get().loadingInvoices || get().loadingPayments || get().loadingSummary,
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
    if (get().loadingPayments) return; // Prevention
    
    set({ loadingPayments: true, loading: true, error: null });
    
    // Safety timeout
    const timeoutId = setTimeout(() => {
      set({ loadingPayments: false, loading: get().loadingInvoices || get().loadingSummary || get().loadingOverdue });
    }, 15000);

    try {
      const { page, page_size } = get().paymentPagination;
      const { client_id, method } = get().paymentFilters;
      const response = await billingService.getPayments({ 
        page, 
        page_size, 
        client_id, 
        method 
      });
      set({
        payments: response.data || [],
        paymentPagination: { ...get().paymentPagination, total: response.total || 0 },
        loadingPayments: false,
        loading: get().loadingInvoices || get().loadingSummary || get().loadingOverdue,
      });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      set({ 
        error: toApiError(err).message, 
        loadingPayments: false,
        loading: get().loadingInvoices || get().loadingSummary || get().loadingOverdue,
        payments: [],
      });
    }
  },

  fetchPayment: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const payment = await billingService.getPayment(id);
      set({ 
        payment, 
        loading: get().loadingInvoices || get().loadingPayments || get().loadingSummary || get().loadingOverdue 
      });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: get().loadingInvoices || get().loadingPayments || get().loadingSummary || get().loadingOverdue 
      });
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
    if (get().loadingSummary) return;
    set({ loadingSummary: true, loading: true, error: null });
    
    // Safety timeout
    const timeoutId = setTimeout(() => {
      set({ loadingSummary: false, loading: get().loadingInvoices || get().loadingPayments || get().loadingOverdue });
    }, 15000);

    try {
      const summary = await billingService.getBillingSummary();
      clearTimeout(timeoutId);
      set({ 
        summary, 
        loadingSummary: false,
        loading: get().loadingInvoices || get().loadingPayments || get().loadingOverdue,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      set({ 
        error: toApiError(err).message,
        loadingSummary: false,
        loading: get().loadingInvoices || get().loadingPayments || get().loadingOverdue,
      });
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
  reset: () => {
    set({
      invoices: [],
      invoice: null,
      overdueInvoices: [],
      payments: [],
      payment: null,
      summary: null,
      loadingInvoices: false,
      loadingPayments: false,
      loadingSummary: false,
      loadingOverdue: false,
      loading: false,
      error: null,
      invoiceFilters: {},
      paymentFilters: {},
      invoicePagination: { page: 1, page_size: 20, total: 0 },
      paymentPagination: { page: 1, page_size: 20, total: 0 },
    });
  },
}));
