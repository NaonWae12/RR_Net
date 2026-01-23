import { apiClient } from "./apiClient";

export interface PPPoESecret {
  id: string;
  tenant_id: string;
  client_id: string;
  router_id: string;
  profile_id: string;
  username: string;
  service?: string;
  caller_id?: string;
  remote_address?: string;
  local_address?: string;
  comment?: string;
  is_disabled: boolean;
  last_connected_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivePPPoEConnection {
  id: string;
  username: string;
  service: string;
  caller_id: string;
  address: string;
  uptime: string;
  bytes_in: number;
  bytes_out: number;
  packets_in: number;
  packets_out: number;
  status: string;
  connected_at: string;
}

export interface CreatePPPoESecretRequest {
  client_id: string;
  router_id: string;
  profile_id: string;
  username: string;
  password: string;
  service?: string;
  caller_id?: string;
  remote_address?: string;
  local_address?: string;
  comment?: string;
}

export interface UpdatePPPoESecretRequest {
  router_id?: string;
  profile_id?: string;
  username?: string;
  password?: string;
  service?: string;
  caller_id?: string;
  remote_address?: string;
  local_address?: string;
  comment?: string;
}

export const pppoeService = {
  async listSecrets(params?: {
    router_id?: string;
    client_id?: string;
    disabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: PPPoESecret[]; total: number }> {
    const res = await apiClient.get<{ data: PPPoESecret[]; total: number }>("/pppoe/secrets", { params });
    return res.data;
  },

  async getSecret(id: string): Promise<PPPoESecret> {
    const res = await apiClient.get<PPPoESecret>(`/pppoe/secrets/${id}`);
    return res.data;
  },

  async createSecret(req: CreatePPPoESecretRequest): Promise<PPPoESecret> {
    const res = await apiClient.post<PPPoESecret>("/pppoe/secrets", req);
    return res.data;
  },

  async updateSecret(id: string, req: UpdatePPPoESecretRequest): Promise<PPPoESecret> {
    const res = await apiClient.put<PPPoESecret>(`/pppoe/secrets/${id}`, req);
    return res.data;
  },

  async deleteSecret(id: string): Promise<void> {
    await apiClient.delete(`/pppoe/secrets/${id}`);
  },

  async toggleStatus(id: string): Promise<PPPoESecret> {
    const res = await apiClient.post<PPPoESecret>(`/pppoe/secrets/${id}/toggle-status`);
    return res.data;
  },

  async syncToRouter(id: string): Promise<void> {
    await apiClient.post(`/pppoe/secrets/${id}/sync`);
  },

  async listActiveConnections(routerId: string): Promise<{ data: ActivePPPoEConnection[] }> {
    const res = await apiClient.get<{ data: ActivePPPoEConnection[] }>("/pppoe/active", {
      params: { router_id: routerId },
    });
    return res.data;
  },

  async disconnectSession(sessionId: string, routerId: string): Promise<void> {
    await apiClient.post(`/pppoe/active/${sessionId}/disconnect`, null, {
      params: { router_id: routerId },
    });
  },
};

