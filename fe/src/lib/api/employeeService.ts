import apiClient from "./apiClient";
import type { Role, User } from "./types";

export type EmployeeUser = User;

export type EmployeesListResponse = {
  data: EmployeeUser[];
  total: number;
};

export type CreateEmployeeRequest = {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: Exclude<Role, "super_admin" | "owner">;
};

export const employeeService = {
  async list(): Promise<EmployeesListResponse> {
    const res = await apiClient.get("/employees");
    return res.data;
  },

  async create(payload: CreateEmployeeRequest): Promise<{ user: EmployeeUser }> {
    const res = await apiClient.post("/employees", payload);
    return res.data;
  },
};


