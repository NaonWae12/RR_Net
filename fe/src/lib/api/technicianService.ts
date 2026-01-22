import { apiClient } from "./apiClient";
import type {
  TechnicianTask,
  ActivityLog,
  TaskSummary,
  CreateTaskRequest,
  UpdateTaskRequest,
  CompleteTaskRequest,
  LogActivityRequest,
  TaskListResponse,
  ActivityLogListResponse,
  Attendance,
  CheckInRequest,
  CheckOutRequest,
  AttendanceListResponse,
  Payslip,
  PayslipListResponse,
  Reimbursement,
  CreateReimbursementRequest,
  ReimbursementListResponse,
  TimeOff,
  CreateTimeOffRequest,
  TimeOffListResponse,
  LocationSubmission,
  CreateLocationSubmissionRequest,
  LocationSubmissionListResponse,
  ClientSubmission,
  CreateClientSubmissionRequest,
  ClientSubmissionListResponse,
} from "./types";

export const technicianService = {
  // ========== Tasks ==========
  async getTasks(technicianId?: string): Promise<TechnicianTask[]> {
    const params = technicianId ? { technician_id: technicianId } : {};
    const response = await apiClient.get<TaskListResponse>("/technician/tasks", { params });
    return response.data.data;
  },

  async getTask(id: string): Promise<TechnicianTask> {
    const response = await apiClient.get<TechnicianTask>(`/technician/tasks/${id}`);
    return response.data;
  },

  async createTask(data: CreateTaskRequest): Promise<TechnicianTask> {
    const response = await apiClient.post<TechnicianTask>("/technician/tasks", data);
    return response.data;
  },

  async updateTask(id: string, data: UpdateTaskRequest): Promise<TechnicianTask> {
    const response = await apiClient.put<TechnicianTask>(`/technician/tasks/${id}`, data);
    return response.data;
  },

  async deleteTask(id: string): Promise<void> {
    await apiClient.delete(`/technician/tasks/${id}`);
  },

  async startTask(id: string): Promise<TechnicianTask> {
    const response = await apiClient.post<TechnicianTask>(`/technician/tasks/${id}/start`, {});
    return response.data;
  },

  async completeTask(id: string, data: CompleteTaskRequest): Promise<TechnicianTask> {
    const response = await apiClient.post<TechnicianTask>(`/technician/tasks/${id}/complete`, data);
    return response.data;
  },

  async cancelTask(id: string): Promise<void> {
    await apiClient.post(`/technician/tasks/${id}/cancel`, {});
  },

  async getTaskSummary(technicianId?: string): Promise<TaskSummary> {
    const params = technicianId ? { technician_id: technicianId } : {};
    const response = await apiClient.get<TaskSummary>("/technician/tasks/summary", { params });
    return response.data;
  },

  async getTaskActivityLogs(taskId: string): Promise<ActivityLog[]> {
    const response = await apiClient.get<ActivityLogListResponse>(`/technician/tasks/${taskId}/activities`);
    return response.data.data;
  },

  // ========== Activity Logs ==========
  async getActivityLogs(technicianId?: string, limit?: number): Promise<ActivityLog[]> {
    const params: Record<string, any> = {};
    if (technicianId) params.technician_id = technicianId;
    if (limit) params.limit = limit;
    const response = await apiClient.get<ActivityLogListResponse>("/technician/activities", { params });
    return response.data.data;
  },

  async logActivity(data: LogActivityRequest): Promise<ActivityLog> {
    const response = await apiClient.post<ActivityLog>("/technician/activities", data);
    return response.data;
  },

  // ========== Attendance ==========
  async getTodayAttendance(userId?: string): Promise<Attendance | null> {
    const params = userId ? { user_id: userId } : {};
    try {
      const response = await apiClient.get<Attendance>("/technician/attendance/today", { params });
      return response.data;
    } catch (err: any) {
      // If 404, return null (no attendance record for today)
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  async getAttendanceList(userId?: string, startDate?: string, endDate?: string): Promise<Attendance[]> {
    const params: Record<string, any> = {};
    if (userId) params.user_id = userId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await apiClient.get<AttendanceListResponse>("/technician/attendance", { params });
    return response.data.data;
  },

  async checkIn(data: CheckInRequest): Promise<Attendance> {
    const response = await apiClient.post<Attendance>("/technician/attendance/check-in", data);
    return response.data;
  },

  async checkOut(data: CheckOutRequest): Promise<Attendance> {
    const response = await apiClient.post<Attendance>("/technician/attendance/check-out", data);
    return response.data;
  },

  // ========== Payslip ==========
  async getPayslips(userId?: string, period?: string): Promise<Payslip[]> {
    const params: Record<string, any> = {};
    if (userId) params.user_id = userId;
    if (period) params.period = period;
    const response = await apiClient.get<PayslipListResponse>("/technician/payslips", { params });
    return response.data.data;
  },

  async getPayslip(id: string): Promise<Payslip> {
    const response = await apiClient.get<Payslip>(`/technician/payslips/${id}`);
    return response.data;
  },

  async downloadPayslip(id: string): Promise<Blob> {
    const response = await apiClient.get(`/technician/payslips/${id}/download`, {
      responseType: "blob",
    });
    return response.data;
  },

  // ========== Reimbursement ==========
  async getReimbursements(userId?: string, status?: string): Promise<Reimbursement[]> {
    const params: Record<string, any> = {};
    if (userId) params.user_id = userId;
    if (status) params.status = status;
    const response = await apiClient.get<ReimbursementListResponse>("/technician/reimbursements", { params });
    return response.data.data;
  },

  async getReimbursement(id: string): Promise<Reimbursement> {
    const response = await apiClient.get<Reimbursement>(`/technician/reimbursements/${id}`);
    return response.data;
  },

  async createReimbursement(data: CreateReimbursementRequest): Promise<Reimbursement> {
    // Handle file upload separately if needed
    const formData = new FormData();
    formData.append("amount", data.amount.toString());
    formData.append("category", data.category);
    formData.append("description", data.description);
    formData.append("date", data.date);
    if (data.attachment) {
      formData.append("attachment", data.attachment);
    }

    const response = await apiClient.post<Reimbursement>("/technician/reimbursements", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // ========== Time Off ==========
  async getTimeOffs(userId?: string, status?: string): Promise<TimeOff[]> {
    const params: Record<string, any> = {};
    if (userId) params.user_id = userId;
    if (status) params.status = status;
    const response = await apiClient.get<TimeOffListResponse>("/technician/time-off", { params });
    return response.data.data;
  },

  async getTimeOff(id: string): Promise<TimeOff> {
    const response = await apiClient.get<TimeOff>(`/technician/time-off/${id}`);
    return response.data;
  },

  async createTimeOff(data: CreateTimeOffRequest): Promise<TimeOff> {
    // Handle file upload separately if needed
    const formData = new FormData();
    formData.append("type", data.type);
    formData.append("start_date", data.start_date);
    formData.append("end_date", data.end_date);
    formData.append("reason", data.reason);
    if (data.attachment) {
      formData.append("attachment", data.attachment);
    }

    const response = await apiClient.post<TimeOff>("/technician/time-off", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // ========== Location Submission ==========
  async getLocationSubmissions(userId?: string, status?: string): Promise<LocationSubmission[]> {
    const params: Record<string, any> = {};
    if (userId) params.user_id = userId;
    if (status) params.status = status;
    const response = await apiClient.get<LocationSubmissionListResponse>("/technician/location-submissions", { params });
    return response.data.data;
  },

  async createLocationSubmission(data: CreateLocationSubmissionRequest): Promise<LocationSubmission> {
    const formData = new FormData();
    formData.append("location_type", data.location_type);
    formData.append("latitude", data.latitude.toString());
    formData.append("longitude", data.longitude.toString());
    if (data.note) {
      formData.append("note", data.note);
    }
    if (data.photo) {
      formData.append("photo", data.photo);
    }

    const response = await apiClient.post<LocationSubmission>("/technician/location-submissions", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // ========== Client Submission ==========
  async getClientSubmissions(userId?: string, status?: string): Promise<ClientSubmission[]> {
    const params: Record<string, any> = {};
    if (userId) params.user_id = userId;
    if (status) params.status = status;
    const response = await apiClient.get<ClientSubmissionListResponse>("/technician/client-submissions", { params });
    return response.data.data;
  },

  async getClientSubmission(id: string): Promise<ClientSubmission> {
    const response = await apiClient.get<ClientSubmission>(`/technician/client-submissions/${id}`);
    return response.data;
  },

  async createClientSubmission(data: CreateClientSubmissionRequest): Promise<ClientSubmission> {
    const formData = new FormData();
    formData.append("name", data.name);
    if (data.email) formData.append("email", data.email);
    if (data.phone) formData.append("phone", data.phone);
    if (data.address) formData.append("address", data.address);
    if (data.category) formData.append("category", data.category);
    if (data.service_package_id) formData.append("service_package_id", data.service_package_id);
    if (data.latitude) formData.append("latitude", data.latitude.toString());
    if (data.longitude) formData.append("longitude", data.longitude.toString());
    if (data.photo) {
      formData.append("photo", data.photo);
    }

    const response = await apiClient.post<ClientSubmission>("/technician/client-submissions", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};

