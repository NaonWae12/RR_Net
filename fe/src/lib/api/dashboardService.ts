import apiClient from './apiClient';

export interface ClientStats {
  total: number;
  limit: number;
  unlimited: boolean;
  remaining: number;
}

export interface PlanInfo {
  id: string;
  code: string;
  name: string;
  description?: string;
  price_monthly: number;
  currency: string;
  limits: Record<string, number>;
  features: string[];
  is_active: boolean;
}

export interface FeatureMap {
  [key: string]: boolean;
}

export interface LimitMap {
  [key: string]: number;
}

export interface DashboardData {
  clientStats: ClientStats;
  plan: PlanInfo | null;
  features: FeatureMap;
  limits: LimitMap;
}

export const dashboardService = {
  async getClientStats(): Promise<ClientStats> {
    const response = await apiClient.get('/clients/stats');
    return response.data;
  },

  async getPlan(): Promise<PlanInfo> {
    const response = await apiClient.get('/my/plan');
    return response.data;
  },

  async getFeatures(): Promise<FeatureMap> {
    const response = await apiClient.get('/my/features');
    return response.data.features;
  },

  async getLimits(): Promise<LimitMap> {
    const response = await apiClient.get('/my/limits');
    return response.data.limits;
  },

  async getDashboardData(): Promise<DashboardData> {
    const [clientStats, plan, features, limits] = await Promise.allSettled([
      this.getClientStats(),
      this.getPlan(),
      this.getFeatures(),
      this.getLimits(),
    ]);

    return {
      clientStats: clientStats.status === 'fulfilled' ? clientStats.value : { total: 0, limit: 0, unlimited: false, remaining: 0 },
      plan: plan.status === 'fulfilled' ? plan.value : null,
      features: features.status === 'fulfilled' ? features.value : {},
      limits: limits.status === 'fulfilled' ? limits.value : {},
    };
  },
};

export default dashboardService;

