import apiClient from './apiClient';

export interface PortalDashboardData {
  package_name: string;
  status: string;
  bill_amount: number;
  due_date: string | null;
  unpaid_count: number;
  client_name: string;
  client_code: string;
}

export interface PortalInvoice {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  created_at: string;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    method: string;
    received_at: string;
    reference?: string;
  }>;
}

export const portalService = {
  async getDashboardData(): Promise<PortalDashboardData> {
    const response = await apiClient.get('portal/dashboard');
    return response.data;
  },

  async getInvoices(): Promise<PortalInvoice[]> {
    const response = await apiClient.get('portal/invoices');
    return response.data.invoices || [];
  },

  async getInvoiceDetail(invoiceId: string): Promise<PortalInvoice> {
    const response = await apiClient.get(`portal/invoices/${invoiceId}`);
    return response.data;
  },

  async recordPayment(invoiceId: string, amount: number, method: 'cash' | 'collector', reference?: string, notes?: string): Promise<any> {
    const response = await apiClient.post(`portal/invoices/${invoiceId}/payments`, {
      amount,
      method,
      reference,
      notes,
    });
    return response.data;
  },
};

export default portalService;
