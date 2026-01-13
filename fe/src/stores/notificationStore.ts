import { create } from "zustand";
import { generateUUID } from "../lib/utils";

type ToastVariant = "success" | "error" | "warning" | "info";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type NotificationState = {
  toasts: Toast[];
};

type NotificationActions = {
  showToast: (toast: Omit<Toast, "id"> & { id?: string }) => void;
  hideToast: (id: string) => void;
  clearAll: () => void;
};

export const useNotificationStore = create<NotificationState & NotificationActions>(
  (set) => ({
    toasts: [],
    showToast: (toast) =>
      set((state) => ({
        toasts: [
          ...state.toasts,
          {
            id: toast.id ?? generateUUID(),
            ...toast,
          },
        ],
      })),
    hideToast: (id) =>
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      })),
    clearAll: () => set({ toasts: [] }),
  })
);

