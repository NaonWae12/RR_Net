import { apiClient } from "./apiClient";
import type { Tenant } from "./types";

export const tenantService = {
  async getCurrentTenant(slug: string): Promise<Tenant> {
    const res = await apiClient.get<Tenant>("/tenant/me", {
      headers: { "X-Tenant-Slug": slug },
    });
    return res.data;
  },
};


