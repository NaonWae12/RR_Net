import apiClient from './apiClient';

export type ClientStatus = 'active' | 'isolir' | 'suspended' | 'terminated';
export type ClientCategory = 'regular' | 'business' | 'enterprise' | 'lite';

export interface Client {
  id: string;
  client_code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: ClientStatus;
  category: ClientCategory;
  service_package_id?: string | null;
  group_id?: string | null;
  discount_id?: string | null;
  // Discount fields (populated when discount is included in response)
  discount_type?: 'percent' | 'fixed' | null;
  discount_value?: number | null;
  device_count?: number | null;
  pppoe_username?: string;
  // Optional display/service fields (some endpoints may include these)
  package_name?: string | null;
  monthly_fee?: number | null;
  billing_cycle_day?: number | null;
  notes?: string | null;
  payment_tempo_option?: 'default' | 'template' | 'manual' | string;
  payment_due_day?: number;
  payment_tempo_template_id?: string | null;
  // legacy/backward-compat display field from backend
  service_plan?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientListResponse {
  data: Client[]; // normalized for FE store
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ClientStats {
  total: number;
  limit: number;
  unlimited: boolean;
  remaining: number;
}

export interface CreateClientRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  category: ClientCategory;
  service_package_id: string;
  group_id?: string;
  isolir_mode?: 'auto' | 'manual';
  device_count?: number;
  pppoe_username?: string;
  pppoe_password?: string;
  // Optional: allow manual client_code entry; if omitted backend will generate
  client_code?: string;
  discount_id?: string;
  // Payment tempo fields (new)
  payment_tempo_option?: 'default' | 'template' | 'manual';
  payment_due_day?: number;
  payment_tempo_template_id?: string;
}

export interface UpdateClientRequest extends Partial<CreateClientRequest> {
  category: ClientCategory;
  service_package_id: string;
}

export interface ClientFilters {
  search?: string;
  status?: string;
  category?: string;
  group_id?: string;
  page?: number;
  page_size?: number;
}

export const clientService = {
  async getClients(filters: ClientFilters = {}): Promise<ClientListResponse> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    // Only append group_id if it's a non-empty string
    if (filters.group_id && typeof filters.group_id === 'string' && filters.group_id.trim() !== '') {
      params.append('group_id', filters.group_id);
    }
    if (filters.page) params.append('page', String(filters.page));
    if (filters.page_size) params.append('page_size', String(filters.page_size));
    
    const response = await apiClient.get(`/clients?${params.toString()}`);
    // Backend shape: { clients, total, page, page_size }
    const raw = response.data as any;
    const clients = raw.clients ?? [];
    const total = raw.total ?? 0;
    const page = raw.page ?? 1;
    const pageSize = raw.page_size ?? 20;
    const totalPages = pageSize ? Math.ceil(total / pageSize) : 0;
    return { data: clients, total, page, page_size: pageSize, total_pages: totalPages };
  },

  async getClient(id: string): Promise<Client> {
    const response = await apiClient.get(`/clients/${id}`);
    return response.data;
  },

  async getStats(): Promise<ClientStats> {
    const response = await apiClient.get('/clients/stats');
    return response.data;
  },

  async createClient(data: CreateClientRequest): Promise<Client> {
    const payload: any = {
      client_code: data.client_code,
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      category: data.category,
      service_package_id: data.service_package_id,
      group_id: data.group_id,
      discount_id: data.discount_id,
      isolir_mode: data.isolir_mode,
      device_count: data.device_count,
      pppoe_username: data.pppoe_username,
      pppoe_password: data.pppoe_password,
      payment_tempo_option: data.payment_tempo_option,
      payment_due_day: data.payment_due_day,
      payment_tempo_template_id: data.payment_tempo_template_id,
    };
    const response = await apiClient.post('/clients', payload);
    return response.data;
  },

  async updateClient(id: string, data: UpdateClientRequest): Promise<Client> {
    const payload: any = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      category: data.category,
      service_package_id: data.service_package_id,
      group_id: data.group_id,
      discount_id: data.discount_id,
      isolir_mode: data.isolir_mode,
      device_count: data.device_count,
      pppoe_username: data.pppoe_username,
      pppoe_password: data.pppoe_password,
      payment_tempo_option: data.payment_tempo_option,
      payment_due_day: data.payment_due_day,
      payment_tempo_template_id: data.payment_tempo_template_id,
    };
    const response = await apiClient.put(`/clients/${id}`, payload);
    return response.data;
  },

  async updateStatus(id: string, status: string): Promise<Client> {
    const response = await apiClient.patch(`/clients/${id}/status`, { status });
    return response.data;
  },

  async deleteClient(id: string): Promise<void> {
    await apiClient.delete(`/clients/${id}`);
  },
};

export default clientService;


