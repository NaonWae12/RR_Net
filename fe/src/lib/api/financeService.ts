import { apiClient } from "./apiClient";
import type { 
  RevenueSummary, 
  Transaction, 
  Reimbursement, 
  PaymentMethodAccount, 
  CreatePaymentMethodAccountRequest, 
  UpdatePaymentMethodAccountRequest 
} from "./types";

export const financeService = {
  getRevenueSummary: async (year?: number, month?: number): Promise<RevenueSummary> => {
    const params = year && month ? { year, month } : {};
    const response = await apiClient.get<RevenueSummary>("/finance/summary", { params });
    return response.data;
  },

  getTrend: async (year: number, month: number, source: string): Promise<{ source: string, points: { date: string, amount: number }[], total_amount: number }> => {
    const response = await apiClient.get<{ source: string, points: { date: string, amount: number }[], total_amount: number }>("/finance/trend", { params: { year, month, source } });
    return response.data;
  },

  getTransactions: async (params: {
    limit?: number;
    offset?: number;
    type?: string;
    source?: string;
  }): Promise<{ data: Transaction[]; total: number }> => {
    const response = await apiClient.get<{ data: Transaction[]; total: number }>("/finance/transactions", { params });
    return response.data;
  },

  getBalance: async (): Promise<{ balance: number }> => {
    const response = await apiClient.get<{ balance: number }>("/finance/balance");
    return response.data;
  },

  getAllReimbursements: async (status?: string): Promise<Reimbursement[]> => {
    const params: Record<string, any> = {};
    if (status && status !== "all") params.status = status;
    const response = await apiClient.get<{ data: Reimbursement[], total: number }>("/hr/reimbursements", { params });
    return response.data.data || [];
  },

  markAsPaid: async (id: string, paymentMethodId?: string, paymentReference?: string): Promise<Reimbursement> => {
    const response = await apiClient.post<Reimbursement>(`/hr/reimbursements/${id}/pay`, {
      payment_method_id: paymentMethodId,
      payment_reference: paymentReference
    });
    return response.data;
  },

  consolidateWithPayroll: async (id: string, enabled: boolean): Promise<Reimbursement> => {
    const response = await apiClient.post<Reimbursement>(`/hr/reimbursements/${id}/payroll-consolidate`, { enabled });
    return response.data;
  },

  // Payment Method Methods
  getPaymentMethods: async (): Promise<PaymentMethodAccount[]> => {
    const response = await apiClient.get<{ data: PaymentMethodAccount[] }>("/finance/payment-methods");
    return response.data.data || [];
  },

  createPaymentMethod: async (req: CreatePaymentMethodAccountRequest): Promise<PaymentMethodAccount> => {
    const response = await apiClient.post<PaymentMethodAccount>("/finance/payment-methods", req);
    return response.data;
  },

  updatePaymentMethod: async (id: string, req: UpdatePaymentMethodAccountRequest): Promise<PaymentMethodAccount> => {
    const response = await apiClient.put<PaymentMethodAccount>(`/finance/payment-methods/${id}`, req);
    return response.data;
  },

  deletePaymentMethod: async (id: string): Promise<void> => {
    await apiClient.delete(`/finance/payment-methods/${id}`);
  },

  // Expense Methods
  getExpenses: async (params?: { status?: string; category?: string; is_recurring?: boolean; limit?: number; offset?: number }): Promise<any[]> => {
    const response = await apiClient.get<any>("/finance/expenses", { params });
    return response.data.data || [];
  },

  createExpense: async (expense: {
    title: string;
    amount: number;
    date: string;
    category: string;
    description: string;
    payment_method_id?: string;
    payment_reference?: string;
    is_recurring?: boolean;
    recurring_day?: number;
    recurring_end_at?: string | null;
  }): Promise<any> => {
    const response = await apiClient.post("/finance/expenses", expense);
    return response.data;
  },

  markExpenseAsPaid: async (id: string, paymentMethodId: string, reference: string): Promise<void> => {
    await apiClient.post(`/finance/expenses/${id}/pay`, {
      payment_method_id: paymentMethodId,
      payment_reference: reference
    });
  }
};
