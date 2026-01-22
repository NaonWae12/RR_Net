"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { TechnicianTask, CreateTaskRequest, UpdateTaskRequest, TaskType, TaskPriority } from "@/lib/api/types";
import { useRole } from "@/lib/hooks/useRole";

const taskFormSchema = z.object({
  technician_id: z.string().min(1, "Technician is required"),
  task_type: z.enum(["installation", "maintenance", "repair", "inspection", "outage", "other"]),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  location_type: z.string().optional(),
  location_id: z.string().optional(),
  address: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  scheduled_at: z.string().optional(),
  estimated_hours: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  initialData?: TechnicianTask;
  onSubmit: (data: CreateTaskRequest | UpdateTaskRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function TaskForm({ initialData, onSubmit, onCancel, isLoading }: TaskFormProps) {
  const { isTechnician, userId } = useRole();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      technician_id: isTechnician && userId ? userId : "",
      task_type: "maintenance",
      priority: "normal",
      title: "",
      description: "",
      location_type: "",
      location_id: "",
      address: "",
      scheduled_at: "",
      estimated_hours: undefined,
      notes: "",
    },
  });

  // Auto-fill technician_id for technician users
  useEffect(() => {
    if (isTechnician && userId && !initialData) {
      setValue("technician_id", userId);
    }
  }, [isTechnician, userId, initialData, setValue]);

  useEffect(() => {
    if (initialData) {
      reset({
        technician_id: initialData.technician_id,
        task_type: initialData.task_type,
        priority: initialData.priority,
        title: initialData.title,
        description: initialData.description,
        location_type: initialData.location_type || "",
        location_id: initialData.location_id || "",
        address: initialData.address || "",
        latitude: initialData.latitude,
        longitude: initialData.longitude,
        scheduled_at: initialData.scheduled_at ? new Date(initialData.scheduled_at).toISOString().slice(0, 16) : "",
        estimated_hours: initialData.estimated_hours,
        notes: initialData.notes || "",
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: TaskFormValues) => {
    const submitData: any = {
      ...data,
      scheduled_at: data.scheduled_at ? new Date(data.scheduled_at).toISOString() : undefined,
      location_id: data.location_id || undefined,
      latitude: data.latitude || undefined,
      longitude: data.longitude || undefined,
    };
    await onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Warning banner for technician */}
      {isTechnician && !initialData && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex">
            <div className="shrink-0">
              <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">Admin Approval Required</h3>
              <p className="mt-1 text-sm text-amber-700">
                This task will be reviewed by admin before activation. You will be notified once it's approved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Technician ID field - hidden for technician, visible for admin */}
      {!isTechnician && (
        <Input
          label="Technician ID"
          {...register("technician_id")}
          error={errors.technician_id?.message}
          disabled={!!initialData}
        />
      )}
      {isTechnician && !initialData && (
        <div className="hidden">
          <Input
            label="Technician ID"
            {...register("technician_id")}
            error={errors.technician_id?.message}
            disabled={true}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Task Type</label>
          <SimpleSelect
            value={watch("task_type")}
            onValueChange={(value) => setValue("task_type", value as TaskType)}
            className="w-full"
          >
            <option value="installation">Installation</option>
            <option value="maintenance">Maintenance</option>
            <option value="repair">Repair</option>
            <option value="inspection">Inspection</option>
            <option value="outage">Outage</option>
            <option value="other">Other</option>
          </SimpleSelect>
          {errors.task_type && <p className="text-xs text-red-500 mt-1">{errors.task_type.message}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Priority</label>
          <SimpleSelect
            value={watch("priority")}
            onValueChange={(value) => setValue("priority", value as TaskPriority)}
            className="w-full"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </SimpleSelect>
          {errors.priority && <p className="text-xs text-red-500 mt-1">{errors.priority.message}</p>}
        </div>
      </div>

      <Input label="Title" {...register("title")} error={errors.title?.message} />

      <div>
        <label className="text-sm font-medium text-slate-700">Description</label>
        <textarea
          {...register("description")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          rows={3}
        />
        {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Location Type (odc/odp/client/address)"
          {...register("location_type")}
          error={errors.location_type?.message}
        />
        <Input
          label="Location ID"
          {...register("location_id")}
          error={errors.location_id?.message}
        />
      </div>

      <Input label="Address" {...register("address")} error={errors.address?.message} />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Latitude"
          type="number"
          step="any"
          {...register("latitude")}
          error={errors.latitude?.message}
        />
        <Input
          label="Longitude"
          type="number"
          step="any"
          {...register("longitude")}
          error={errors.longitude?.message}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Scheduled At"
          type="datetime-local"
          {...register("scheduled_at")}
          error={errors.scheduled_at?.message}
        />
        <Input
          label="Estimated Hours"
          type="number"
          step="0.1"
          {...register("estimated_hours")}
          error={errors.estimated_hours?.message}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Notes</label>
        <textarea
          {...register("notes")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          rows={3}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : initialData ? "Update Task" : "Create Task"}
        </Button>
      </div>
    </form>
  );
}

