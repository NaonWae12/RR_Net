import { apiClient } from "./apiClient";

export type PlatformInvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface PlatformInvoice {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  plan_id: string;
  plan_name?: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  due_date: string;
  subtotal: number;
  discount_amount: number;
  discount_id?: string;
  amount: number;
  paid_amount: number;
  currency: string;
  status: PlatformInvoiceStatus;
  paid_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformAddon {
  id: string;
  code: string;
  name: string;
  description?: string;
  price: number;
  billing_cycle: string;
  currency: string;
  addon_type: string;
  value: Record<string, unknown>;
  is_active: boolean;
  available_for_plans: string[];
}

export interface TenantAddon {
  id: string;
  tenant_id: string;
  addon_id: string;
  addon?: PlatformAddon;
  started_at: string;
  expires_at?: string;
}

export interface SubmitPaymentRequest {
  invoice_id: string;
  method: string;
  reference: string;
  proof_image_url: string;
}

export interface PlatformPayment {
  id: string;
  platform_invoice_id: string;
  tenant_id: string;
  amount: number;
  currency: string;
  method: string;
  reference: string;
  proof_image_url: string;
  status: "pending" | "verified" | "rejected";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const subscriptionService = {
  async getMyInvoices(): Promise<PlatformInvoice[]> {
    const res = await apiClient.get<{ data: PlatformInvoice[]; total: number }>("/subscription/invoices");
    return res.data.data || [];
  },

  async submitPayment(data: SubmitPaymentRequest): Promise<unknown> {
    const res = await apiClient.post("/subscription/pay", data);
    return res.data;
  },

  async getAvailableAddons(): Promise<PlatformAddon[]> {
    const res = await apiClient.get<{ addons: PlatformAddon[]; total: number }>("/addons/public");
    return res.data.addons || [];
  },

  async getMyAddons(): Promise<TenantAddon[]> {
    const res = await apiClient.get<{ addons: TenantAddon[]; total: number }>("/my/addons");
    return res.data.addons || [];
  },

  // Super Admin Endpoints
  async listAllInvoices(): Promise<PlatformInvoice[]> {
    console.log("[subscriptionService] Requesting GET /superadmin/billing/invoices");
    try {
      const res = await apiClient.get<{ data: PlatformInvoice[]; total: number }>("/superadmin/billing/invoices");
      console.log("[subscriptionService] Invoices response:", res.data);
      return res.data.data || [];
    } catch (error) {
      console.error("[subscriptionService] Error in listAllInvoices:", error);
      throw error;
    }
  },

  async listPayments(invoiceId?: string): Promise<PlatformPayment[]> {
    const params = invoiceId ? { invoice_id: invoiceId } : {};
    const res = await apiClient.get<{ data: PlatformPayment[] }>("/superadmin/billing/payments", { params });
    return res.data.data || [];
  },

  async verifyPayment(id: string, approved: boolean): Promise<void> {
    await apiClient.post(`/superadmin/billing/payments/${id}/verify`, { approved });
  },

  async generateInvoices(): Promise<void> {
    await apiClient.post("/superadmin/billing/generate");
  },

  async getPublicPlans(): Promise<any[]> {
    const res = await apiClient.get("/plans/public?active=true&public=true");
    return res.data.plans || [];
  },

  async changeMyPlan(planId: string): Promise<void> {
    await apiClient.patch("/my/plan", { plan_id: planId });
  },
};
