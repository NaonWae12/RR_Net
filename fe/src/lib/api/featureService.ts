import { apiClient } from "./apiClient";
import type { Feature } from "./types";

export interface FeatureListResponse {
  features: Feature[];
}

export const featureService = {
  /**
   * Get all available features from the catalog
   */
  async getFeatures(): Promise<Feature[]> {
    const response = await apiClient.get<FeatureListResponse>("/features");
    return response.data.features || [];
  },

  async createFeature(data: { code: string; name: string; description?: string; category?: string; sort_order?: number }): Promise<Feature> {
    const response = await apiClient.post<Feature>("/features", data);
    return response.data;
  },

  async updateFeature(id: string, data: { name?: string; description?: string; category?: string; sort_order?: number; is_enabled?: boolean }): Promise<Feature> {
    const response = await apiClient.put<Feature>(`/features/${id}`, data);
    return response.data;
  },

  async deleteFeature(id: string): Promise<void> {
    await apiClient.delete(`/features/${id}`);
  },
};

