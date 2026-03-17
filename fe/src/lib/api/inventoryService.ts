import { apiClient } from "./apiClient";

export interface Asset {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  min_stock: number;
  unit: string;
  created_at: string;
  updated_at: string;
  stock_summary?: StockSummary;
}

export interface GlobalSummary {
  total_assets: number;
  active_items: number;
  low_stock_assets: number;
}

export interface StockSummary {
  total: number;
  in_stock: number;
  deployed: number;
  maintenance: number;
  low_stock: boolean;
}

export interface AssetInstance {
  id: string;
  asset_id: string;
  serial_number: string;
  status: 'in_stock' | 'deployed' | 'maintenance' | 'disposed' | 'sold';
  condition: 'new' | 'second' | 'broken' | 'refurbished';
  location: string;
  last_checked_at?: string;
  last_checked_by?: string;
  created_at: string;
}

export interface AssetLog {
  id: string;
  action: string;
  from_value: string;
  to_value: string;
  actor: string;
  notes: string;
  created_at: string;
}

export interface CreateAssetRequest extends Partial<Asset> {
  initial_stock?: number;
  initial_condition?: string;
}

export const inventoryService = {
  listAssets: (params?: { search?: string; category?: string; page?: number; page_size?: number }) =>
    apiClient.get<{ data: Asset[]; total: number }>("/inventory/assets", { params }),

  getAsset: (id: string) =>
    apiClient.get<Asset>(`/inventory/assets/${id}`),

  getSummary: () =>
    apiClient.get<GlobalSummary>(`/inventory/summary`),

  createAsset: (data: CreateAssetRequest) => {
    const { initial_stock, initial_condition, ...assetData } = data;
    return apiClient.post<Asset>("/inventory/assets", {
      asset: assetData,
      initial_stock,
      initial_condition
    });
  },

  listInstances: (assetId: string) =>
    apiClient.get<{ data: AssetInstance[] }>(`/inventory/assets/${assetId}/instances`),

  addInstance: (assetId: string, data: Partial<AssetInstance>) =>
    apiClient.post<AssetInstance>(`/inventory/assets/${assetId}/instances`, data),

  updateInstance: (assetId: string, id: string, data: Partial<AssetInstance>) =>
    apiClient.put(`/inventory/assets/${assetId}/instances/${id}`, data),

  bulkUpdate: (assetId: string, status: string) =>
    apiClient.post(`/inventory/assets/${assetId}/bulk-update`, { status }),

  getHistory: (params: { asset_id?: string; instance_id?: string }) =>
    apiClient.get<{ data: AssetLog[] }>("/inventory/history", { params }),

  deleteAsset: (id: string) =>
    apiClient.delete(`/inventory/assets/${id}`),

  getPublicInstance: (id: string) =>
    apiClient.get<AssetInstance & { asset: Asset }>(`/public/inventory/instance/${id}`),
};
