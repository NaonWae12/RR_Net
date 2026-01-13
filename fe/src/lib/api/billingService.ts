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
    groupId?: string
  ): Promise<InvoiceListResponse> {
    const params: any = { page, page_size: pageSize };
    if (clientId) params.client_id = clientId;
    if (status) params.status = status;
    if (clientName) params.client_name = clientName;
    if (phone) params.phone = phone;
    if (address) params.address = address;
    if (groupId) params.group_id = groupId;

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
  async getPayments(
    page: number = 1,
    pageSize: number = 20,
    clientId?: string,
    method?: string
  ): Promise<PaymentListResponse> {
    const params: any = { page, page_size: pageSize };
    if (clientId) params.client_id = clientId;
    if (method) params.method = method;

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
};

