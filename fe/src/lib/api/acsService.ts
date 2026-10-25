import { apiClient } from "./apiClient";
import { ONTDevice } from "./types";

export interface SetWiFiPayload {
  ssid: string;
  password: string;
}

export interface RegisterDevicePayload {
  device_id?: string;
  serial_number: string;
  label?: string;
  client_id?: string;
}

export type ClaimDevicePayload = RegisterDevicePayload;

export interface UpdateMetadataPayload {
  label?: string;
  client_id?: string | null;
}

export const acsService = {
  // List ONT devices belonging to current tenant
  async listDevices(): Promise<{ data: ONTDevice[]; total: number }> {
    const res = await apiClient.get<{ data: ONTDevice[]; total: number }>("/acs/devices");
    return res.data;
  },

  // Register device by SN to current tenant (Method 1)
  async register(payload: RegisterDevicePayload): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>("/acs/devices/register", payload);
    return res.data;
  },

  // Alias for backward compatibility
  async claim(payload: RegisterDevicePayload): Promise<{ message: string }> {
    return this.register(payload);
  },

  // Update label or customer linkage
  async updateMetadata(id: string, payload: UpdateMetadataPayload): Promise<{ message: string }> {
    const res = await apiClient.put<{ message: string }>(`/acs/devices/${encodeURIComponent(id)}/metadata`, payload);
    return res.data;
  },

  // Get single device details
  async getDevice(id: string): Promise<ONTDevice> {
    const res = await apiClient.get<{ data: ONTDevice }>(`/acs/devices/${encodeURIComponent(id)}`);
    return res.data.data;
  },

  // Trigger ONT reboot
  async reboot(id: string): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>(`/acs/devices/${encodeURIComponent(id)}/reboot`, {});
    return res.data;
  },

  // Update WiFi SSID & Password on ONT
  async setWiFi(id: string, payload: SetWiFiPayload): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>(`/acs/devices/${encodeURIComponent(id)}/wifi`, payload);
    return res.data;
  },

  // Refresh ONT parameters via TR-069
  async refresh(id: string): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>(`/acs/devices/${encodeURIComponent(id)}/refresh`, {});
    return res.data;
  },
};
