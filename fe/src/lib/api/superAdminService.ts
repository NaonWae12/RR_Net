import { apiClient } from "./apiClient";
import type {
  SuperAdminTenant,
  Plan,
  Addon,
  UpdateTenantRequest,
  CreateTenantRequest,
  CreatePlanRequest,
  UpdatePlanRequest,
  CreateAddonRequest,
  UpdateAddonRequest,
  TenantListResponse,
  PlanListResponse,
  AddonListResponse,
  LandingPageSEO,
  LandingPagePricing,
  SiteSetting,
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

  async createTenant(data: CreateTenantRequest): Promise<SuperAdminTenant> {
    const response = await apiClient.post<SuperAdminTenant>("/superadmin/tenants", data);
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

  async approveTenant(id: string): Promise<SuperAdminTenant> {
    const response = await apiClient.patch<SuperAdminTenant>(`/superadmin/tenants/${id}/approve`);
    return response.data;
  },

  async rejectTenant(id: string, reason: string): Promise<SuperAdminTenant> {
    const response = await apiClient.patch<SuperAdminTenant>(`/superadmin/tenants/${id}/reject`, { reason });
    return response.data;
  },

  async deleteTenant(id: string): Promise<void> {
    await apiClient.delete(`/superadmin/tenants/${id}`);
  },

  // ========== Plans ==========
  async getPlans(): Promise<Plan[]> {
    console.log("[superAdminService] Requesting GET /superadmin/plans");
    try {
      const response = await apiClient.get<any>("/superadmin/plans");
      console.log("[superAdminService] Plans response full data:", response.data);
      
      // SuperAdminHandler returns { data: [], total: 0 }
      const plans = response.data.data;
      
      if (!plans) {
        console.warn("[superAdminService] No data found in response:", response.data);
        return [];
      }
      
      return plans;
    } catch (error) {
      console.error("[superAdminService] Error in getPlans:", error);
      throw error;
    }
  },

  async getPlan(id: string): Promise<Plan> {
    const response = await apiClient.get<Plan>(`/superadmin/plans/${id}`);
    return response.data;
  },

  async createPlan(data: CreatePlanRequest): Promise<Plan> {
    const response = await apiClient.post<Plan>("/superadmin/plans", data);
    return response.data;
  },

  async updatePlan(id: string, data: UpdatePlanRequest): Promise<Plan> {
    const response = await apiClient.patch<Plan>(`/superadmin/plans/${id}`, data);
    return response.data;
  },

  async deletePlan(id: string): Promise<void> {
    await apiClient.delete(`/superadmin/plans/${id}`);
  },

  async assignPlanToTenant(planId: string, tenantId: string): Promise<void> {
    // Correct endpoint based on router.go:1318
    await apiClient.post(`/superadmin/tenants/${tenantId}/plan`, { plan_id: planId });
  },

  // ========== Addons ==========
  async getAddons(): Promise<Addon[]> {
    console.log("[superAdminService] Requesting GET /superadmin/addons");
    try {
      const response = await apiClient.get<any>("/superadmin/addons");
      console.log("[superAdminService] Addons response:", response.data);
      const addons = response.data.data;
      return addons || [];
    } catch (error) {
      console.error("[superAdminService] Error in getAddons:", error);
      throw error;
    }
  },

  async getAddon(id: string): Promise<Addon> {
    const response = await apiClient.get<Addon>(`/superadmin/addons/${id}`);
    return response.data;
  },

  async createAddon(data: CreateAddonRequest): Promise<Addon> {
    const response = await apiClient.post<Addon>("/superadmin/addons", data);
    return response.data;
  },

  async updateAddon(id: string, data: UpdateAddonRequest): Promise<Addon> {
    const response = await apiClient.patch<Addon>(`/superadmin/addons/${id}`, data);
    return response.data;
  },

  async deleteAddon(id: string): Promise<void> {
    await apiClient.delete(`/superadmin/addons/${id}`);
  },

  // ========== Site Settings ==========
  async getSEO(): Promise<LandingPageSEO> {
    const response = await apiClient.get<LandingPageSEO>("/superadmin/site-settings/seo");
    return response.data;
  },

  async updateSEO(data: LandingPageSEO): Promise<LandingPageSEO> {
    const response = await apiClient.post<LandingPageSEO>("/superadmin/site-settings/seo", data);
    return response.data;
  },

  async getPricingConfig(): Promise<LandingPagePricing> {
    const response = await apiClient.get<LandingPagePricing>("/superadmin/site-settings/pricing");
    return response.data;
  },

  async updatePricingConfig(data: LandingPagePricing): Promise<LandingPagePricing> {
    const response = await apiClient.post<LandingPagePricing>("/superadmin/site-settings/pricing", data);
    return response.data;
  },

  // ========== WhatsApp (Platform) ==========
  async getWhatsAppStatus(): Promise<any> {
    const response = await apiClient.get("/superadmin/whatsapp/status");
    return response.data;
  },

  async connectWhatsApp(): Promise<any> {
    const response = await apiClient.post("/superadmin/whatsapp/connect", {});
    return response.data;
  },

  async getWhatsAppQR(): Promise<any> {
    const response = await apiClient.get("/superadmin/whatsapp/qr");
    return response.data;
  },

  // ========== Network Monitoring ==========
  async getNetworkStats(): Promise<any> {
    const response = await apiClient.get("/superadmin/network/stats");
    return response.data;
  },

  // ========== Router Actions ==========
  async decommissionRouter(routerId: string): Promise<void> {
    await apiClient.post(`/superadmin/routers/${routerId}/decommission`, {});
  },
};

