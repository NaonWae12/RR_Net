import apiClient from "./apiClient";

export type WALogSource = "single" | "campaign" | "system" | string;
export type WALogStatus = "queued" | "sent" | "failed" | string;

export type WAMessageLog = {
  id: string;
  tenant_id: string;
  source: WALogSource;
  campaign_id?: string | null;
  campaign_recipient_id?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  to_phone: string;
  message_text: string;
  template_id?: string | null;
  status: WALogStatus;
  gateway_message_id?: string | null;
  error?: string | null;
  created_at: string;
  sent_at?: string | null;
};

export type ListWALogsParams = {
  search?: string;
  status?: string;
  source?: string;
  campaign_id?: string;
  limit?: number;
  cursor?: string;
};

export const waLogService = {
  async list(params: ListWALogsParams = {}): Promise<{ data: WAMessageLog[]; next_cursor: string | null }> {
    const res = await apiClient.get("/wa-logs", { params });
    return res.data as { data: WAMessageLog[]; next_cursor: string | null };
  },
};

export default waLogService;


