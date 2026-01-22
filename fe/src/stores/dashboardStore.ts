import { create } from 'zustand';
import { DashboardData, dashboardService } from '@/lib/api/dashboardService';

interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  fetchDashboardData: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  lastUpdated: null,

  fetchDashboardData: async () => {
    // Prevent concurrent calls
    const state = get();
    if (state.loading) {
      return; // Already fetching, skip this call
    }
    
    set({ loading: true, error: null });
    
    try {
      // Timeout safety net: 20 seconds (dashboard has multiple API calls)
      // If API hangs, this will reject and prevent infinite loading
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout: Dashboard data took too long to load. Please try again.'));
        }, 20000); // 20 seconds
      });
      
      // Race between API call and timeout
      const apiPromise = dashboardService.getDashboardData();
      const data = await Promise.race([apiPromise, timeoutPromise]);
      
      set({ data, loading: false, lastUpdated: new Date(), error: null });
    } catch (error: any) {
      // Soft-fail: Set error but don't throw, don't reset other stores, don't trigger logout
      // Dashboard is best-effort enhancement, errors should not cascade
      let errorMessage = 'Failed to load dashboard data';
      
      if (error?.message && error.message.includes('timeout')) {
        errorMessage = error.message;
      } else if (error.code === 'DASHBOARD_UNAUTHORIZED') {
        errorMessage = 'Dashboard data unavailable (auth not ready). Will retry automatically.';
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      set({ 
        error: errorMessage, 
        loading: false,
        // Keep existing data if available (don't clear on error)
        // This allows pages to use cached data even if refresh fails
      });
      
      // Log error but don't throw - allow app to continue
      console.warn('[Dashboard] Failed to load dashboard data:', errorMessage);
    }
  },

  refresh: async () => {
    const { fetchDashboardData } = get();
    await fetchDashboardData();
  },
}));


