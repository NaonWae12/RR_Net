import { apiClient } from "./apiClient";
import type {
  ODC,
  ODP,
  ClientLocation,
  OutageEvent,
  TopologyLink,
  CreateODCRequest,
  UpdateODCRequest,
  CreateODPRequest,
  UpdateODPRequest,
  CreateClientLocationRequest,
  UpdateClientLocationRequest,
  ReportOutageRequest,
  ResolveOutageRequest,
  MapsListResponse,
  NearestODPResponse,
} from "./types";

export const mapsService = {
  // ========== ODCs ==========
  async getODCs(): Promise<ODC[]> {
    const response = await apiClient.get<MapsListResponse<ODC>>("/maps/odcs");
    return response.data.data;
  },

  async getODC(id: string): Promise<ODC> {
    const response = await apiClient.get<ODC>(`/maps/odcs/${id}`);
    return response.data;
  },

  async createODC(data: CreateODCRequest): Promise<ODC> {
    const response = await apiClient.post<ODC>("/maps/odcs", data);
    return response.data;
  },

  async updateODC(id: string, data: UpdateODCRequest): Promise<ODC> {
    const response = await apiClient.put<ODC>(`/maps/odcs/${id}`, data);
    return response.data;
  },

  async deleteODC(id: string): Promise<void> {
    await apiClient.delete(`/maps/odcs/${id}`);
  },

  // ========== ODPs ==========
  async getODPs(odcId?: string): Promise<ODP[]> {
    const params = odcId ? { odc_id: odcId } : {};
    const response = await apiClient.get<MapsListResponse<ODP>>("/maps/odps", { params });
    return response.data.data;
  },

  async getODP(id: string): Promise<ODP> {
    const response = await apiClient.get<ODP>(`/maps/odps/${id}`);
    return response.data;
  },

  async createODP(data: CreateODPRequest): Promise<ODP> {
    const response = await apiClient.post<ODP>("/maps/odps", data);
    return response.data;
  },

  async updateODP(id: string, data: UpdateODPRequest): Promise<ODP> {
    const response = await apiClient.put<ODP>(`/maps/odps/${id}`, data);
    return response.data;
  },

  async deleteODP(id: string): Promise<void> {
    await apiClient.delete(`/maps/odps/${id}`);
  },

  // ========== Client Locations ==========
  async getClientLocations(odpId?: string): Promise<ClientLocation[]> {
    const params = odpId ? { odp_id: odpId } : {};
    const response = await apiClient.get<MapsListResponse<ClientLocation>>("/maps/clients", { params });
    return response.data.data;
  },

  async getClientLocation(id: string): Promise<ClientLocation> {
    const response = await apiClient.get<ClientLocation>(`/maps/clients/${id}`);
    return response.data;
  },

  async createClientLocation(data: CreateClientLocationRequest): Promise<ClientLocation> {
    const response = await apiClient.post<ClientLocation>("/maps/clients", data);
    return response.data;
  },

  async updateClientLocation(id: string, data: UpdateClientLocationRequest): Promise<ClientLocation> {
    const response = await apiClient.put<ClientLocation>(`/maps/clients/${id}`, data);
    return response.data;
  },

  async deleteClientLocation(id: string): Promise<void> {
    await apiClient.delete(`/maps/clients/${id}`);
  },

  async findNearestODP(lat: number, lng: number): Promise<string[]> {
    const response = await apiClient.get<NearestODPResponse>("/maps/clients/nearest-odp", {
      params: { lat, lng },
    });
    return response.data.odp_ids;
  },

  // ========== Outages ==========
  async getOutages(includeResolved: boolean = false): Promise<OutageEvent[]> {
    const response = await apiClient.get<MapsListResponse<OutageEvent>>("/maps/outages", {
      params: { include_resolved: includeResolved },
    });
    return response.data.data;
  },

  async getOutage(id: string): Promise<OutageEvent> {
    const response = await apiClient.get<OutageEvent>(`/maps/outages/${id}`);
    return response.data;
  },

  async reportOutage(data: ReportOutageRequest): Promise<OutageEvent> {
    const response = await apiClient.post<OutageEvent>("/maps/outages", data);
    return response.data;
  },

  async resolveOutage(outageId: string): Promise<void> {
    await apiClient.post(`/maps/outages/${outageId}/resolve`, {});
  },

  // ========== Topology ==========
  async getTopology(): Promise<TopologyLink[]> {
    const response = await apiClient.get<MapsListResponse<TopologyLink>>("/maps/topology");
    return response.data?.data || [];
  },
};

