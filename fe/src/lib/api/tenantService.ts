import { apiClient } from "./apiClient";
import type { Tenant } from "./types";

export const tenantService = {
  async getCurrentTenant(slug: string): Promise<Tenant> {
    // let isAuthenticated = false;
    // let token = null;
    // try {
    //   const authStore = (await import("@/stores/authStore")).useAuthStore;
    //   if (authStore) {
    //     const authState = authStore.getState();
    //     isAuthenticated = authState.isAuthenticated;
    //     token = authState.token;
    //   }
    // } catch (e) {
    //   // Ignore
    // }
    // console.log('[API CALL] getCurrentTenant - BEFORE call:', {
    //   endpoint: '/tenant/me',
    //   isAuthenticated,
    //   token: token ? token.substring(0, 20) + '...' : null,
    //   slug,
    // });
    const res = await apiClient.get<Tenant>("/tenant/me", {
      headers: { "X-Tenant-Slug": slug },
    });
    return res.data;
  },
};


