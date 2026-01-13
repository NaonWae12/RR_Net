"use client";

import { TaskForm } from "@/components/technician/TaskForm";
import { useTechnicianStore } from "@/stores/technicianStore";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { CreateTaskRequest, UpdateTaskRequest } from "@/lib/api/types";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

export default function CreateTaskPage() {
  const router = useRouter();
  const { createTask, loading } = useTechnicianStore();
  const { showToast } = useNotificationStore();

  const handleSubmit = async (data: CreateTaskRequest | UpdateTaskRequest) => {
    try {
      await createTask(data as CreateTaskRequest);
      showToast({
        title: "Task created",
        description: "New task has been successfully created.",
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Tasks
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Create New Task</h1>
      <TaskForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

