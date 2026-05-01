import { create } from "zustand";
import { authService } from "@/lib/api/authService";
import { setAccessToken, setTenantSlug as setApiTenantSlug, setRefreshTokenCallback } from "@/lib/api/apiClient";
import { clearRoleContext } from "@/lib/utils/roleContext";
import { useDashboardStore } from "./dashboardStore";
import { useBillingStore } from "./billingStore";
import { useTechnicianStore } from "./technicianStore";
import type { LoginRequest, LoginResponse, Tenant, User } from "../lib/api/types";

type AuthState = {
  user: User | null;
  tenant: Tenant | null;
  tenantSlug: string | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  ready: boolean; // True only after: hydration complete + token synced to apiClient + refresh (if any) complete
};

type AuthActions = {
  login: (payload: LoginRequest, tenantSlug?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setTenantSlug: (slug: string | null) => void;
  setAuth: (user: User, tenant: Tenant | null, token: string, refreshToken: string) => void;
  refreshTenant: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hydrate: (data: Partial<AuthState>) => void;
};

const STORAGE_KEY = "rrnet_auth_state";

const persistState = (state: AuthState) => {
  if (typeof window === "undefined") return;
  const snapshot: Partial<AuthState> = {
    token: state.token,
    refreshToken: state.refreshToken,
    tenantSlug: state.tenantSlug,
    tenant: state.tenant,
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
};

const loadPersisted = (): Partial<AuthState> => {
  if (typeof window === "undefined") return {};
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  tenant: null,
  tenantSlug: null,
  token: null,
  refreshToken: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,
  isHydrated: false,
  ready: false,

  hydrate: (data) => {
    const newState = { ...data };
    // console.log('[AUTH] hydrate called:', {
    //   isAuthenticated: newState.isAuthenticated,
    //   token: newState.token ? `${newState.token.substring(0, 20)}...` : null,
    //   hasToken: !!newState.token,
    // });
    set((s) => ({ ...s, ...newState }));
    const finalState = useAuthStore.getState();
    // console.log('[AUTH] after hydrate - isAuthenticated:', finalState.isAuthenticated, 'token:', finalState.token ? `${finalState.token.substring(0, 20)}...` : null);
  },

  setTenantSlug: (slug) => set({ tenantSlug: slug }),

  login: async (payload, tenantSlug) => {
    set({ isLoading: true, error: null });
    
    // Safety timeout
    const timeoutId = setTimeout(() => {
      set({ isLoading: false });
    }, 15000);
    try {
      // Use provided tenantSlug directly, don't use cached value
      // For super admin, tenantSlug should be undefined/null
      // For tenant users, tenantSlug should be provided explicitly
      const slug = tenantSlug ?? undefined;
      const res: LoginResponse = await authService.login(payload, slug);
      
      const effectiveSlug = res.tenant?.slug ?? slug ?? null;

      // Update API client with token and the actual tenant slug from response
      setAccessToken(res.access_token);
      setApiTenantSlug(effectiveSlug);
      
      const newState = {
        user: res.user,
        tenant: res.tenant ?? null,
        token: res.access_token,
        refreshToken: res.refresh_token,
        tenantSlug: res.tenant?.slug ?? slug ?? null,
        isLoading: false,
        error: null,
        isAuthenticated: true,
        ready: true, // Login complete, auth is ready
      };
      // console.log('[AUTH] login success - setting state:', {
      //   isAuthenticated: newState.isAuthenticated,
      //   token: newState.token ? `${newState.token.substring(0, 20)}...` : null,
      //   hasToken: !!newState.token,
      // });
      set(newState);
      persistState(get());
      clearTimeout(timeoutId);
    } catch (err: any) {
      clearTimeout(timeoutId);
      set({ error: err?.response?.data?.error ?? "Login failed", isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // ignore - logout even if API call fails
    }
    
    // Clear other store states to prevent stale data between accounts
    useDashboardStore.getState().reset();
    useBillingStore.getState().reset();
    useTechnicianStore.getState().reset();

    // Clear API client
    setAccessToken(null);
    setApiTenantSlug(null);
    
    // Clear state
    set({
      user: null,
      tenant: null,
      token: null,
      refreshToken: null,
      tenantSlug: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
      isHydrated: true, // Keep hydrated flag true after logout
      ready: true, // After logout, auth state is "ready" (no auth, but state is clear)
    });
    
    // Clear sessionStorage
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
      // Clear role context on logout
      clearRoleContext();
    }
  },

  refresh: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) {
      // No refresh token available - clear auth state silently
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false, ready: true });
      setAccessToken(null);
      persistState(get());
      return;
    }
    set({ isLoading: true });
    
    // Safety timeout
    const timeoutId = setTimeout(() => {
      set({ isLoading: false, ready: true });
    }, 15000);

    try {
      const res = await authService.refresh(refreshToken);
      const newState = {
        user: res.user,
        token: res.access_token,
        refreshToken: res.refresh_token,
        isAuthenticated: true,
        ready: true, // Refresh complete, auth is ready
      };
      // console.log('[AUTH] refresh success - setting state:', {
      //   isAuthenticated: !!newState.token,
      //   token: newState.token ? `${newState.token.substring(0, 20)}...` : null,
      // });
      set(newState);
      setAccessToken(res.access_token);
      persistState(get());
      clearTimeout(timeoutId);
      set({ isLoading: false });
    } catch (err) {
      clearTimeout(timeoutId);
      // Refresh failed - clear auth state
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false, ready: true, isLoading: false });
      setAccessToken(null);
      persistState(get());
      // Don't throw - let the app continue without auth
      console.warn("Token refresh failed:", err);
    }
  },

  setAuth: (user, tenant, token, refreshToken) => {
    // Update API client with token and tenant slug
    setAccessToken(token);
    const slug = tenant?.slug || null;
    setApiTenantSlug(slug);
    
    const newState = {
      user,
      tenant,
      token,
      refreshToken,
      tenantSlug: slug,
      isAuthenticated: true,
      ready: true,
      isLoading: false,
      error: null,
    };
    
    set(newState);
    persistState(get());
  },

  refreshTenant: async () => {
    try {
      const res = await authService.me();
      set({ tenant: res.tenant ?? null });
      persistState(get());
    } catch (err) {
      console.error("Failed to refresh tenant info:", err);
    }
  },

  refreshUser: async () => {
    try {
      const res = await authService.me();
      set({ user: res.user });
      persistState(get());
    } catch (err) {
      console.error("Failed to refresh user info:", err);
    }
  },
}));

