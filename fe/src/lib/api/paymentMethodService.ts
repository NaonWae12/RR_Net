import { apiClient } from './apiClient';

export interface PaymentMethod {
  id: string;
  tenant_id: string | null;
  name: string;
  category: 'bank' | 'cash' | 'e-wallet' | 'pay later';
  provider?: string;
  account_number?: string;
  account_name?: string;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentMethodRequest {
  name: string;
  category: 'bank' | 'cash' | 'e-wallet' | 'pay later';
  provider?: string;
  account_number?: string;
  account_name?: string;
  is_active: boolean;
  metadata?: Record<string, any>;
}

export interface UpdatePaymentMethodRequest {
  name: string;
  category: 'bank' | 'cash' | 'e-wallet' | 'pay later';
  provider?: string;
  account_number?: string;
  account_name?: string;
  is_active: boolean;
  metadata?: Record<string, any>;
}

class PaymentMethodService {
  private baseAdminUrl = '/superadmin/payment-methods';
  private baseFinanceUrl = '/finance/payment-methods';
  private basePortalUrl = '/portal/reseller/payment-methods';

  async list(): Promise<PaymentMethod[]> {
    const response = await apiClient.get<any>(this.baseFinanceUrl);
    // Handle both direct array and { data: [] } format
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data)) return response.data.data;
    return [];
  }

  async listSuperAdmin(): Promise<PaymentMethod[]> {
    const response = await apiClient.get<any>(this.baseAdminUrl);
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data)) return response.data.data;
    return [];
  }

  async listPortal(): Promise<PaymentMethod[]> {
    const response = await apiClient.get<{ data: PaymentMethod[] }>(this.basePortalUrl);
    // The backend handler.List wraps response in "data": []
    return response.data?.data || [];
  }

  // Public endpoint - no auth required
  async listPublic(): Promise<PaymentMethod[]> {
    const response = await apiClient.get<any>('/public/payment-methods/');
    // Handle both direct array and { data: [] } format
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data)) return response.data.data;
    return [];
  }

  async create(data: CreatePaymentMethodRequest): Promise<PaymentMethod> {
    const response = await apiClient.post<PaymentMethod>(this.baseFinanceUrl, data);
    return response.data;
  }

  async get(id: string): Promise<PaymentMethod> {
    const response = await apiClient.get<PaymentMethod>(`${this.baseFinanceUrl}/${id}`);
    return response.data;
  }

  async update(id: string, data: UpdatePaymentMethodRequest): Promise<PaymentMethod> {
    const response = await apiClient.put<PaymentMethod>(`${this.baseFinanceUrl}/${id}`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`${this.baseFinanceUrl}/${id}`);
  }

  async toggleStatus(id: string): Promise<PaymentMethod> {
    const response = await apiClient.patch<PaymentMethod>(`${this.baseFinanceUrl}/${id}/toggle`);
    return response.data;
  }

  // Super Admin endponts
  async createSuperAdmin(data: CreatePaymentMethodRequest): Promise<PaymentMethod> {
    const response = await apiClient.post<PaymentMethod>(this.baseAdminUrl, data);
    return response.data;
  }

  async updateSuperAdmin(id: string, data: UpdatePaymentMethodRequest): Promise<PaymentMethod> {
    const response = await apiClient.put<PaymentMethod>(`${this.baseAdminUrl}/${id}`, data);
    return response.data;
  }

  async deleteSuperAdmin(id: string): Promise<void> {
    await apiClient.delete(`${this.baseAdminUrl}/${id}`);
  }

  async toggleSuperAdminStatus(id: string): Promise<PaymentMethod> {
    const response = await apiClient.patch<PaymentMethod>(`${this.baseAdminUrl}/${id}/toggle`);
    return response.data;
  }
}

export const paymentMethodService = new PaymentMethodService();
