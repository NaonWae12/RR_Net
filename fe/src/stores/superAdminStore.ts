import { create } from "zustand";
import { superAdminService } from "@/lib/api/superAdminService";
import {
  SuperAdminTenant,
  Plan,
  Addon,
  UpdateTenantRequest,
  CreateTenantRequest,
  CreatePlanRequest,
  UpdatePlanRequest,
  CreateAddonRequest,
  UpdateAddonRequest,
  LandingPageSEO,
  LandingPagePricing,
} from "@/lib/api/types";
import { toApiError } from "@/lib/utils/errors";

interface SuperAdminState {
  // Tenants
  tenants: SuperAdminTenant[];
  tenant: SuperAdminTenant | null;

  // Plans
  plans: Plan[];
  plan: Plan | null;

  // Addons
  addons: Addon[];
  addon: Addon | null;

  // UI State
  loading: boolean; // Legacy global loading
  tenantsLoading: boolean;
  plansLoading: boolean;
  addonsLoading: boolean;
  error: string | null;

  // Site Settings
  seo: LandingPageSEO | null;
  pricingConfig: LandingPagePricing | null;
}

interface SuperAdminActions {
  // Tenant actions
  fetchTenants: () => Promise<void>;
  fetchTenant: (id: string) => Promise<void>;
  createTenant: (data: CreateTenantRequest) => Promise<SuperAdminTenant>;
  updateTenant: (id: string, data: UpdateTenantRequest) => Promise<SuperAdminTenant>;
  suspendTenant: (id: string) => Promise<SuperAdminTenant>;
  unsuspendTenant: (id: string) => Promise<SuperAdminTenant>;
  approveTenant: (id: string) => Promise<SuperAdminTenant>;
  rejectTenant: (id: string, reason: string) => Promise<SuperAdminTenant>;
  deleteTenant: (id: string) => Promise<void>;

  // Plan actions
  fetchPlans: () => Promise<void>;
  fetchPlan: (id: string) => Promise<void>;
  createPlan: (data: CreatePlanRequest) => Promise<Plan>;
  updatePlan: (id: string, data: UpdatePlanRequest) => Promise<Plan>;
  deletePlan: (id: string) => Promise<void>;
  assignPlanToTenant: (planId: string, tenantId: string) => Promise<void>;

  // Addon actions
  fetchAddons: () => Promise<void>;
  fetchAddon: (id: string) => Promise<void>;
  createAddon: (data: CreateAddonRequest) => Promise<Addon>;
  updateAddon: (id: string, data: UpdateAddonRequest) => Promise<Addon>;
  deleteAddon: (id: string) => Promise<void>;

  // Site Setting actions
  fetchSEO: () => Promise<void>;
  updateSEO: (data: LandingPageSEO) => Promise<void>;
  fetchPricingConfig: () => Promise<void>;
  updatePricingConfig: (data: LandingPagePricing) => Promise<void>;

  // Router actions
  decommissionRouter: (routerId: string) => Promise<void>;

  // Clear
  clearTenant: () => void;
  clearPlan: () => void;
  clearAddon: () => void;
}

