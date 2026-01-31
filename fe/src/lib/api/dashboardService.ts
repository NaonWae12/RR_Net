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
    // Log before API call
    // let isAuthenticated = false;
    // let token = null;
    // let authHeader = null;
    // try {
    //   const authStore = (await import("@/stores/authStore")).useAuthStore;
    //   if (authStore) {
    //     const authState = authStore.getState();
    //     isAuthenticated = authState.isAuthenticated;
    //     token = authState.token;
    //   }
    // } catch (e) {
    //   // Ignore
    // }
    // console.log('[API CALL] getClientStats - BEFORE call:', {
    //   endpoint: '/clients/stats',
    //   isAuthenticated,
    //   token: token ? token.substring(0, 20) + '...' : null,
    //   authHeader: 'Will be set by interceptor',
    // });
    const response = await apiClient.get('/clients/stats');
    return response.data;
  },

  async getPlan(): Promise<PlanInfo> {
    // let isAuthenticated = false;
    // let token = null;
    // try {
    //   const authStore = (await import("@/stores/authStore")).useAuthStore;
    //   if (authStore) {
    //     const authState = authStore.getState();
    //     isAuthenticated = authState.isAuthenticated;
    //     token = authState.token;
    //   }
    // } catch (e) {
    //   // Ignore
    // }
    // console.log('[API CALL] getPlan - BEFORE call:', {
    //   endpoint: '/my/plan',
    //   isAuthenticated,
    //   token: token ? token.substring(0, 20) + '...' : null,
    // });
    const response = await apiClient.get('/my/plan');
    return response.data;
  },

  async getFeatures(): Promise<FeatureMap> {
    // let isAuthenticated = false;
    // let token = null;
    // try {
    //   const authStore = (await import("@/stores/authStore")).useAuthStore;
    //   if (authStore) {
    //     const authState = authStore.getState();
    //     isAuthenticated = authState.isAuthenticated;
    //     token = authState.token;
    //   }
    // } catch (e) {
    //   // Ignore
    // }
    // console.log('[API CALL] getFeatures - BEFORE call:', {
    //   endpoint: '/my/features',
    //   isAuthenticated,
    //   token: token ? token.substring(0, 20) + '...' : null,
    // });
    const response = await apiClient.get('/my/features');
    return response.data.features;
  },

  async getLimits(): Promise<LimitMap> {
    // let isAuthenticated = false;
    // let token = null;
    // try {
    //   const authStore = (await import("@/stores/authStore")).useAuthStore;
    //   if (authStore) {
    //     const authState = authStore.getState();
    //     isAuthenticated = authState.isAuthenticated;
    //     token = authState.token;
    //   }
    // } catch (e) {
    //   // Ignore
    // }
    // console.log('[API CALL] getLimits - BEFORE call:', {
    //   endpoint: '/my/limits',
    //   isAuthenticated,
    //   token: token ? token.substring(0, 20) + '...' : null,
    // });
    const response = await apiClient.get('/my/limits');
    return response.data.limits;
  },

  async getDashboardData(): Promise<DashboardData> {
    const response = await apiClient.get('/dashboard/summary');
    return response.data;
  },
};

export default dashboardService;

