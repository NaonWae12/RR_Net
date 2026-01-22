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
    const [clientStats, plan, features, limits] = await Promise.allSettled([
      this.getClientStats(),
      this.getPlan(),
      this.getFeatures(),
      this.getLimits(),
    ]);

    // Check if ALL requests failed with 401 (unauthorized)
    // This indicates auth is not ready or token is invalid
    const allRejected = 
      clientStats.status === 'rejected' &&
      plan.status === 'rejected' &&
      features.status === 'rejected' &&
      limits.status === 'rejected';
    
    const all401 = allRejected &&
      clientStats.reason?.response?.status === 401 &&
      plan.reason?.response?.status === 401 &&
      features.reason?.response?.status === 401 &&
      limits.reason?.response?.status === 401;

    // If all requests failed with 401, throw error instead of returning empty data
    // This prevents silent failure where page thinks dashboard loaded but data is empty
    if (all401) {
      const error = new Error('All dashboard endpoints returned 401 Unauthorized. Auth may not be ready.');
      (error as any).code = 'DASHBOARD_UNAUTHORIZED';
      (error as any).statusCode = 401;
      throw error;
    }

    // Return partial data if some requests succeeded
    // This allows best-effort loading even if some endpoints fail
    return {
      clientStats: clientStats.status === 'fulfilled' ? clientStats.value : { total: 0, limit: 0, unlimited: false, remaining: 0 },
      plan: plan.status === 'fulfilled' ? plan.value : null,
      features: features.status === 'fulfilled' ? features.value : {},
      limits: limits.status === 'fulfilled' ? limits.value : {},
    };
  },
};

export default dashboardService;