// Set up refresh token callback for apiClient
if (typeof window !== "undefined") {
  setRefreshTokenCallback(
    () => useAuthStore.getState().refreshToken,
    (token: string, refreshToken: string) => {
      const state = useAuthStore.getState();
      setAccessToken(token);
      state.hydrate({ token, refreshToken });
      persistState(useAuthStore.getState());
    },
    async () => {
      await useAuthStore.getState().refresh();
      const state = useAuthStore.getState();
      if (state.token) {
        setAccessToken(state.token);
      }
    }
  );
}

  // Hydrate once on module load (client-side only)
if (typeof window !== "undefined") {
  // console.log('[AUTH] Module load - starting hydration');
  const snapshot = loadPersisted();
  // console.log('[AUTH] Loaded from sessionStorage:', {
  //   hasToken: !!snapshot.token,
  //   token: snapshot.token ? `${snapshot.token.substring(0, 20)}...` : null,
  //   isAuthenticated: snapshot.isAuthenticated,
  // });
  
      // Set isAuthenticated based on token presence
      const hydratedData: Partial<AuthState> = {
        ...snapshot,
        isAuthenticated: !!snapshot.token,
        isLoading: false, // Ensure loading is false after hydrate
        isHydrated: true, // Mark as hydrated
        ready: false, // Not ready yet - will be set after token sync and refresh check
      };
      
      // console.log('[AUTH] Calling hydrate with:', {
      //   isAuthenticated: hydratedData.isAuthenticated,
      //   token: hydratedData.token ? `${hydratedData.token.substring(0, 20)}...` : null,
      // });
      
      useAuthStore.getState().hydrate(hydratedData);
      
      // Also set API client credentials from persisted state
      if (snapshot.token) {
        // console.log('[AUTH] Setting accessToken in apiClient:', snapshot.token.substring(0, 20) + '...');
        setAccessToken(snapshot.token);
      }
      if (snapshot.tenantSlug) {
        setApiTenantSlug(snapshot.tenantSlug);
      }
      
      // Check if we need to refresh token
      // If we have a refreshToken but no token, AuthProvider will trigger refresh
      // Otherwise, if we have token, mark as ready immediately (token sync already done above)
      const needsRefresh = snapshot.refreshToken && !snapshot.token;
      
      // If no refresh needed (we have token or no refreshToken), mark as ready immediately
      // Token is already synced to apiClient above, so we're ready
      if (!needsRefresh) {
        useAuthStore.getState().hydrate({ ready: true });
      }
      // If refresh is needed, AuthProvider will trigger it
      // ready will be set to true in refresh() method after refresh completes
      
      const finalState = useAuthStore.getState();
      // console.log('[AUTH] Hydration complete:', {
      //   isAuthenticated: finalState.isAuthenticated,
      //   token: finalState.token ? `${finalState.token.substring(0, 20)}...` : null,
      //   isHydrated: finalState.isHydrated,
      //   ready: finalState.ready,
      // });
}

