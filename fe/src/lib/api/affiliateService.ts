import apiClient from './apiClient';
import { Plan } from "./types";

export interface RegisterAffiliateRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface Affiliate {
  id: string;
  user_id: string;
  code: string;
  tier: string;
  wallet_balance: number;
  total_earnings: number;
  referred_count: number;
  status: string;
  metadata?: any;
  tier_expires_at?: string;
  tier_upgraded_at?: string;
  created_at: string;
}

export interface AffiliateTierSettings {
  silver: number;
  gold: number;
  platinum: number;
  commission_silver: number;
  commission_gold: number;
  commission_platinum: number;
  retention_months: number;
}

export interface AffiliateDashboardData {
  affiliate: Affiliate;
  referrals: any[];
  stats: {
    wallet_balance: number;
    total_earnings: number;
    referred_count: number;
  };
}

export interface Withdrawal {
  id: string;
  affiliate_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  processed_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface AffiliateCampaign {
  id: string;
  name: string;
  description: string;
  tier_config: AffiliateTierSettings;
  max_affiliates: number;
  current_affiliates_count: number;
  starts_at: string;
  ends_at?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const affiliateService = {
  register: async (data: RegisterAffiliateRequest): Promise<Affiliate> => {
    const response = await apiClient.post<Affiliate>('/affiliate/register', data);
    return response.data;
  },

  getDashboard: async (): Promise<AffiliateDashboardData> => {
    const response = await apiClient.get<AffiliateDashboardData>('/affiliate/dashboard');
    return response.data;
  },

  // Admin Methods
  listAll: async (): Promise<Affiliate[]> => {
    const response = await apiClient.get<Affiliate[]>('/superadmin/affiliates');
    return response.data;
  },

  getGlobalStats: async (): Promise<any> => {
    const response = await apiClient.get('/superadmin/affiliates/stats');
    return response.data;
  },

  updateStatus: async (id: string, status: string): Promise<void> => {
    await apiClient.patch(`/superadmin/affiliates/${id}/status`, { status });
  },

  getDetail: async (id: string): Promise<AffiliateDashboardData> => {
    const response = await apiClient.get<AffiliateDashboardData>(`/superadmin/affiliates/${id}`);
    return response.data;
  },

  // For logged-in affiliates (non-admin)
  getSettings: async (): Promise<AffiliateTierSettings> => {
    const response = await apiClient.get<AffiliateTierSettings>('/affiliate/settings');
    return response.data;
  },

  // For Super Admin management page
  getAdminSettings: async (): Promise<AffiliateTierSettings> => {
    const response = await apiClient.get<AffiliateTierSettings>('/superadmin/affiliates/settings');
    return response.data;
  },

  updateSettings: async (settings: AffiliateTierSettings): Promise<void> => {
    await apiClient.patch('/superadmin/affiliates/settings', settings);
  },

  getPublicPlans: async (): Promise<Plan[]> => {
    const response = await apiClient.get<{ plans: Plan[], total: number }>('/plans/public');
    return response.data.plans;
  },

  getWithdrawals: async (): Promise<Withdrawal[]> => {
    const response = await apiClient.get<Withdrawal[]>('/affiliate/withdrawals');
    return response.data;
  },

  createWithdrawal: async (data: { amount: number, bank_name: string, account_number: string, account_name: string }): Promise<void> => {
    await apiClient.post('/affiliate/withdrawals', data);
  },

  updateMetadata: async (metadata: any): Promise<void> => {
    await apiClient.patch('/affiliate/profile/metadata', metadata);
  },

  // Campaign Admin Methods
  listCampaigns: async (): Promise<AffiliateCampaign[]> => {
    const response = await apiClient.get<AffiliateCampaign[]>('/superadmin/affiliates/campaigns');
    return response.data;
  },

  joinProgram: async (): Promise<Affiliate> => {
    const response = await apiClient.post<Affiliate>('/my/affiliate-join');
    return response.data;
  },

  getMyStatus: async (): Promise<{ status: string, id?: string }> => {
    const response = await apiClient.get<{ status: string, id?: string }>('/my/affiliate-status');
    return response.data;
  },

  getCampaign: async (id: string): Promise<AffiliateCampaign> => {
    const response = await apiClient.get<AffiliateCampaign>(`/superadmin/affiliates/campaigns/${id}`);
    return response.data;
  },

  createCampaign: async (data: Partial<AffiliateCampaign>): Promise<AffiliateCampaign> => {
    const response = await apiClient.post<AffiliateCampaign>('/superadmin/affiliates/campaigns', data);
    return response.data;
  },

  updateCampaign: async (id: string, data: Partial<AffiliateCampaign>): Promise<void> => {
    await apiClient.patch(`/superadmin/affiliates/campaigns/${id}`, data);
  },
};
