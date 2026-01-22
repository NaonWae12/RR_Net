import { create } from "zustand";
import { mapsService } from "@/lib/api/mapsService";
import {
  ODC,
  ODP,
  ClientLocation,
  OutageEvent,
  CreateODCRequest,
  UpdateODCRequest,
  CreateODPRequest,
  UpdateODPRequest,
  CreateClientLocationRequest,
  UpdateClientLocationRequest,
  ReportOutageRequest,
} from "@/lib/api/types";
import { toApiError } from "@/lib/utils/errors";

interface MapsState {
  // ODCs
  odcs: ODC[];
  odc: ODC | null;

  // ODPs
  odps: ODP[];
  odp: ODP | null;

  // Client Locations
  clientLocations: ClientLocation[];
  clientLocation: ClientLocation | null;

  // Outages
  outages: OutageEvent[];
  outage: OutageEvent | null;

  // UI State
  loading: boolean;
  error: string | null;
}

interface MapsActions {
  // ODC actions
  fetchODCs: () => Promise<void>;
  fetchODC: (id: string) => Promise<void>;
  createODC: (data: CreateODCRequest) => Promise<ODC>;
  updateODC: (id: string, data: UpdateODCRequest) => Promise<ODC>;
  deleteODC: (id: string) => Promise<void>;

  // ODP actions
  fetchODPs: (odcId?: string) => Promise<void>;
  fetchODP: (id: string) => Promise<void>;
  createODP: (data: CreateODPRequest) => Promise<ODP>;
  updateODP: (id: string, data: UpdateODPRequest) => Promise<ODP>;
  deleteODP: (id: string) => Promise<void>;

  // Client Location actions
  fetchClientLocations: (odpId?: string) => Promise<void>;
  fetchClientLocation: (id: string) => Promise<void>;
  createClientLocation: (data: CreateClientLocationRequest) => Promise<ClientLocation>;
  updateClientLocation: (id: string, data: UpdateClientLocationRequest) => Promise<ClientLocation>;
  deleteClientLocation: (id: string) => Promise<void>;
  findNearestODP: (lat: number, lng: number) => Promise<string[]>;

  // Outage actions
  fetchOutages: (includeResolved?: boolean) => Promise<void>;
  fetchOutage: (id: string) => Promise<void>;
  reportOutage: (data: ReportOutageRequest) => Promise<OutageEvent>;
  resolveOutage: (outageId: string) => Promise<void>;

  // Clear
  clearODC: () => void;
  clearODP: () => void;
  clearClientLocation: () => void;
  clearOutage: () => void;
}

