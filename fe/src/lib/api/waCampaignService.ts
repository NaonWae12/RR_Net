import apiClient from "./apiClient";

export type WACampaignStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | string;
export type WACampaignRecipientStatus = "pending" | "sent" | "failed" | string;

export type WACampaign = {
  id: string;
  tenant_id: string;
  group_id?: string | null;
  name: string;
  message: string;
  status: WACampaignStatus;
  total: number;
  sent: number;
  failed: number;
  created_at: string;
  updated_at: string;
};

export type WACampaignRecipient = {
  id: string;
  campaign_id: string;
  client_id?: string | null;
  client_name?: string | null;
  phone: string;
  status: WACampaignRecipientStatus;
  error?: string | null;
  message_id?: string | null;
  sent_at?: string | null;
  created_at: string;
};

export type CreateWACampaignRequest = {
  name: string;
  message: string;
  group_id: string;
};

export const waCampaignService = {
  async list(): Promise<WACampaign[]> {
    const res = await apiClient.get("/wa-campaigns");
    return (res.data?.data ?? []) as WACampaign[];
  },

  async create(input: CreateWACampaignRequest): Promise<WACampaign> {
    const res = await apiClient.post("/wa-campaigns", input);
    return res.data as WACampaign;
  },

  async detail(
    id: string
  ): Promise<{ campaign: WACampaign; recipients: WACampaignRecipient[] }> {
    const res = await apiClient.get(`/wa-campaigns/${id}`);
    return res.data as {
      campaign: WACampaign;
      recipients: WACampaignRecipient[];
    };
  },

  async retryFailed(id: string): Promise<{ retried: number }> {
    const res = await apiClient.post(`/wa-campaigns/${id}/retry-failed`, {});
    return res.data as { retried: number };
  },
};

export default waCampaignService;
