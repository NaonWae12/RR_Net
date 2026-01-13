import { apiClient, setAccessToken, setTenantSlug } from "./apiClient";
import type { LoginRequest, LoginResponse, User } from "./types";

export const authService = {
  async login(data: LoginRequest, tenantSlug?: string): Promise<LoginResponse> {
    // Clear tenant slug first to avoid using cached value from previous login
    setTenantSlug(null);
    
    // Only set tenant slug if provided (for tenant users)
    if (tenantSlug) {
      setTenantSlug(tenantSlug);
    }
    
    const res = await apiClient.post<LoginResponse>("/auth/login", data, {
      headers: tenantSlug ? { "X-Tenant-Slug": tenantSlug } : undefined,
    });
    setAccessToken(res.data.access_token);
    return res.data;
  },

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    setAccessToken(res.data.access_token);
    return res.data;
  },

  async me(): Promise<User> {
    const res = await apiClient.get<User>("/auth/me");
    return res.data;
  },

  async logout(): Promise<void> {
    await apiClient.post("/auth/logout");
    setAccessToken(null);
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post("/auth/forgot-password", { email });
  },

  async resetPassword(data: { token: string; password: string }): Promise<void> {
    await apiClient.post("/auth/reset-password", data);
  },

  async verifyMFA(code: string): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>("/auth/mfa/verify", { code });
    setAccessToken(res.data.access_token);
    return res.data;
  },
};