export const useSuperAdminStore = create<SuperAdminState & SuperAdminActions>(
  (set, get) => ({
    tenants: [],
    tenant: null,
    plans: [],
    plan: null,
    addons: [],
    addon: null,
    loading: false,
    tenantsLoading: false,
    plansLoading: false,
    addonsLoading: false,
    error: null,
    seo: null,
    pricingConfig: null,

    fetchTenants: async () => {
      const state = get();
      if (state.tenantsLoading) return;
      
      set({ tenantsLoading: true, loading: true, error: null });
      try {
        console.log("[superAdminStore] Fetching tenants...");
        const tenants = await superAdminService.getTenants();
        console.log("[superAdminStore] Tenants fetched:", tenants);
        set({ tenants, tenantsLoading: false, loading: false });
      } catch (err) {
        console.error("[superAdminStore] Error fetching tenants:", err);
        set({ error: toApiError(err).message, tenantsLoading: false, loading: false });
      }
    },

    fetchTenant: async (id: string) => {
      set({ loading: true, error: null });
      try {
        const tenant = await superAdminService.getTenant(id);
        set({ tenant, loading: false });
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    createTenant: async (data: CreateTenantRequest) => {
      set({ loading: true, error: null });
      try {
        const tenant = await superAdminService.createTenant(data);
        set((state) => ({
          tenants: [tenant, ...state.tenants],
          loading: false,
        }));
        return tenant;
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    updateTenant: async (id: string, data: UpdateTenantRequest) => {
      set({ loading: true, error: null });
      try {
        const tenant = await superAdminService.updateTenant(id, data);
        set((state) => ({
          tenants: state.tenants.map((t) => (t.id === id ? tenant : t)),
          tenant: state.tenant?.id === id ? tenant : state.tenant,
          loading: false,
        }));
        return tenant;
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    suspendTenant: async (id: string) => {
      set({ loading: true, error: null });
      try {
        const tenant = await superAdminService.suspendTenant(id);
        set((state) => ({
          tenants: state.tenants.map((t) => (t.id === id ? tenant : t)),
          tenant: state.tenant?.id === id ? tenant : state.tenant,
          loading: false,
        }));
        return tenant;
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    unsuspendTenant: async (id: string) => {
      set({ loading: true, error: null });
      try {
        const tenant = await superAdminService.unsuspendTenant(id);
        set((state) => ({
          tenants: state.tenants.map((t) => (t.id === id ? tenant : t)),
          tenant: state.tenant?.id === id ? tenant : state.tenant,
          loading: false,
        }));
        return tenant;
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    approveTenant: async (id: string) => {
      set({ loading: true, error: null });
      try {
        const tenant = await superAdminService.approveTenant(id);
        set((state) => ({
          tenants: state.tenants.map((t) => (t.id === id ? tenant : t)),
          tenant: state.tenant?.id === id ? tenant : state.tenant,
          loading: false,
        }));
        return tenant;
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    rejectTenant: async (id: string, reason: string) => {
      set({ loading: true, error: null });
      try {
        const tenant = await superAdminService.rejectTenant(id, reason);
        set((state) => ({
          tenants: state.tenants.map((t) => (t.id === id ? tenant : t)),
          tenant: state.tenant?.id === id ? tenant : state.tenant,
          loading: false,
        }));
        return tenant;
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    deleteTenant: async (id: string) => {
      set({ loading: true, error: null });
      try {
        await superAdminService.deleteTenant(id);
        set((state) => ({
          tenants: state.tenants.filter((t) => t.id !== id),
          tenant: state.tenant?.id === id ? null : state.tenant,
          loading: false,
        }));
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    fetchPlans: async () => {
      const state = get();
      if (state.plansLoading) return;
      
      set({ plansLoading: true, loading: true, error: null });
      try {
        const plans = await superAdminService.getPlans();
        set({ plans, plansLoading: false, loading: false });
      } catch (err) {
        set({ error: toApiError(err).message, plansLoading: false, loading: false });
      }
    },

    fetchPlan: async (id: string) => {
      set({ loading: true, error: null });
      try {
        const plan = await superAdminService.getPlan(id);
        set({ plan, loading: false });
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    createPlan: async (data: CreatePlanRequest) => {
      set({ loading: true, error: null });
      try {
        const plan = await superAdminService.createPlan(data);
        set((state) => ({
          plans: [...state.plans, plan],
          loading: false,
        }));
        return plan;
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    updatePlan: async (id: string, data: UpdatePlanRequest) => {
      set({ loading: true, error: null });
      try {
        const plan = await superAdminService.updatePlan(id, data);
        set((state) => ({
          plans: state.plans.map((p) => (p.id === id ? plan : p)),
          plan: state.plan?.id === id ? plan : state.plan,
          loading: false,
        }));
        return plan;
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    deletePlan: async (id: string) => {
      set({ loading: true, error: null });
      try {
        await superAdminService.deletePlan(id);
        set((state) => ({
          plans: state.plans.filter((p) => p.id !== id),
          plan: state.plan?.id === id ? null : state.plan,
          loading: false,
        }));
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    assignPlanToTenant: async (planId: string, tenantId: string) => {
      set({ loading: true, error: null });
      try {
        await superAdminService.assignPlanToTenant(planId, tenantId);
        set({ loading: false });
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    fetchAddons: async () => {
      const state = get();
      if (state.addonsLoading) return;
      
      set({ addonsLoading: true, loading: true, error: null });
      try {
        const addons = await superAdminService.getAddons();
        set({ addons, addonsLoading: false, loading: false });
      } catch (err) {
        set({ error: toApiError(err).message, addonsLoading: false, loading: false });
      }
    },

    fetchAddon: async (id: string) => {
      set({ loading: true, error: null });
      try {
        const addon = await superAdminService.getAddon(id);
        set({ addon, loading: false });
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    createAddon: async (data: CreateAddonRequest) => {
      set({ loading: true, error: null });
      try {
        const addon = await superAdminService.createAddon(data);
        set((state) => ({
          addons: [...state.addons, addon],
          loading: false,
        }));
        return addon;
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    updateAddon: async (id: string, data: UpdateAddonRequest) => {
      set({ loading: true, error: null });
      try {
        const addon = await superAdminService.updateAddon(id, data);
        set((state) => ({
          addons: state.addons.map((a) => (a.id === id ? addon : a)),
          addon: state.addon?.id === id ? addon : state.addon,
          loading: false,
        }));
        return addon;
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    deleteAddon: async (id: string) => {
      set({ loading: true, error: null });
      try {
        await superAdminService.deleteAddon(id);
        set((state) => ({
          addons: state.addons.filter((a) => a.id !== id),
          addon: state.addon?.id === id ? null : state.addon,
          loading: false,
        }));
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    clearTenant: () => set({ tenant: null }),
    clearPlan: () => set({ plan: null }),
    clearAddon: () => set({ addon: null }),

    fetchSEO: async () => {
      set({ loading: true, error: null });
      try {
        const seo = await superAdminService.getSEO();
        set({ seo, loading: false });
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
      }
    },

    updateSEO: async (data: LandingPageSEO) => {
      set({ loading: true, error: null });
      try {
        const seo = await superAdminService.updateSEO(data);
        set({ seo, loading: false });
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    fetchPricingConfig: async () => {
      set({ loading: true, error: null });
      try {
        const pricingConfig = await superAdminService.getPricingConfig();
        set({ pricingConfig, loading: false });
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
      }
    },

    updatePricingConfig: async (data: LandingPagePricing) => {
      set({ loading: true, error: null });
      try {
        const pricingConfig = await superAdminService.updatePricingConfig(data);
        set({ pricingConfig, loading: false });
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },

    decommissionRouter: async (routerId: string) => {
      set({ loading: true, error: null });
      try {
        await superAdminService.decommissionRouter(routerId);
        set({ loading: false });
      } catch (err) {
        set({ error: toApiError(err).message, loading: false });
        throw err;
      }
    },
  })
);
