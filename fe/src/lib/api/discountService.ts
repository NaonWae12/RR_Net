import { apiClient } from "./apiClient";

export type DiscountType = 'percent' | 'nominal';

export interface Discount {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  type: DiscountType;
  value: number;
  expires_at?: string | null;
  is_active: boolean;
  is_valid: boolean; // Computed: active, not expired, not deleted
  created_at: string;
  updated_at: string;
}

export interface DiscountListResponse {
  data: Discount[];
  total: number;
}

export interface CreateDiscountRequest {
  name: string;
  description?: string | null;
  type: DiscountType;
  value: number;
  expires_at?: string | null; // ISO 8601 datetime string
  is_active: boolean;
}

export interface UpdateDiscountRequest extends CreateDiscountRequest {}

export const discountService = {
  /**
   * Get all discounts for the current tenant
   * @param includeInactive Include inactive discounts (default: false)
   * @param validOnly Only return valid (active, not expired) discounts (default: false)
   */
  async getDiscounts(includeInactive = false, validOnly = false): Promise<Discount[]> {
    const params = new URLSearchParams();
    if (includeInactive) {
      params.append('include_inactive', 'true');
    }
    if (validOnly) {
      params.append('valid_only', 'true');
    }
    const queryString = params.toString();
    const url = `/discounts${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<DiscountListResponse>(url);
    return response.data?.data ?? [];
  },

  /**
   * Get a single discount by ID
   */
  async getDiscount(id: string): Promise<Discount> {
    const response = await apiClient.get<Discount>(`/discounts/${id}`);
    return response.data;
  },

  /**
   * Create a new discount
   */
  async createDiscount(data: CreateDiscountRequest): Promise<Discount> {
    const response = await apiClient.post<Discount>("/discounts", data);
    return response.data;
  },

  /**
   * Update an existing discount
   */
  async updateDiscount(id: string, data: UpdateDiscountRequest): Promise<Discount> {
    const response = await apiClient.put<Discount>(`/discounts/${id}`, data);
    return response.data;
  },

  /**
   * Delete (soft delete) a discount
   */
  async deleteDiscount(id: string): Promise<void> {
    await apiClient.delete(`/discounts/${id}`);
  },
};

