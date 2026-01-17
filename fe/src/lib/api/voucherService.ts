import { apiClient } from "./apiClient";

export interface VoucherPackage {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  download_speed: number;
  upload_speed: number;
  duration_hours?: number | null;
  validity?: string;
  quota_mb?: number | null;
  price: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Voucher {
  id: string;
  tenant_id: string;
  package_id: string;
  router_id?: string | null;
  code: string;
  password?: string;
  status: string;
  used_at?: string | null;
  expires_at?: string | null;
  first_session_id?: string | null;
  notes?: string | null;
  package_name?: string | null;
  created_at: string;
  updated_at: string;
}

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

export const voucherService = {
  async listPackages(): Promise<VoucherPackage[]> {
    const res = await apiClient.get<{ data: VoucherPackage[] }>("/voucher-packages");
    return Array.isArray(res.data?.data) ? res.data.data : [];
  },

  async createPackage(req: CreateVoucherPackageRequest): Promise<VoucherPackage> {
    const res = await apiClient.post<VoucherPackage>("/voucher-packages", req);
    return res.data;
  },

  async listVouchers(params?: { limit?: number; offset?: number }): Promise<{ data: Voucher[]; total: number }> {
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
};


