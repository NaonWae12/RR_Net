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
    set({ loading: true, error: null });
    try {
      const data = await dashboardService.getDashboardData();
      set({ data, loading: false, lastUpdated: new Date() });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to load dashboard data', 
        loading: false 
      });
    }
  },

  refresh: async () => {
    const { fetchDashboardData } = get();
    await fetchDashboardData();
  },
}));


