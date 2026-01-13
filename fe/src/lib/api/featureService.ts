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
};

