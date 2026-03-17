import { create } from 'zustand';
import { DashboardData, dashboardService } from '@/lib/api/dashboardService';

interface DashboardState {
  data: DashboardData | null;
  isFullData: boolean;
  loading: boolean;
  bootstrapLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  fetchDashboardData: () => Promise<void>;
  fetchBootstrapData: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  data: null,
  isFullData: false,
  loading: false,
  bootstrapLoading: false,
  error: null,
  lastUpdated: null,

  fetchDashboardData: async () => {
    // Prevent concurrent calls
    const state = get();
    if (state.loading) {
      return;
    }

    // Cache check: if we have full data and it's less than 1 minute old, skip
    const oneMinuteAgo = new Date(Date.now() - 60000);
    if (state.isFullData && state.lastUpdated && state.lastUpdated > oneMinuteAgo) {
      // console.log('[Dashboard] Using cached data (less than 1 min old)');
      return;
    }
    
    set({ loading: true, error: null });
    
    const timeoutId = setTimeout(() => {
      set({ loading: false });
    }, 15000);
    
    try {
      const apiPromise = dashboardService.getDashboardData();
      
      // Dashboard summary is the "source of truth", it contains everything
      const data = await apiPromise;
      
      set({ data, isFullData: true, loading: false, lastUpdated: new Date(), error: null });
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      let errorMessage = 'Failed to load dashboard statistics';
      if (error?.response?.data?.error) errorMessage = error.response.data.error;
      else if (error?.message) errorMessage = error.message;
      
      set({ error: errorMessage, loading: false });
      console.warn('[Dashboard] Failed to load dashboard stats:', errorMessage);
    }
  },

  fetchBootstrapData: async () => {
    const state = get();
    // If we already have full statistical data or bootstrap is already loading, skip
    if (state.isFullData || state.bootstrapLoading || state.loading) {
      return;
    }

    set({ bootstrapLoading: true, error: null });

    const timeoutId = setTimeout(() => {
      set({ bootstrapLoading: false });
    }, 15000);

    try {
      const bootstrapData = await dashboardService.getBootstrapData();
      
      // Merge with existing data if any
      set((state) => ({
        data: {
          ...state.data,
          ...bootstrapData,
        } as DashboardData,
        bootstrapLoading: false,
        // Don't set isFullData here, as this is just bootstrap
        lastUpdated: new Date(),
        error: null
      }));
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      let errorMessage = 'Failed to load bootstrap data';
      if (error?.response?.data?.error) errorMessage = error.response.data.error;
      else if (error?.message) errorMessage = error.message;
      
      set({ bootstrapLoading: false, error: errorMessage });
      console.warn('[Dashboard] Failed to load bootstrap data:', errorMessage);
    }
  },

  refresh: async () => {
    const { fetchDashboardData } = get();
    await fetchDashboardData();
  },
 
  reset: () => {
    set({
      data: null,
      isFullData: false,
      loading: false,
      bootstrapLoading: false,
      error: null,
      lastUpdated: null,
    });
  },
}));
