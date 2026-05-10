import { apiClient } from "./apiClient";

export interface MidtransConfig {
  merchant_id: string;
  client_key: string;
  server_key: string;
  is_production: boolean;
  enabled: boolean;
  customer_share_percent?: number;
}

export const integrationService = {
  async getMidtransConfig(): Promise<MidtransConfig> {
    const res = await apiClient.get<MidtransConfig>("/tenant/settings/midtrans");
    return res.data;
  },

  async updateMidtransConfig(config: MidtransConfig): Promise<any> {
    const res = await apiClient.patch("/tenant/settings/midtrans", config);
    return res.data;
  }
};
