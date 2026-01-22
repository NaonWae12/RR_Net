import { create } from 'zustand';
import { Client, ClientFilters, ClientListResponse, clientService } from '@/lib/api/clientService';

interface ClientState {
  clients: Client[];
  selectedClient: Client | null;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: ClientFilters;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchClients: (filters?: ClientFilters) => Promise<void>;
  fetchClient: (id: string) => Promise<void>;
  setFilters: (filters: ClientFilters) => void;
  setPage: (page: number) => void;
  clearSelectedClient: () => void;
  reset: () => void;
}

const initialState = {
  clients: [],
  selectedClient: null,
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0,
  filters: {},
  loading: false,
  error: null,
};

export const useClientStore = create<ClientState>((set, get) => ({
  ...initialState,

  fetchClients: async (filters?: ClientFilters) => {
    // Prevent concurrent calls
    const state = get();
    if (state.loading) {
      return; // Already fetching, skip this call
    }
    
    set({ loading: true, error: null });
    try {
      const currentFilters = filters || get().filters;
      // Build request filters with all current filter values
      // Spread all filters first, then override page/page_size
      const requestFilters: ClientFilters = {
        ...currentFilters,
        page: currentFilters.page || get().page,
        page_size: currentFilters.page_size || get().pageSize,
      };
      
      // Explicitly preserve group_id - if it's in currentFilters, include it
      // Only exclude if it's explicitly undefined (not if it's empty string)
      if (currentFilters.group_id !== undefined) {
        requestFilters.group_id = currentFilters.group_id;
      }
      
      const response = await clientService.getClients(requestFilters);
      
      // Calculate totalPages if not provided, or ensure it's a valid number
      const calculatedTotalPages = response.total_pages ?? 
        (response.total && response.page_size 
          ? Math.ceil(response.total / response.page_size) 
          : 0);

      // Update state - only update filters if they were explicitly provided
      // This prevents unnecessary state updates that could trigger re-renders
      const newState: any = {
        clients: response.data || [],
        total: response.total || 0,
        page: response.page || 1,
        pageSize: response.page_size || 10,
        totalPages: Math.max(0, Math.floor(calculatedTotalPages)),
        loading: false,
      };
      
      // Only update filters if they were explicitly provided (not from existing state)
      if (filters !== undefined) {
        newState.filters = currentFilters;
      }
      
      set(newState);
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to load clients',
        loading: false,
      });
    }
  },

  fetchClient: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const client = await clientService.getClient(id);
      set({ selectedClient: client, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to load client',
        loading: false,
      });
    }
  },

  setFilters: (filters: ClientFilters) => {
    set({ filters, page: 1 });
  },

  setPage: (page: number) => {
    set({ page });
  },

  clearSelectedClient: () => {
    set({ selectedClient: null });
  },

  reset: () => {
    set(initialState);
  },
}));


