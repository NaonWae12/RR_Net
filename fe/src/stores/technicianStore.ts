import { create } from "zustand";
import { technicianService } from "@/lib/api/technicianService";
import {
  TechnicianTask,
  ActivityLog,
  TaskSummary,
  CreateTaskRequest,
  UpdateTaskRequest,
  CompleteTaskRequest,
  LogActivityRequest,
} from "@/lib/api/types";
import { toApiError } from "@/lib/utils/errors";

interface TechnicianState {
  tasks: TechnicianTask[];
  task: TechnicianTask | null;
  activityLogs: ActivityLog[];
  summary: TaskSummary | null;
  loading: boolean;
  error: string | null;
}

interface TechnicianActions {
  // Task actions
  fetchTasks: (technicianId?: string) => Promise<void>;
  fetchTask: (id: string) => Promise<void>;
  createTask: (data: CreateTaskRequest) => Promise<TechnicianTask>;
  updateTask: (id: string, data: UpdateTaskRequest) => Promise<TechnicianTask>;
  deleteTask: (id: string) => Promise<void>;
  startTask: (id: string) => Promise<TechnicianTask>;
  completeTask: (id: string, data: CompleteTaskRequest) => Promise<TechnicianTask>;
  cancelTask: (id: string) => Promise<void>;
  fetchTaskSummary: (technicianId?: string) => Promise<void>;
  fetchTaskActivityLogs: (taskId: string) => Promise<void>;

  // Activity log actions
  fetchActivityLogs: (technicianId?: string, limit?: number) => Promise<void>;
  logActivity: (data: LogActivityRequest) => Promise<ActivityLog>;

  // Clear
  clearTask: () => void;
}

export const useTechnicianStore = create<TechnicianState & TechnicianActions>((set, get) => ({
  tasks: [],
  task: null,
  activityLogs: [],
  summary: null,
  loading: false,
  error: null,

  fetchTasks: async (technicianId?: string) => {
    set({ loading: true, error: null });
    try {
      const tasks = await technicianService.getTasks(technicianId);
      set({ tasks: tasks || [], loading: false });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: false,
        tasks: [], // Ensure tasks is always an array
      });
    }
  },

  fetchTask: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const task = await technicianService.getTask(id);
      set({ task, loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  createTask: async (data: CreateTaskRequest) => {
    set({ loading: true, error: null });
    try {
      const task = await technicianService.createTask(data);
      set((state) => ({
        tasks: [task, ...state.tasks],
        loading: false,
      }));
      return task;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  updateTask: async (id: string, data: UpdateTaskRequest) => {
    set({ loading: true, error: null });
    try {
      const task = await technicianService.updateTask(id, data);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        task: state.task?.id === id ? task : state.task,
        loading: false,
      }));
      return task;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  deleteTask: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await technicianService.deleteTask(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        task: state.task?.id === id ? null : state.task,
        loading: false,
      }));
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  startTask: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const task = await technicianService.startTask(id);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        task: state.task?.id === id ? task : state.task,
        loading: false,
      }));
      return task;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  completeTask: async (id: string, data: CompleteTaskRequest) => {
    set({ loading: true, error: null });
    try {
      const task = await technicianService.completeTask(id, data);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        task: state.task?.id === id ? task : state.task,
        loading: false,
      }));
      // Refresh summary
      await get().fetchTaskSummary();
      return task;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  cancelTask: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await technicianService.cancelTask(id);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, status: "cancelled" } : t)),
        task: state.task?.id === id ? { ...state.task, status: "cancelled" } : state.task,
        loading: false,
      }));
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  fetchTaskSummary: async (technicianId?: string) => {
    set({ loading: true, error: null });
    try {
      const summary = await technicianService.getTaskSummary(technicianId);
      set({ summary, loading: false });
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
    }
  },

  fetchTaskActivityLogs: async (taskId: string) => {
    set({ loading: true, error: null });
    try {
      const logs = await technicianService.getTaskActivityLogs(taskId);
      set({ activityLogs: logs || [], loading: false });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: false,
        activityLogs: [], // Ensure activityLogs is always an array
      });
    }
  },

  fetchActivityLogs: async (technicianId?: string, limit?: number) => {
    set({ loading: true, error: null });
    try {
      const logs = await technicianService.getActivityLogs(technicianId, limit);
      set({ activityLogs: logs || [], loading: false });
    } catch (err) {
      set({ 
        error: toApiError(err).message, 
        loading: false,
        activityLogs: [], // Ensure activityLogs is always an array
      });
    }
  },

  logActivity: async (data: LogActivityRequest) => {
    set({ loading: true, error: null });
    try {
      const log = await technicianService.logActivity(data);
      set((state) => ({
        activityLogs: [log, ...state.activityLogs],
        loading: false,
      }));
      return log;
    } catch (err) {
      set({ error: toApiError(err).message, loading: false });
      throw err;
    }
  },

  clearTask: () => set({ task: null }),
}));

