import { apiClient } from "./apiClient";
import type {
  Router,
  RouterStatus,
  RouterConnectivityMode,
  NetworkProfile,
  RouterListResponse,
  NetworkProfileListResponse,
  CreateRouterRequest,
  UpdateRouterRequest,
  CreateNetworkProfileRequest,
  UpdateNetworkProfileRequest,
  ProvisionRouterRequest,
  ProvisionResponse,
} from "./types";

export const networkService = {
  // ========== Routers ==========
  async getRouters(): Promise<Router[]> {
    const response = await apiClient.get<RouterListResponse>("/network/routers");
    return response.data.data;
  },

  async getRouter(id: string): Promise<Router> {
    const response = await apiClient.get<Router>(`/network/routers/${id}`);
    return response.data;
  },

  async createRouter(data: CreateRouterRequest): Promise<Router> {
    const response = await apiClient.post<Router>("/network/routers", data);
    return response.data;
  },

  async updateRouter(id: string, data: UpdateRouterRequest): Promise<Router> {
    const response = await apiClient.put<Router>(`/network/routers/${id}`, data);
    return response.data;
  },

  async testRouterConnection(
    id: string,
  ): Promise<{ ok: boolean; identity?: string; latency_ms?: number; error?: string; radius_installed?: boolean }> {
    const response = await apiClient.post<{ ok: boolean; identity?: string; latency_ms?: number; error?: string; radius_installed?: boolean }>(
      `/network/routers/${id}/test-connection`,
    );
    return response.data;
  },

  async testRouterConfig(
    data: {
      type: string;
      host: string;
      api_port: number;
      api_use_tls: boolean;
      username: string;
      password: string;
      router_id?: string;
    },
  ): Promise<{ ok: boolean; identity?: string; latency_ms?: number; error?: string; radius_installed?: boolean }> {
    const response = await apiClient.post<{ ok: boolean; identity?: string; latency_ms?: number; error?: string; radius_installed?: boolean }>(
      "/network/routers/test-config",
      data,
    );
    return response.data;
  },

  async deleteRouter(id: string, cleanupRemote: boolean = false): Promise<void> {
    await apiClient.delete(`/network/routers/${id}${cleanupRemote ? "?cleanup_remote=true" : ""}`);
  },

  async getDeletePreview(id: string): Promise<{ 
    preview: { 
      pppoe_count: number; 
      voucher_count: number; 
      pppoe_usernames: string[]; 
      voucher_codes: string[]; 
    }; 
    status: string;
  }> {
    const response = await apiClient.get<any>(`/network/routers/${id}/delete-preview`);
    return response.data;
  },

  async disconnectRouter(id: string): Promise<{ ok: boolean }> {
    const response = await apiClient.post<{ ok: boolean }>(`/network/routers/${id}/disconnect`);
    return response.data;
  },

  async getRouterLogs(id: string): Promise<{ data: any[]; total: number }> {
    const response = await apiClient.get<{ data: any[]; total: number }>(`/network/routers/${id}/logs`);
    return response.data;
  },

  async toggleRemoteAccess(id: string, enabled: boolean): Promise<Router> {
    const response = await apiClient.post<Router>(`/network/routers/${id}/remote-access`, { enabled });
    return response.data;
  },

  async provisionRouter(data: ProvisionRouterRequest): Promise<ProvisionResponse> {
    const response = await apiClient.post<ProvisionResponse>("/network/routers/provision", data);
    return response.data;
  },

  async setupRemoteUser(id: string, data: any): Promise<void> {
    await apiClient.post(`/network/routers/${id}/setup-remote-user`, data);
  },

  // ========== Network Profiles ==========
  async getNetworkProfiles(): Promise<NetworkProfile[]> {
    const response = await apiClient.get<NetworkProfileListResponse>("/network/profiles");
    return response.data?.data ?? [];
  },

  async getNetworkProfile(id: string): Promise<NetworkProfile> {
    const response = await apiClient.get<NetworkProfile>(`/network/profiles/${id}`);
    return response.data;
  },

  async createNetworkProfile(data: CreateNetworkProfileRequest): Promise<NetworkProfile> {
    const response = await apiClient.post<NetworkProfile>("/network/profiles", data);
    return response.data;
  },

  async updateNetworkProfile(id: string, data: UpdateNetworkProfileRequest): Promise<NetworkProfile> {
    const response = await apiClient.put<NetworkProfile>(`/network/profiles/${id}`, data);
    return response.data;
  },

  async deleteNetworkProfile(id: string): Promise<void> {
    await apiClient.delete(`/network/profiles/${id}`);
  },

  // ========== Isolir Management ==========
  async installIsolirFirewall(routerId: string, hotspotIP: string): Promise<{
    firewall_installed: boolean;
    router_id: string;
    router_name: string;
    rule_count: number;
    hotspot_ip?: string;
    has_nat: boolean;
    has_filter: boolean;
  }> {
    const response = await apiClient.post<any>(`/network/routers/${routerId}/isolir-install`, {
      hotspot_ip: hotspotIP,
    });
    return response.data;
  },

  async uninstallIsolirFirewall(routerId: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(`/network/routers/${routerId}/isolir-uninstall`);
    return response.data;
  },

  async getIsolirStatus(routerId: string): Promise<{
    firewall_installed: boolean;
    router_id: string;
    router_name: string;
    rule_count: number;
    hotspot_ip?: string;
    has_nat: boolean;
    has_filter: boolean;
  }> {
    const response = await apiClient.get<{
      firewall_installed: boolean;
      router_id: string;
      router_name: string;
      rule_count: number;
      hotspot_ip?: string;
      has_nat: boolean;
      has_filter: boolean;
    }>(`/network/routers/${routerId}/isolir-status`);
    return response.data;
  },

  async pushRadius(id: string): Promise<{ ok: boolean; message: string }> {
    const response = await apiClient.post<{ ok: boolean; message: string }>(`/network/routers/${id}/push-radius`);
    return response.data;
  },
};
