import { create } from "zustand";

type Theme = "light" | "dark";

type GlobalState = {
  theme: Theme;
  sidebarOpen: boolean;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
};

type GlobalActions = {
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setLoading: (key: string, value: boolean) => void;
  setError: (key: string, message: string) => void;
  clearError: (key: string) => void;
};

export const useGlobalStore = create<GlobalState & GlobalActions>((set) => ({
  theme: "light",
  sidebarOpen: false,
  loading: {},
  errors: {},

  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setLoading: (key, value) =>
    set((state) => ({ loading: { ...state.loading, [key]: value } })),
  setError: (key, message) =>
    set((state) => ({ errors: { ...state.errors, [key]: message } })),
  clearError: (key) =>
    set((state) => {
      const next = { ...state.errors };
      delete next[key];
      return { errors: next };
    }),
}));

