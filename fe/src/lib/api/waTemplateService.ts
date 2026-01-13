import apiClient from "./apiClient";

export type WATemplate = {
  id: string;
  tenant_id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type CreateWATemplateRequest = {
  name: string;
  content: string;
};

export type UpdateWATemplateRequest = {
  name: string;
  content: string;
};

export const waTemplateService = {
  async list(): Promise<WATemplate[]> {
    const res = await apiClient.get("/wa-templates");
    return (res.data?.data ?? []) as WATemplate[];
  },

  async create(input: CreateWATemplateRequest): Promise<WATemplate> {
    const res = await apiClient.post("/wa-templates", input);
    return res.data as WATemplate;
  },

  async update(id: string, input: UpdateWATemplateRequest): Promise<WATemplate> {
    const res = await apiClient.put(`/wa-templates/${id}`, input);
    return res.data as WATemplate;
  },

  async remove(id: string): Promise<{ ok: boolean }> {
    const res = await apiClient.delete(`/wa-templates/${id}`);
    return res.data as { ok: boolean };
  },
};

export default waTemplateService;


