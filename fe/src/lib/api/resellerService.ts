import apiClient from './apiClient';
import { 
  Reseller, 
  ResellerListResponse, 
  ResellerPrice, 
  ResellerDiscount, 
  UpgradeClientRequest, 
  ResellerStatus,
  SetResellerPriceRequest,
  CreateResellerPromoRequest,
  ProcessResellerPurchaseRequest,
  ResellerPurchase,
  ResellerPurchaseListResponse
} from './types';

export interface ResellerFilters {
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface PurchaseFilters {
  reseller_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export const resellerService = {
  // Reseller Management
  async getResellers(filters: ResellerFilters = {}): Promise<ResellerListResponse> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.page_size) params.append('page_size', String(filters.page_size));

    const response = await apiClient.get(`/resellers?${params.toString()}`);
    return response.data;
  },

  async upgradeClient(data: UpgradeClientRequest): Promise<Reseller> {
    const response = await apiClient.post<{ data: Reseller }>('/resellers/upgrade', data);
    return response.data?.data;
  },

  async updateStatus(id: string, status: ResellerStatus): Promise<void> {
    await apiClient.patch(`/resellers/${id}/status`, { status });
  },

  // Price Management
  async getPrices(resellerId: string): Promise<ResellerPrice[]> {
    const response = await apiClient.get<{ data: ResellerPrice[] }>(`/resellers/${resellerId}/prices`);
    return response.data?.data || [];
  },

  async setPrice(resellerId: string, data: SetResellerPriceRequest): Promise<ResellerPrice> {
    const response = await apiClient.post<{ data: ResellerPrice }>(`/resellers/${resellerId}/prices`, data);
    return response.data?.data;
  },

  async deletePrice(resellerId: string, priceId: string): Promise<void> {
    await apiClient.delete(`/resellers/${resellerId}/prices/${priceId}`);
  },

  async getGlobalPrices(): Promise<ResellerPrice[]> {
    const response = await apiClient.get<{ data: ResellerPrice[] }>('/resellers/global-prices');
    return response.data?.data || [];
  },

  async setGlobalPrice(data: SetResellerPriceRequest): Promise<ResellerPrice> {
    const response = await apiClient.post<{ data: ResellerPrice }>('/resellers/global-prices', data);
    return response.data?.data;
  },

  // Promo Code Management
  async getPromos(): Promise<ResellerDiscount[]> {
    const response = await apiClient.get<{ data: ResellerDiscount[] }>('/resellers/promos');
    return response.data?.data || [];
  },

  async createPromo(data: CreateResellerPromoRequest): Promise<ResellerDiscount> {
    const response = await apiClient.post<{ data: ResellerDiscount }>('/resellers/promos', data);
    return response.data?.data;
  },

  async togglePromoStatus(id: string): Promise<void> {
    await apiClient.post(`/resellers/promos/${id}/toggle`);
  },

  async deletePromo(id: string): Promise<void> {
    await apiClient.delete(`/resellers/promos/${id}`);
  },

  // Purchase Management
  async processPurchase(resellerId: string, data: ProcessResellerPurchaseRequest): Promise<ResellerPurchase> {
    const response = await apiClient.post<{ data: ResellerPurchase }>(`/resellers/${resellerId}/purchases`, data);
    return response.data?.data;
  },

  async getPurchaseHistory(filters: PurchaseFilters = {}): Promise<ResellerPurchaseListResponse> {
    const params = new URLSearchParams();
    if (filters.reseller_id) params.append('reseller_id', filters.reseller_id);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.page_size) params.append('page_size', String(filters.page_size));

    const response = await apiClient.get(`/resellers/purchases?${params.toString()}`);
    return response.data;
  },

  async deletePurchase(id: string): Promise<void> {
    await apiClient.delete(`/resellers/purchases/${id}`);
  },

  async getPurchase(id: string): Promise<ResellerPurchase> {
    const response = await apiClient.get<{ data: ResellerPurchase }>(`/resellers/purchases/${id}`);
    return response.data?.data;
  },

  // Client Portal methods
  async joinReseller(): Promise<Reseller> {
    const response = await apiClient.post<{ data: Reseller }>('/portal/reseller/join', {});
    return response.data?.data;
  },

  async getMyResellerStatus(): Promise<Reseller | null> {
    const response = await apiClient.get<{ data: Reseller | null }>('/portal/reseller/me');
    return response.data?.data;
  },

  async countActiveVouchers(id: string): Promise<number> {
    const response = await apiClient.get<{ data: number }>(`/resellers/${id}/active-vouchers/count`);
    return response.data?.data || 0;
  },

  async deleteReseller(id: string): Promise<void> {
    await apiClient.delete(`/resellers/${id}`);
  },

  async getMyPrices(): Promise<ResellerPrice[]> {
    const response = await apiClient.get<{ data: ResellerPrice[] }>('/portal/reseller/prices');
    return response.data?.data || [];
  },

  async processMyPurchase(data: ProcessResellerPurchaseRequest): Promise<ResellerPurchase> {
    const response = await apiClient.post<{ data: ResellerPurchase }>('/portal/reseller/purchases', data);
    return response.data?.data;
  },

  async confirmPurchase(id: string): Promise<ResellerPurchase> {
    const response = await apiClient.post<{ data: ResellerPurchase }>(`/resellers/purchases/${id}/confirm`, {});
    return response.data?.data;
  },

  async submitPayment(id: string): Promise<ResellerPurchase> {
    const response = await apiClient.post<{ data: ResellerPurchase }>(`/resellers/purchases/${id}/submit-payment`, {});
    return response.data?.data;
  }
};

export default resellerService;
