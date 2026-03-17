import { apiClient } from "./apiClient";
import type { 
  Reimbursement, 
  CreateReimbursementRequest, 
  ReimbursementListResponse 
} from "./types";

export const reimbursementService = {
  /**
   * Get reimbursement history for the current user
   */
  async getMyReimbursements(status?: string): Promise<Reimbursement[]> {
    const params: Record<string, any> = {};
    if (status && status !== "all") params.status = status;
    
    const response = await apiClient.get<ReimbursementListResponse>("/employee/reimbursements", { params });
    return response.data.data || [];
  },

  /**
   * Get a single reimbursement detail
   */
  async getReimbursement(id: string): Promise<Reimbursement> {
    const response = await apiClient.get<Reimbursement>(`/employee/reimbursements/${id}`);
    return response.data;
  },

  /**
   * Submit a new reimbursement request
   * Handles both JSON and Multipart (with attachment)
   */
  async submitRequest(data: CreateReimbursementRequest): Promise<Reimbursement> {
    // Check if we have an attachment to decide between JSON and FormData
    if (data.attachment) {
      const formData = new FormData();
      formData.append("amount", data.amount.toString());
      formData.append("category", data.category);
      formData.append("description", data.description);
      formData.append("date", data.date); // Backend handles YYYY-MM-DD for multipart
      formData.append("attachment", data.attachment);

      const response = await apiClient.post<Reimbursement>("/employee/reimbursements", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    }

    // For JSON, we MUST format the date as ISO string (RFC 3339) 
    // to satisfy Go's time.Time JSON unmarshaling
    const jsonData = {
      ...data,
      date: new Date(data.date).toISOString()
    };

    // Fallback to plain JSON
    const response = await apiClient.post<Reimbursement>("/employee/reimbursements", jsonData);
    return response.data;
  },

  /**
   * Update an existing reimbursement request
   */
  async updateRequest(id: string, data: CreateReimbursementRequest): Promise<Reimbursement> {
    if (data.attachment) {
      const formData = new FormData();
      formData.append("amount", data.amount.toString());
      formData.append("category", data.category);
      formData.append("description", data.description);
      formData.append("date", data.date);
      formData.append("attachment", data.attachment);

      const response = await apiClient.put<Reimbursement>(`/employee/reimbursements/${id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    }

    const jsonData = {
      ...data,
      date: new Date(data.date).toISOString()
    };

    const response = await apiClient.put<Reimbursement>(`/employee/reimbursements/${id}`, jsonData);
    return response.data;
  },
};
