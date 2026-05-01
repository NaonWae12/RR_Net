import { apiClient, setAccessToken, setTenantSlug } from "./apiClient";
import type { LoginRequest, LoginResponse, User, ProfileResponse } from "./types";

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

  async me(): Promise<ProfileResponse> {
    const res = await apiClient.get<ProfileResponse>("/auth/me");
    return res.data;
  },

  async logout(): Promise<void> {
    await apiClient.post("/auth/logout");
    setAccessToken(null);
  },

  async forgotPassword(email: string, method: "whatsapp" | "email" = "email"): Promise<{ message: string; info: string }> {
    const res = await apiClient.post("/auth/forgot-password", { email, method });
    return res.data;
  },

  async resetPassword(data: { email: string; otp: string; password: string }): Promise<void> {
    await apiClient.post("/auth/reset-password", data);
  },

  async verifyMFA(code: string): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>("/auth/mfa/verify", { code });
    setAccessToken(res.data.access_token);
    return res.data;
  },

  async changePassword(data: { current_password?: string; password: string; password_confirmation: string }): Promise<void> {
    await apiClient.post("/auth/change-password", data);
  },
  
  async updateProfile(data: { name: string; email?: string; phone?: string; otp?: string }): Promise<void> {
    await apiClient.patch("/auth/profile", data);
  },
  
  async requestProfileUpdateOTP(method: "email" | "whatsapp", value: string): Promise<void> {
    await apiClient.post("/auth/profile/request-otp", { method, value });
  },
};

