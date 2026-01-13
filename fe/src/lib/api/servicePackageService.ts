import apiClient from './apiClient';

export type ServicePackageCategory = 'regular' | 'business' | 'enterprise' | 'lite';
export type ServicePackagePricingModel = 'flat_monthly' | 'per_device';

export interface ServicePackage {
  id: string;
  name: string;
  category: ServicePackageCategory;
  pricing_model: ServicePackagePricingModel;
  price_monthly: number;
  price_per_device: number;
  billing_day_default?: number | null;
  network_profile_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceSettings {
  service_discount: {
    enabled: boolean;
    type: 'percent' | 'nominal';
    value: number;
  };
}

export const servicePackageService = {
  async list(category?: ServicePackageCategory, activeOnly = true): Promise<ServicePackage[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    params.append('active_only', String(activeOnly));
    const res = await apiClient.get(`/service-packages?${params.toString()}`);
    return (res.data?.data ?? []) as ServicePackage[];
  },

  async create(input: Omit<ServicePackage, 'id' | 'created_at' | 'updated_at'>): Promise<ServicePackage> {
    const res = await apiClient.post('/service-packages', input);
    return res.data as ServicePackage;
  },

  async update(id: string, input: Omit<ServicePackage, 'id' | 'created_at' | 'updated_at'>): Promise<ServicePackage> {
    const res = await apiClient.put(`/service-packages/${id}`, input);
    return res.data as ServicePackage;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/service-packages/${id}`);
  },

  async getSettings(): Promise<ServiceSettings> {
    const res = await apiClient.get('/service-settings');
    return res.data as ServiceSettings;
  },

  async updateDiscount(input: ServiceSettings['service_discount']): Promise<ServiceSettings> {
    const res = await apiClient.put('/service-settings/discount', input);
    return res.data as ServiceSettings;
  },
};

export default servicePackageService;


