import apiClient from "./apiClient";

export type PlatformDiscountType = "percent" | "nominal";

export interface PlatformDiscount {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: PlatformDiscountType;
  value: number;
  min_purchase: number;
  max_discount?: number;
  usage_limit?: number;
  used_count: number;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePlatformDiscountRequest {
  code: string;
  name: string;
  description?: string;
  type: PlatformDiscountType;
  value: number;
  min_purchase: number;
  max_discount?: number;
  usage_limit?: number;
  expires_at?: string;
  is_active: boolean;
}

export const platformDiscountService = {
  list: async (includeInactive = true): Promise<PlatformDiscount[]> => {
    const response = await apiClient.get<{ data: PlatformDiscount[]; total: number }>(
      `/superadmin/billing/discounts?include_inactive=${includeInactive}`
    );
    return response.data.data || [];
  },

  get: async (id: string): Promise<PlatformDiscount> => {
    const response = await apiClient.get(`/superadmin/billing/discounts/${id}`);
    return response.data;
  },

  create: async (data: CreatePlatformDiscountRequest): Promise<PlatformDiscount> => {
    const response = await apiClient.post("/superadmin/billing/discounts", data);
    return response.data;
  },

  update: async (id: string, data: CreatePlatformDiscountRequest): Promise<PlatformDiscount> => {
    const response = await apiClient.put(`/superadmin/billing/discounts/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/superadmin/billing/discounts/${id}`);
  },

  validate: async (code: string, amount: number) => {
    const response = await apiClient.post("/public/validate-discount", { code, amount });
    return response.data;
  },

  apply: async (invoice_id: string, code: string) => {
    const response = await apiClient.post("/public/apply-discount", { invoice_id, code });
    return response.data;
  },

  remove: async (invoice_id: string) => {
    const response = await apiClient.post("/public/remove-discount", { invoice_id });
    return response.data;
  },
};
