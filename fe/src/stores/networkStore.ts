import { create } from "zustand";
import { networkService } from "@/lib/api/networkService";
import { Router, NetworkProfile, CreateRouterRequest, UpdateRouterRequest, CreateNetworkProfileRequest, UpdateNetworkProfileRequest } from "@/lib/api/types";
import { toApiError } from "@/lib/utils/errors";

interface NetworkState {
  // Routers
  routers: Router[];
  router: Router | null;
  routersLoading: boolean;
  
  // Network Profiles
  profiles: NetworkProfile[];
  profile: NetworkProfile | null;
  profilesLoading: boolean;
  
  // UI State (legacy, for backward compatibility)
  loading: boolean;
  error: string | null;
}

interface NetworkActions {
  // Router actions
  fetchRouters: () => Promise<void>;
  fetchRouter: (id: string) => Promise<void>;
  createRouter: (data: CreateRouterRequest) => Promise<Router>;
  updateRouter: (id: string, data: UpdateRouterRequest) => Promise<Router>;
  deleteRouter: (id: string) => Promise<void>;
  testRouterConnection: (id: string) => Promise<{ ok: boolean; identity?: string; latency_ms?: number; error?: string }>;
  disconnectRouter: (id: string) => Promise<void>;
  toggleRemoteAccess: (id: string, enabled: boolean) => Promise<Router>;
  
  // Profile actions
  fetchProfiles: () => Promise<void>;
  fetchProfile: (id: string) => Promise<void>;
  createProfile: (data: CreateNetworkProfileRequest) => Promise<NetworkProfile>;
  updateProfile: (id: string, data: UpdateNetworkProfileRequest) => Promise<NetworkProfile>;
  deleteProfile: (id: string) => Promise<void>;
  
  // Clear
  clearRouter: () => void;
  clearProfile: () => void;
}

export const useNetworkStore = create<NetworkState & NetworkActions>((set, get) => ({
  routers: [],
  router: null,
  routersLoading: false,
  profiles: [],
  profile: null,
  profilesLoading: false,
  loading: false, // Legacy, computed from routersLoading || profilesLoading
  error: null,

  fetchRouters: async () => {
    // Prevent concurrent calls for routers only
    const state = get();
    if (state.routersLoading) {
      return; // Already fetching routers, skip this call
    }
    
    set({ routersLoading: true, loading: true, error: null });
    try {
      const routers = await networkService.getRouters();
      const currentState = get();
      set({ 
        routers: routers || [], 
        routersLoading: false,
        loading: currentState.profilesLoading, // Keep loading true if profiles still loading
      });
    } catch (err) {
      const currentState = get();
      set({ 
        error: toApiError(err).message, 
        routersLoading: false,
        loading: currentState.profilesLoading, // Keep loading true if profiles still loading
        routers: [], // Ensure routers is always an array
      });
    }
  },

  fetchRouter: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const router = await networkService.getRouter(id);
      set({ router, loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  createRouter: async (data: CreateRouterRequest) => {
    set({ loading: true, error: null });
    try {
      const router = await networkService.createRouter(data);
      set((state) => ({
        routers: [...state.routers, router],
        loading: false,
      }));
      return router;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  updateRouter: async (id: string, data: UpdateRouterRequest) => {
    set({ loading: true, error: null });
    try {
      const router = await networkService.updateRouter(id, data);
      set((state) => ({
        routers: state.routers.map((r) => (r.id === id ? router : r)),
        router: state.router?.id === id ? router : state.router,
        loading: false,
      }));
      return router;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  deleteRouter: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await networkService.deleteRouter(id);
      set((state) => ({
        routers: state.routers.filter((r) => r.id !== id),
        router: state.router?.id === id ? null : state.router,
        loading: false,
      }));
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  testRouterConnection: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const result = await networkService.testRouterConnection(id);
      // Refetch router to get updated status
      await get().fetchRouter(id);
      // Also refresh routers list
      await get().fetchRouters();
      set({ loading: false });
      return result;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  disconnectRouter: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await networkService.disconnectRouter(id);
      // Refetch router to get updated status
      await get().fetchRouter(id);
      // Also refresh routers list
      await get().fetchRouters();
      set({ loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  toggleRemoteAccess: async (id: string, enabled: boolean) => {
    set({ loading: true, error: null });
    try {
      const updatedRouter = await networkService.toggleRemoteAccess(id, enabled);
      set((state) => ({
        routers: state.routers.map((r) => (r.id === id ? updatedRouter : r)),
        router: state.router?.id === id ? updatedRouter : state.router,
        loading: false,
      }));
      return updatedRouter;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  fetchProfiles: async () => {
    // Prevent concurrent calls for profiles only
    const state = get();
    if (state.profilesLoading) {
      return; // Already fetching profiles, skip this call
    }
    
    set({ profilesLoading: true, loading: true, error: null });
    try {
      const profiles = await networkService.getNetworkProfiles();
      const currentState = get();
      set({ 
        profiles: profiles || [], 
        profilesLoading: false,
        loading: currentState.routersLoading, // Keep loading true if routers still loading
      });
    } catch (err) {
      const currentState = get();
      set({ 
        error: toApiError(err).message, 
        profilesLoading: false,
        loading: currentState.routersLoading, // Keep loading true if routers still loading
        profiles: [], // Ensure profiles is always an array
      });
    }
  },

  fetchProfile: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const profile = await networkService.getNetworkProfile(id);
      set({ profile, loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  createProfile: async (data: CreateNetworkProfileRequest) => {
    set({ loading: true, error: null });
    try {
      const profile = await networkService.createNetworkProfile(data);
      set((state) => ({
        profiles: [...state.profiles, profile],
        loading: false,
      }));
      return profile;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  updateProfile: async (id: string, data: UpdateNetworkProfileRequest) => {
    set({ loading: true, error: null });
    try {
      const profile = await networkService.updateNetworkProfile(id, data);
      set((state) => ({
        profiles: state.profiles.map((p) => (p.id === id ? profile : p)),
        profile: state.profile?.id === id ? profile : state.profile,
        loading: false,
      }));
      return profile;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  deleteProfile: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await networkService.deleteNetworkProfile(id);
      set((state) => ({
        profiles: state.profiles.filter((p) => p.id !== id),
        profile: state.profile?.id === id ? null : state.profile,
        loading: false,
      }));
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  clearRouter: () => set({ router: null }),
  clearProfile: () => set({ profile: null }),
}));

