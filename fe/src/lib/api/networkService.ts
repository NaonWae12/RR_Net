import { apiClient } from "./apiClient";
import type {
  Router,
  NetworkProfile,
  RouterListResponse,
  NetworkProfileListResponse,
  CreateRouterRequest,
  UpdateRouterRequest,
  CreateNetworkProfileRequest,
  UpdateNetworkProfileRequest,
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
  ): Promise<{ ok: boolean; identity?: string; latency_ms?: number; error?: string }> {
    const response = await apiClient.post<{ ok: boolean; identity?: string; latency_ms?: number; error?: string }>(
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
    },
  ): Promise<{ ok: boolean; identity?: string; latency_ms?: number; error?: string }> {
    const response = await apiClient.post<{ ok: boolean; identity?: string; latency_ms?: number; error?: string }>(
      "/network/routers/test-config",
      data,
    );
    return response.data;
  },

  async deleteRouter(id: string): Promise<void> {
    await apiClient.delete(`/network/routers/${id}`);
  },

  async disconnectRouter(id: string): Promise<{ ok: boolean }> {
    const response = await apiClient.post<{ ok: boolean }>(`/network/routers/${id}/disconnect`);
    return response.data;
  },

  async toggleRemoteAccess(id: string, enabled: boolean): Promise<Router> {
    const response = await apiClient.post<Router>(`/network/routers/${id}/remote-access`, { enabled });
    return response.data;
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
};

