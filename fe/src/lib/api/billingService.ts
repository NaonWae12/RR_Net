import { apiClient } from "./apiClient";
import type {
  Invoice,
  InvoiceListResponse,
  Payment,
  PaymentListResponse,
  PaymentMatrixResponse,
  BillingSummary,
  CreateInvoiceRequest,
  RecordPaymentRequest,
  TempoTemplate,
  RevenueAnalytics,
  Settlement,
} from "./types";

export const billingService = {
  // ========== Invoices ==========
  async getInvoices(
    page: number = 1,
    pageSize: number = 20,
    clientId?: string,
    status?: string,
    clientName?: string,
    phone?: string,
    address?: string,
    groupId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<InvoiceListResponse> {
    const params: any = { page, page_size: pageSize };
    if (clientId) params.client_id = clientId;
    if (status) params.status = status;
    if (clientName) params.client_name = clientName;
    if (phone) params.phone = phone;
    if (address) params.address = address;
    if (groupId) params.group_id = groupId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await apiClient.get<InvoiceListResponse>("/billing/invoices", { params });
    return response.data;
  },

  async getInvoice(id: string): Promise<Invoice> {
    const response = await apiClient.get<Invoice>(`/billing/invoices/${id}`);
    return response.data;
  },

  async createInvoice(data: CreateInvoiceRequest): Promise<Invoice> {
    const response = await apiClient.post<Invoice>("/billing/invoices", data);
    return response.data;
  },

  async cancelInvoice(id: string): Promise<void> {
    await apiClient.post(`/billing/invoices/${id}/cancel`);
  },

  async getOverdueInvoices(): Promise<Invoice[]> {
    const response = await apiClient.get<{ data: Invoice[]; total: number }>("/billing/invoices/overdue");
    return response.data.data;
  },

  async getClientPendingInvoices(clientId: string): Promise<Invoice[]> {
    const response = await apiClient.get<{ data: Invoice[]; total: number }>(`/clients/${clientId}/invoices`);
    return response.data.data;
  },

  async generateMonthlyInvoice(clientId: string): Promise<Invoice> {
    const response = await apiClient.post<Invoice>(`/clients/${clientId}/invoices/generate`);
    return response.data;
  },

  async getInvoicePayments(invoiceId: string): Promise<Payment[]> {
    const response = await apiClient.get<{ data: Payment[]; total: number }>(`/billing/invoices/${invoiceId}/payments`);
    return response.data.data;
  },

  // ========== Payments ==========
  async getPayments(params?: {
    page?: number;
    page_size?: number;
    client_id?: string;
    collector_id?: string;
    method?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaymentListResponse> {
    const response = await apiClient.get<PaymentListResponse>("/billing/payments", { params });
    return response.data;
  },

  async getPayment(id: string): Promise<Payment> {
    const response = await apiClient.get<Payment>(`/billing/payments/${id}`);
    return response.data;
  },

  async recordPayment(data: RecordPaymentRequest): Promise<Payment> {
    const response = await apiClient.post<Payment>("/billing/payments", data);
    return response.data;
  },

  async getPaymentMatrix(params: {
    year?: number;
    q?: string;
    group_id?: string;
    status?: string;
  }): Promise<PaymentMatrixResponse> {
    const response = await apiClient.get<PaymentMatrixResponse>("/billing/payment-matrix", { params });
    return response.data;
  },

  // ========== Summary ==========
  async getBillingSummary(): Promise<BillingSummary> {
    const response = await apiClient.get<BillingSummary>("/billing/summary");
    return response.data;
  },

  async getRevenueAnalytics(params?: {
    start_date?: string;
    end_date?: string;
    interval?: "daily" | "weekly" | "monthly" | "yearly";
  }): Promise<RevenueAnalytics> {
    const response = await apiClient.get<RevenueAnalytics>("/billing/revenue-analytics", { params });
    return response.data;
  },

  // ========== Tempo Templates ==========
  async getTempoTemplates(): Promise<TempoTemplate[]> {
    const response = await apiClient.get<{ data: TempoTemplate[] }>("/billing/tempo-templates");
    return response.data.data ?? [];
  },

  async createTempoTemplate(data: { name: string; due_day: number; description?: string | null }): Promise<TempoTemplate> {
    const response = await apiClient.post<TempoTemplate>("/billing/tempo-templates", data);
    return response.data;
  },

  async updateTempoTemplate(id: string, data: { name: string; due_day: number; description?: string | null }): Promise<TempoTemplate> {
    const response = await apiClient.put<TempoTemplate>(`/billing/tempo-templates/${id}`, data);
    return response.data;
  },

  async deleteTempoTemplate(id: string): Promise<void> {
    await apiClient.delete(`/billing/tempo-templates/${id}`);
  },

  // ========== Settlements ==========
  async getSettlements(params?: {
    start_date?: string;
    end_date?: string;
    status?: "pending" | "verified" | "rejected";
  }): Promise<Settlement[]> {
    const response = await apiClient.get<{ data: Settlement[] }>("/billing/settlements", { params });
    return response.data.data || [];
  },

  async verifySettlement(collectorId: string, date: string): Promise<void> {
    await apiClient.post("/billing/settlements/verify", { collector_id: collectorId, date });
  },

  async deletePayment(paymentId: string): Promise<void> {
    await apiClient.delete(`/billing/payments/${paymentId}`);
  },
};
