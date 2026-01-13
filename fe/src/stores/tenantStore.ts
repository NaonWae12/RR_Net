import { create } from "zustand";
import { tenantService } from "../lib/api/tenantService";
import type { Tenant } from "../lib/api/types";

type TenantState = {
  tenant: Tenant | null;
  slug: string | null;
  loading: boolean;
  error: string | null;
  resolved: boolean;
};

type TenantActions = {
  resolveTenant: (slug?: string | null) => Promise<void>;
  setSlug: (slug: string | null) => void;
  setTenant: (tenant: Tenant, slug: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "rrnet_tenant_slug";

const loadSlug = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
};

const persistSlug = (slug: string | null) => {
  if (typeof window === "undefined") return;
  if (slug) window.localStorage.setItem(STORAGE_KEY, slug);
  else window.localStorage.removeItem(STORAGE_KEY);
};

export const useTenantStore = create<TenantState & TenantActions>((set, get) => ({
  tenant: null,
  slug: loadSlug(),
  loading: false,
  error: null,
  resolved: false,

  setSlug: (slug) => {
    persistSlug(slug);
    set({ slug });
  },

  setTenant: (tenant, slug) => {
    persistSlug(slug);
    set({ tenant, slug, resolved: true, loading: false, error: null });
  },

  clear: () => {
    persistSlug(null);
    set({ tenant: null, slug: null, loading: false, error: null, resolved: false });
  },

  resolveTenant: async (slugOptional) => {
    const slug = slugOptional ?? get().slug;
    if (!slug) {
      set({ tenant: null, resolved: true, loading: false, error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const tenant = await tenantService.getCurrentTenant(slug);
      set({ tenant, slug, loading: false, resolved: true, error: null });
      persistSlug(slug);
    } catch (err: any) {
      set({
        tenant: null,
        loading: false,
        resolved: true,
        error: err?.response?.data?.error ?? "Failed to resolve tenant",
      });
    }
  },
}));


