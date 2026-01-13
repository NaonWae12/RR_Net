"use client";

import { useEffect } from "react";
import { CompleteTaskForm } from "@/components/technician/CompleteTaskForm";
import { useTechnicianStore } from "@/stores/technicianStore";
import { useParams, useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { CompleteTaskRequest } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

export default function CompleteTaskPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { task, loading, error, fetchTask, completeTask, clearTask } = useTechnicianStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchTask(id);
    }
    return () => {
      clearTask();
    };
  }, [id, fetchTask, clearTask]);

  const handleSubmit = async (data: CompleteTaskRequest) => {
    if (!id) return;
    try {
      await completeTask(id, data);
      showToast({
        title: "Task completed",
        description: "Task has been completed successfully.",
        variant: "success",
      });
      router.push(`/technician/tasks/${id}`);
    } catch (err: any) {
      showToast({
        title: "Failed to complete task",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push(`/technician/tasks/${id}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading task: {error}
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6 text-slate-500">
        Task not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Task Details
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Complete Task: {task.title}</h1>
      <CompleteTaskForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

