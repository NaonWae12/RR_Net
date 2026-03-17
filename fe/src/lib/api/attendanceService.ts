import { apiClient } from "./apiClient";
import type { 
  Attendance, 
  CheckInRequest, 
  CheckOutRequest, 
  AttendanceListResponse 
} from "./types";

export const attendanceService = {
  /**
   * Get today's attendance for the current user
   */
  async getTodayAttendance(): Promise<Attendance | null> {
    try {
      const response = await apiClient.get<Attendance>("/employee/attendance/today");
      return response.data;
    } catch (err: any) {
      // Debug logging to inspect the error object
      console.log("[DEBUG] getTodayAttendance error:", {
        message: err.message,
        status: err.response?.status,
        statusCode: err.statusCode,
        code: err.code
      });

      // Catch both standard Axios error and our custom transformed ApiError
      // Check multiple properties to be safe
      const status = err?.response?.status || err?.statusCode || err?.status;
      
      // If 404, return null (no attendance record for today)
      if (status === 404) return null;
      throw err;
    }
  },

  /**
   * Get attendance history list with optional filters
   */
  async getAttendanceList(startDate?: string, endDate?: string): Promise<Attendance[]> {
    const params: Record<string, any> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const response = await apiClient.get<AttendanceListResponse>("/employee/attendance", { params });
    return response.data.data || [];
  },

  /**
   * Perform check-in
   */
  async checkIn(data: CheckInRequest): Promise<Attendance> {
    const response = await apiClient.post<Attendance>("/employee/attendance/check-in", data);
    return response.data;
  },

  /**
   * Perform check-out
   */
  async checkOut(data: CheckOutRequest): Promise<Attendance> {
    const response = await apiClient.post<Attendance>("/employee/attendance/check-out", data);
    return response.data;
  },
};
