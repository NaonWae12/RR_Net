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
};

