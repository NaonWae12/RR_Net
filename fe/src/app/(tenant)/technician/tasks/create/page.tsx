"use client";

import { TaskForm } from "@/components/technician/TaskForm";
import { useTechnicianStore } from "@/stores/technicianStore";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { CreateTaskRequest, UpdateTaskRequest } from "@/lib/api/types";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { useRole } from "@/lib/hooks/useRole";

export default function CreateTaskPage() {
  const router = useRouter();
  const { createTask, loading } = useTechnicianStore();
  const { showToast } = useNotificationStore();
  const { isTechnician, canManageTasks } = useRole();

  const handleSubmit = async (data: CreateTaskRequest | UpdateTaskRequest) => {
    try {
      // For technician: task will be created with status pending_approval (FE-only simulation)
      // Backend will handle this later
      await createTask(data as CreateTaskRequest);
      showToast({
        title: isTechnician ? "Task submitted" : "Task created",
        description: isTechnician
          ? "Your task has been submitted and is waiting for admin approval."
          : "New task has been successfully created.",
        variant: "success",
      });
      router.push("/technician/tasks");
    } catch (err: any) {
      showToast({
        title: "Failed to create task",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push("/technician/tasks");
  };

  // Allow technician to create task (submission-based)
  return (
    <RoleGuard allowedRoles={["owner", "admin", "technician"]} redirectTo="/technician/tasks">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleCancel}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Tasks
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isTechnician ? "Submit New Task" : "Create New Task"}
        </h1>
        <TaskForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
      </div>
    </RoleGuard>
  );
}

