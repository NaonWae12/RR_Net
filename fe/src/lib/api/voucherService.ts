import { apiClient } from "./apiClient";
import { Voucher, VoucherPackage } from "./types";

export interface CreateVoucherPackageRequest {
  name: string;
  description?: string;
  download_speed: number;
  upload_speed: number;
  duration_hours?: number;
  validity?: string;
  quota_mb?: number;
  price?: number;
  currency?: string;
  rate_limit_mode?: string; // "full_radius" or "radius_auth_only"
}

export interface GenerateVouchersRequest {
  package_id: string;
  router_id?: string;
  quantity: number;
  expires_at?: string;
  user_mode?: string;
  character_mode?: string;
  code_length?: number;
}

export interface UpdateVoucherRequest {
  package_id: string;
  router_id?: string;
  code: string;
  password?: string;
  shared_users: number;
  notes?: string;
}

export const voucherService = {
  async listPackages(): Promise<VoucherPackage[]> {
    const res = await apiClient.get<{ data: VoucherPackage[] }>("/voucher-packages");
    return Array.isArray(res.data?.data) ? res.data.data : [];
  },

  async createPackage(req: CreateVoucherPackageRequest): Promise<VoucherPackage> {
    const res = await apiClient.post<VoucherPackage>("/voucher-packages", req);
    return res.data;
  },

  async listVouchers(params?: { limit?: number; offset?: number; status?: string; search?: string }): Promise<{ data: Voucher[]; total: number }> {
    const res = await apiClient.get<{ data: Voucher[]; total: number }>("/vouchers", { params });
    return res.data;
  },

  async generate(req: GenerateVouchersRequest): Promise<{ data: Voucher[]; total: number }> {
    const res = await apiClient.post<{ data: Voucher[]; total: number }>("/vouchers/generate", req);
    return res.data;
  },

  async deleteVoucher(id: string): Promise<void> {
    await apiClient.delete(`/vouchers/${id}`);
  },

  async toggleStatus(id: string): Promise<Voucher> {
    const res = await apiClient.post<Voucher>(`/vouchers/${id}/toggle-status`);
    return res.data;
  },

  async toggleIsolate(id: string): Promise<Voucher> {
    const res = await apiClient.post<Voucher>(`/vouchers/${id}/toggle-isolate`);
    return res.data;
  },

  async syncPackageToRouters(packageId: string, routerIds: string[]): Promise<void> {
    await apiClient.post(`/voucher-packages/${packageId}/sync`, { router_ids: routerIds });
  },

  async deletePackage(id: string): Promise<void> {
    await apiClient.delete(`/voucher-packages/${id}`);
  },
  async updatePackage(id: string, req: Partial<CreateVoucherPackageRequest>): Promise<VoucherPackage> {
    const res = await apiClient.put<VoucherPackage>(`/voucher-packages/${id}`, req);
    return res.data;
  },
  async updateVoucher(id: string, req: UpdateVoucherRequest): Promise<Voucher> {
    const res = await apiClient.put<Voucher>(`/vouchers/${id}`, req);
    return res.data;
  },
};


