import apiClient from './apiClient';

export interface ClientGroup {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClientGroupRequest {
  name: string;
  description?: string | null;
}

export type UpdateClientGroupRequest = CreateClientGroupRequest;

export const clientGroupService = {
  async list(): Promise<ClientGroup[]> {
    const res = await apiClient.get('/client-groups');
    return (res.data?.data ?? []) as ClientGroup[];
  },

  async create(input: CreateClientGroupRequest): Promise<ClientGroup> {
    const res = await apiClient.post('/client-groups', input);
    return res.data as ClientGroup;
  },

  async update(id: string, input: UpdateClientGroupRequest): Promise<ClientGroup> {
    const res = await apiClient.put(`/client-groups/${id}`, input);
    return res.data as ClientGroup;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/client-groups/${id}`);
  },
};

export default clientGroupService;


