import { apiClient } from "./apiClient";
import { ONTDevice } from "./types";

export interface SetWiFiPayload {
  ssid: string;
  password: string;
}

export const acsService = {
  // List all ONT devices
  async listDevices(): Promise<{ data: ONTDevice[]; total: number }> {
    const res = await apiClient.get<{ data: ONTDevice[]; total: number }>("/acs/devices");
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
