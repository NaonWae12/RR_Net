import { create } from "zustand";
import { authService } from "../lib/api/authService";
import { setAccessToken, setTenantSlug as setApiTenantSlug, setRefreshTokenCallback } from "../lib/api/apiClient";
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
};

type AuthActions = {
  login: (payload: LoginRequest, tenantSlug?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setTenantSlug: (slug: string | null) => void;
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
};

const loadPersisted = (): Partial<AuthState> => {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
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

  hydrate: (data) => set((s) => ({ ...s, ...data })),

  setTenantSlug: (slug) => set({ tenantSlug: slug }),

  login: async (payload, tenantSlug) => {
    set({ isLoading: true, error: null });
    try {
      // Use provided tenantSlug directly, don't use cached value
      // For super admin, tenantSlug should be undefined/null
      // For tenant users, tenantSlug should be provided explicitly
      const slug = tenantSlug ?? undefined;
      const res: LoginResponse = await authService.login(payload, slug);
      
      // Update API client with token and tenant slug
      setAccessToken(res.access_token);
      setApiTenantSlug(slug ?? null);
      
      set({
        user: res.user,
        tenant: res.tenant ?? null,
        token: res.access_token,
        refreshToken: res.refresh_token,
        tenantSlug: res.tenant?.slug ?? slug ?? null,
        isLoading: false,
        error: null,
        isAuthenticated: true,
      });
      persistState(get());
    } catch (err: any) {
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
    });
    
    // Clear localStorage
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },

  refresh: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) {
      // No refresh token available - clear auth state silently
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
      setAccessToken(null);
      persistState(get());
      return;
    }
    try {
      const res = await authService.refresh(refreshToken);
      const newState = {
        user: res.user,
        token: res.access_token,
        refreshToken: res.refresh_token,
      };
      set(newState);
      setAccessToken(res.access_token);
      persistState(get());
    } catch (err) {
      // Refresh failed - clear auth state
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
      setAccessToken(null);
      persistState(get());
      // Don't throw - let the app continue without auth
      console.warn("Token refresh failed:", err);
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
  const snapshot = loadPersisted();
  
  // Set isAuthenticated based on token presence
  const hydratedData: Partial<AuthState> = {
    ...snapshot,
    isAuthenticated: !!snapshot.token,
    isLoading: false, // Ensure loading is false after hydrate
    isHydrated: true, // Mark as hydrated
  };
  
  useAuthStore.getState().hydrate(hydratedData);
  
  // Also set API client credentials from persisted state
  if (snapshot.token) {
    setAccessToken(snapshot.token);
  }
  if (snapshot.tenantSlug) {
    setApiTenantSlug(snapshot.tenantSlug);
  }
}

