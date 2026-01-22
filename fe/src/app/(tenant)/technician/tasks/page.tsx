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
import { useRole } from "@/lib/hooks/useRole";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { useAuth } from "@/lib/hooks/useAuth";

export default function TasksPage() {
  const router = useRouter();
  const { tasks, summary, loading, error, fetchTasks, fetchTaskSummary, startTask, completeTask } = useTechnicianStore();
  const { showToast } = useNotificationStore();
  const { isTechnician, canManageTasks, userId } = useRole();
  const { isAuthenticated } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) return;
    
    // For technician: only fetch assigned tasks
    // For admin: fetch all tasks
    // Pass technician_id as query param (backend expects UUID string)
    const technicianId = isTechnician && userId ? userId : undefined;
    fetchTasks(technicianId);
    fetchTaskSummary(technicianId);
  }, [fetchTasks, fetchTaskSummary, isTechnician, userId, isAuthenticated]);

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

  // Base filter by status
  const filteredTasks = statusFilter === "all"
    ? (tasks || [])
    : (tasks || []).filter((t) => t.status === statusFilter);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-red-700">Error loading tasks: {error}</p>
        </div>
      </div>
    );
  }

  // Filter tasks based on role
  const filteredTasksByRole = filteredTasks.filter((task) => {
    if (isTechnician) {
      // Technician: Show only approved tasks + own pending_approval tasks
      // For FE-only: assume status "pending" = approved (backend will handle approval_status later)
      const isApproved = task.status !== "pending_approval" || task.approval_status === "approved";
      const isOwnPendingApproval = task.status === "pending_approval" && task.technician_id === userId;
      return isApproved || isOwnPendingApproval;
    }
    // Admin: Show all tasks
    return true;
  });

  return (
    <RoleGuard allowedRoles={["owner", "admin", "technician"]} redirectTo="/dashboard">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">
            {isTechnician ? "My Tasks" : "Technician Tasks"}
          </h1>
          {/* Allow technician to create task (submission-based) */}
          <Button onClick={() => router.push("/technician/tasks/create")}>
            <PlusIcon className="h-5 w-5 mr-2" /> {isTechnician ? "Submit Task" : "Create Task"}
          </Button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Total Tasks</p>
              <p className="text-2xl font-bold text-slate-900">{summary.total_tasks}</p>
            </div>
            <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{summary.pending_tasks}</p>
            </div>
            <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
              <p className="text-sm text-slate-600">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{summary.in_progress_tasks}</p>
            </div>
            <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{summary.completed_tasks}</p>
            </div>
            <div className="bg-white rounded-lg shadow border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{summary.overdue_tasks}</p>
            </div>
          </div>
        )}

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            size="sm"
          >
            All ({filteredTasksByRole.length})
          </Button>
          {isTechnician && (
            <Button
              variant={statusFilter === "pending_approval" ? "default" : "outline"}
              onClick={() => setStatusFilter("pending_approval")}
              size="sm"
            >
              Pending Approval ({(filteredTasksByRole || []).filter((t) => t.status === "pending_approval").length})
            </Button>
          )}
          <Button
            variant={statusFilter === "pending" ? "default" : "outline"}
            onClick={() => setStatusFilter("pending")}
            size="sm"
          >
            Pending ({(filteredTasksByRole || []).filter((t) => t.status === "pending").length})
          </Button>
          <Button
            variant={statusFilter === "in_progress" ? "default" : "outline"}
            onClick={() => setStatusFilter("in_progress")}
            size="sm"
          >
            In Progress ({(filteredTasksByRole || []).filter((t) => t.status === "in_progress").length})
          </Button>
          <Button
            variant={statusFilter === "completed" ? "default" : "outline"}
            onClick={() => setStatusFilter("completed")}
            size="sm"
          >
            Completed ({(filteredTasksByRole || []).filter((t) => t.status === "completed").length})
          </Button>
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        ) : !filteredTasksByRole || filteredTasksByRole.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {isTechnician
              ? statusFilter === "pending_approval"
                ? "No tasks pending approval."
                : "No tasks assigned to you yet."
              : "No tasks found. Create your first task to get started."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasksByRole.map((task) => (
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
    </RoleGuard>
  );
}