export const useMapsStore = create<MapsState & MapsActions>((set, get) => ({
  odcs: [],
  odc: null,
  odps: [],
  odp: null,
  clientLocations: [],
  clientLocation: null,
  outages: [],
  outage: null,
  loading: false,
  error: null,

  fetchODCs: async () => {
    // Prevent concurrent calls
    const state = get();
    if (state.loading) {
      return; // Already fetching, skip this call
    }
    
    set({ loading: true, error: null });
    try {
      const odcs = await mapsService.getODCs();
      set({ odcs: odcs || [], loading: false });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: false,
        odcs: [], // Ensure odcs is always an array
      });
    }
  },

  fetchODC: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const odc = await mapsService.getODC(id);
      set({ odc, loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  createODC: async (data: CreateODCRequest) => {
    set({ loading: true, error: null });
    try {
      const odc = await mapsService.createODC(data);
      set((state) => ({
        odcs: [...state.odcs, odc],
        loading: false,
      }));
      return odc;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  updateODC: async (id: string, data: UpdateODCRequest) => {
    set({ loading: true, error: null });
    try {
      const odc = await mapsService.updateODC(id, data);
      set((state) => ({
        odcs: state.odcs.map((o) => (o.id === id ? odc : o)),
        odc: state.odc?.id === id ? odc : state.odc,
        loading: false,
      }));
      return odc;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  deleteODC: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await mapsService.deleteODC(id);
      set((state) => ({
        odcs: state.odcs.filter((o) => o.id !== id),
        odc: state.odc?.id === id ? null : state.odc,
        loading: false,
      }));
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  fetchODPs: async (odcId?: string) => {
    // Prevent concurrent calls
    const state = get();
    if (state.loading) {
      return; // Already fetching, skip this call
    }
    
    set({ loading: true, error: null });
    try {
      const odps = await mapsService.getODPs(odcId);
      set({ odps: odps || [], loading: false });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: false,
        odps: [], // Ensure odps is always an array
      });
    }
  },

  fetchODP: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const odp = await mapsService.getODP(id);
      set({ odp, loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  createODP: async (data: CreateODPRequest) => {
    set({ loading: true, error: null });
    try {
      const odp = await mapsService.createODP(data);
      set((state) => ({
        odps: [...state.odps, odp],
        loading: false,
      }));
      return odp;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  updateODP: async (id: string, data: UpdateODPRequest) => {
    set({ loading: true, error: null });
    try {
      const odp = await mapsService.updateODP(id, data);
      set((state) => ({
        odps: state.odps.map((o) => (o.id === id ? odp : o)),
        odp: state.odp?.id === id ? odp : state.odp,
        loading: false,
      }));
      return odp;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  deleteODP: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await mapsService.deleteODP(id);
      set((state) => ({
        odps: state.odps.filter((o) => o.id !== id),
        odp: state.odp?.id === id ? null : state.odp,
        loading: false,
      }));
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  fetchClientLocations: async (odpId?: string) => {
    // Prevent concurrent calls
    const state = get();
    if (state.loading) {
      return; // Already fetching, skip this call
    }
    
    set({ loading: true, error: null });
    try {
      const locations = await mapsService.getClientLocations(odpId);
      set({ clientLocations: locations || [], loading: false });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: false,
        clientLocations: [], // Ensure clientLocations is always an array
      });
    }
  },

  fetchClientLocation: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const location = await mapsService.getClientLocation(id);
      set({ clientLocation: location, loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  createClientLocation: async (data: CreateClientLocationRequest) => {
    set({ loading: true, error: null });
    try {
      const location = await mapsService.createClientLocation(data);
      set((state) => ({
        clientLocations: [...state.clientLocations, location],
        loading: false,
      }));
      return location;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  updateClientLocation: async (id: string, data: UpdateClientLocationRequest) => {
    set({ loading: true, error: null });
    try {
      const location = await mapsService.updateClientLocation(id, data);
      set((state) => ({
        clientLocations: state.clientLocations.map((l) => (l.id === id ? location : l)),
        clientLocation: state.clientLocation?.id === id ? location : state.clientLocation,
        loading: false,
      }));
      return location;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  deleteClientLocation: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await mapsService.deleteClientLocation(id);
      set((state) => ({
        clientLocations: state.clientLocations.filter((l) => l.id !== id),
        clientLocation: state.clientLocation?.id === id ? null : state.clientLocation,
        loading: false,
      }));
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  findNearestODP: async (lat: number, lng: number) => {
    try {
      return await mapsService.findNearestODP(lat, lng);
    } catch (err) {
      set({ error: toApiError(err).message });
      throw err;
    }
  },

  fetchOutages: async (includeResolved: boolean = false) => {
    set({ loading: true, error: null });
    try {
      const outages = await mapsService.getOutages(includeResolved);
      set({ outages: outages || [], loading: false });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: false,
        outages: [], // Ensure outages is always an array
      });
    }
  },

  fetchOutage: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const outage = await mapsService.getOutage(id);
      set({ outage, loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  reportOutage: async (data: ReportOutageRequest) => {
    set({ loading: true, error: null });
    try {
      const outage = await mapsService.reportOutage(data);
      set((state) => ({
        outages: [outage, ...state.outages],
        loading: false,
      }));
      // Refresh nodes to update status - run sequentially to avoid race condition
      // Only refresh if not already loading
      const currentState = get();
      if (!currentState.loading) {
        try {
          await get().fetchODCs();
        } catch (e) {
          // Ignore refresh errors
        }
      }
      if (!get().loading) {
        try {
          await get().fetchODPs();
        } catch (e) {
          // Ignore refresh errors
        }
      }
      if (!get().loading) {
        try {
          await get().fetchClientLocations();
        } catch (e) {
          // Ignore refresh errors
        }
      }
      return outage;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  resolveOutage: async (outageId: string) => {
    set({ loading: true, error: null });
    try {
      await mapsService.resolveOutage(outageId);
      set((state) => ({
        outages: state.outages.map((o) =>
          o.id === outageId ? { ...o, is_resolved: true } : o
        ),
        loading: false,
      }));
      // Refresh nodes to update status - run sequentially to avoid race condition
      // Only refresh if not already loading
      const currentState = get();
      if (!currentState.loading) {
        try {
          await get().fetchODCs();
        } catch (e) {
          // Ignore refresh errors
        }
      }
      if (!get().loading) {
        try {
          await get().fetchODPs();
        } catch (e) {
          // Ignore refresh errors
        }
      }
      if (!get().loading) {
        try {
          await get().fetchClientLocations();
        } catch (e) {
          // Ignore refresh errors
        }
      }
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  clearODC: () => set({ odc: null }),
  clearODP: () => set({ odp: null }),
  clearClientLocation: () => set({ clientLocation: null }),
  clearOutage: () => set({ outage: null }),
}));

