"use client";

import { useEffect, useState } from "react";
import { useTechnicianStore } from "@/stores/technicianStore";
import { TaskCard } from "@/components/technician/TaskCard";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@heroicons/react/20/solid";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useNotificationStore } from "@/stores/notificationStore";
import { TaskStatusBadge } from "@/components/technician/TaskStatusBadge";
import { TaskPriorityBadge } from "@/components/technician/TaskPriorityBadge";
import { TechnicianTask } from "@/lib/api/types";

export default function TasksPage() {
  const router = useRouter();
  const { tasks, summary, loading, error, fetchTasks, fetchTaskSummary, startTask, completeTask } = useTechnicianStore();
  const { showToast } = useNotificationStore();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchTasks();
    fetchTaskSummary();
  }, [fetchTasks, fetchTaskSummary]);

  const handleStart = async (id: string) => {
    try {
      await startTask(id);
      showToast({
        title: "Task started",
        description: "Task has been started successfully.",
        variant: "success",
      });
      await fetchTasks();
    } catch (err: any) {
      showToast({
        title: "Failed to start task",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleComplete = async (id: string) => {
    router.push(`/technician/tasks/${id}/complete`);
  };

  const filteredTasks = statusFilter === "all" 
    ? (tasks || [])
    : (tasks || []).filter((t) => t.status === statusFilter);

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading tasks: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Technician Tasks</h1>
        <Button onClick={() => router.push("/technician/tasks/create")}>
          <PlusIcon className="h-5 w-5 mr-2" /> Create Task
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Total Tasks</p>
            <p className="text-2xl font-bold text-slate-900">{summary.total_tasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{summary.pending_tasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{summary.in_progress_tasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Completed</p>
            <p className="text-2xl font-bold text-green-600">{summary.completed_tasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600">Overdue</p>
            <p className="text-2xl font-bold text-red-600">{summary.overdue_tasks}</p>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex space-x-2">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          onClick={() => setStatusFilter("all")}
          size="sm"
        >
          All ({tasks?.length || 0})
        </Button>
        <Button
          variant={statusFilter === "pending" ? "default" : "outline"}
          onClick={() => setStatusFilter("pending")}
          size="sm"
        >
          Pending ({(tasks || []).filter((t) => t.status === "pending").length})
        </Button>
        <Button
          variant={statusFilter === "in_progress" ? "default" : "outline"}
          onClick={() => setStatusFilter("in_progress")}
          size="sm"
        >
          In Progress ({(tasks || []).filter((t) => t.status === "in_progress").length})
        </Button>
        <Button
          variant={statusFilter === "completed" ? "default" : "outline"}
          onClick={() => setStatusFilter("completed")}
          size="sm"
        >
          Completed ({(tasks || []).filter((t) => t.status === "completed").length})
        </Button>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      ) : !filteredTasks || filteredTasks.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No tasks found. Create your first task to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStart={handleStart}
              onComplete={handleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

