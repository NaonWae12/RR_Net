import { apiClient } from "./apiClient";
import type {
  Attendance,
  TimeOff,
  Reimbursement,
  Payslip,
  ReimbursementListResponse,
} from "./types";

export const hrService = {
  // ========== Reimbursements (Approval) ==========
  async getReimbursements(status?: string): Promise<Reimbursement[]> {
    const params: Record<string, any> = {};
    if (status) params.status = status;
    const response = await apiClient.get<ReimbursementListResponse>("/hr/reimbursements", { params });
    return response.data.data || [];
  },

  async approveReimbursement(id: string): Promise<Reimbursement> {
    const response = await apiClient.post<Reimbursement>(`/hr/reimbursements/${id}/approve`, {});
    return response.data;
  },

  async rejectReimbursement(id: string, reason: string): Promise<Reimbursement> {
    const response = await apiClient.post<Reimbursement>(`/hr/reimbursements/${id}/reject`, { reason });
    return response.data;
  },

  async markAsPaid(id: string, paymentMethodId?: string, paymentReference?: string): Promise<Reimbursement> {
    const response = await apiClient.post<Reimbursement>(`/hr/reimbursements/${id}/pay`, {
      payment_method_id: paymentMethodId,
      payment_reference: paymentReference
    });
    return response.data;
  },

  // ========== Attendance ==========
  async getAttendanceRecords(startDate: string, endDate: string): Promise<Attendance[]> {
    const params = { start_date: startDate, end_date: endDate };
    const response = await apiClient.get<{ data: Attendance[] }>("/hr/attendance", { params });
    return response.data.data || [];
  },

  async getAttendanceSettings(): Promise<any> {
    const response = await apiClient.get("/hr/attendance/settings");
    return response.data;
  },

  async updateAttendanceSettings(settings: any): Promise<void> {
    await apiClient.put("/hr/attendance/settings", settings);
  },

  // ========== Payroll ==========
  async getPayrollRuns(): Promise<any[]> {
    const response = await apiClient.get<any>("/hr/payroll/runs");
    return response.data.data || [];
  },

  async createPayrollRun(period: string): Promise<any> {
    const response = await apiClient.post<any>("/hr/payroll/runs", { period });
    return response.data;
  },

  async getPayrollRun(id: string): Promise<any> {
    const response = await apiClient.get<any>(`/hr/payroll/runs/${id}`);
    return response.data;
  },

  async getPayslipPreview(userId: string, period: string): Promise<any> {
    const response = await apiClient.get<any>("/hr/payroll/preview", {
      params: { user_id: userId, period }
    });
    return response.data;
  },

  async upsertPayslip(payload: {
    user_id: string;
    period: string;
    allowances: { label: string; amount: number }[];
    deductions: { label: string; amount: number }[];
    reimbursement_ids: string[];
  }): Promise<any> {
    const response = await apiClient.post<any>("/hr/payroll/payslips", payload);
    return response.data;
  },
  
  async payPayslip(id: string, paymentMethodId?: string, paymentReference?: string): Promise<any> {
    const response = await apiClient.post<any>(`/hr/payroll/payslips/${id}/pay`, {
      payment_method_id: paymentMethodId,
      payment_reference: paymentReference
    });
    return response.data;
  },

  async payPayrollRun(id: string, paymentMethodId?: string, paymentReference?: string): Promise<any> {
    const response = await apiClient.post<any>(`/hr/payroll/runs/${id}/pay`, {
      payment_method_id: paymentMethodId,
      payment_reference: paymentReference
    });
    return response.data;
  },

  async getMyPayslips(): Promise<Payslip[]> {
    const response = await apiClient.get<{ data: Payslip[] }>("/employee/payroll/mypayslips");
    return response.data.data || [];
  },

  async downloadPayslip(id: string): Promise<Blob> {
    const response = await apiClient.get(`/employee/payroll/mypayslips/${id}/download`, {
      responseType: "blob",
    });
    return response.data;
  },

  // ========== Time Off (Leave Requests) ==========
  async getTimeOffs(status?: string): Promise<TimeOff[]> {
    const params: Record<string, any> = {};
    if (status) params.status = status;
    const response = await apiClient.get<{ data: TimeOff[] }>("/hr/time-offs", { params });
    return response.data.data || [];
  },

  async getTimeOff(id: string): Promise<TimeOff> {
    const response = await apiClient.get<TimeOff>(`/hr/time-offs/${id}`);
    return response.data;
  },

  async approveTimeOff(id: string): Promise<TimeOff> {
    const response = await apiClient.post<TimeOff>(`/hr/time-offs/${id}/approve`, {});
    return response.data;
  },

  async rejectTimeOff(id: string, reason: string): Promise<TimeOff> {
    const response = await apiClient.post<TimeOff>(`/hr/time-offs/${id}/reject`, { reason });
    return response.data;
  },
};
