import { apiClient } from "./apiClient";
import type {
  SuperAdminTenant,
  Plan,
  Addon,
  UpdateTenantRequest,
  CreatePlanRequest,
  UpdatePlanRequest,
  CreateAddonRequest,
  UpdateAddonRequest,
  TenantListResponse,
  PlanListResponse,
  AddonListResponse,
} from "./types";

export const superAdminService = {
  // ========== Tenants ==========
  async getTenants(): Promise<SuperAdminTenant[]> {
    console.log("[superAdminService] Requesting GET /superadmin/tenants");
    try {
      const response = await apiClient.get<TenantListResponse>("/superadmin/tenants");
      console.log("[superAdminService] Response received:", response);
      console.log("[superAdminService] Response data:", response.data);
      if (!response.data || !response.data.data) {
        console.warn("[superAdminService] Invalid response format:", response.data);
        return [];
      }
      return response.data.data;
    } catch (error) {
      console.error("[superAdminService] Error in getTenants:", error);
      throw error;
    }
  },

  async getTenant(id: string): Promise<SuperAdminTenant> {
    const response = await apiClient.get<SuperAdminTenant>(`/superadmin/tenants/${id}`);
    return response.data;
  },

  async updateTenant(id: string, data: UpdateTenantRequest): Promise<SuperAdminTenant> {
    const response = await apiClient.patch<SuperAdminTenant>(`/superadmin/tenants/${id}`, data);
    return response.data;
  },

  async suspendTenant(id: string): Promise<SuperAdminTenant> {
    const response = await apiClient.post<SuperAdminTenant>(`/superadmin/tenants/${id}/suspend`, {});
    return response.data;
  },

  async unsuspendTenant(id: string): Promise<SuperAdminTenant> {
    const response = await apiClient.post<SuperAdminTenant>(`/superadmin/tenants/${id}/unsuspend`, {});
    return response.data;
  },

  // ========== Plans ==========
  async getPlans(): Promise<Plan[]> {
    const response = await apiClient.get<{ plans: Plan[]; total: number }>("/plans");
    return response.data.plans || [];
  },

  async getPlan(id: string): Promise<Plan> {
    const response = await apiClient.get<Plan>(`/plans/${id}`);
    return response.data;
  },

  async createPlan(data: CreatePlanRequest): Promise<Plan> {
    const response = await apiClient.post<Plan>("/plans", data);
    return response.data;
  },

  async updatePlan(id: string, data: UpdatePlanRequest): Promise<Plan> {
    const response = await apiClient.patch<Plan>(`/plans/${id}`, data);
    return response.data;
  },

  async deletePlan(id: string): Promise<void> {
    await apiClient.delete(`/plans/${id}`);
  },

  async assignPlanToTenant(planId: string, tenantId: string): Promise<void> {
    await apiClient.post(`/superadmin/plans/${planId}/assign/${tenantId}`, {});
  },

  // ========== Addons ==========
  async getAddons(): Promise<Addon[]> {
    const response = await apiClient.get<{ addons: Addon[]; total: number }>("/addons");
    return response.data.addons || [];
  },

  async getAddon(id: string): Promise<Addon> {
    const response = await apiClient.get<Addon>(`/addons/${id}`);
    return response.data;
  },

  async createAddon(data: CreateAddonRequest): Promise<Addon> {
    const response = await apiClient.post<Addon>("/addons", data);
    return response.data;
  },

  async updateAddon(id: string, data: UpdateAddonRequest): Promise<Addon> {
    const response = await apiClient.patch<Addon>(`/addons/${id}`, data);
    return response.data;
  },

  async deleteAddon(id: string): Promise<void> {
    await apiClient.delete(`/addons/${id}`);
  },
};

