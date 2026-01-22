"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTechnicianStore } from "@/stores/technicianStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { TaskStatusBadge } from "@/components/technician/TaskStatusBadge";
import { TaskPriorityBadge } from "@/components/technician/TaskPriorityBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, PencilIcon, TrashIcon, PlayIcon, CheckIcon, PlusIcon } from "@heroicons/react/20/solid";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import { ActivityLog } from "@/lib/api/types";
import { useRole } from "@/lib/hooks/useRole";
import { LogActivityModal } from "@/components/technician/LogActivityModal";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { task, activityLogs, loading, error, fetchTask, fetchTaskActivityLogs, startTask, cancelTask, deleteTask, clearTask, logActivity } = useTechnicianStore();
  const { showToast } = useNotificationStore();
  const { isTechnician, canManageTasks } = useRole();
  const [showLogActivityModal, setShowLogActivityModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTask(id);
      fetchTaskActivityLogs(id);
    }
    return () => {
      clearTask();
    };
  }, [id, fetchTask, fetchTaskActivityLogs, clearTask]);

  const handleStart = async () => {
    if (!task) return;
    try {
      await startTask(task.id);
      showToast({
        title: "Task started",
        description: "Task has been started successfully.",
        variant: "success",
      });
      await fetchTask(id!);
    } catch (err: any) {
      showToast({
        title: "Failed to start task",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleComplete = () => {
    router.push(`/technician/tasks/${id}/complete`);
  };

  const handleCancel = async () => {
    if (!task) return;
    if (!confirm(`Are you sure you want to cancel task "${task.title}"?`)) {
      return;
    }
    try {
      await cancelTask(task.id);
      showToast({
        title: "Task cancelled",
        description: "Task has been cancelled successfully.",
        variant: "success",
      });
      router.push("/technician/tasks");
    } catch (err: any) {
      showToast({
        title: "Failed to cancel task",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm(`Are you sure you want to delete task "${task.title}"?`)) {
      return;
    }
    try {
      await deleteTask(task.id);
      showToast({
        title: "Task deleted",
        description: "Task has been deleted successfully.",
        variant: "success",
      });
      router.push("/technician/tasks");
    } catch (err: any) {
      showToast({
        title: "Failed to delete task",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
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

  const canStart = task.status === "pending";
  const canComplete = task.status === "in_progress" || task.status === "pending";

  const handleLogActivitySuccess = async () => {
    setShowLogActivityModal(false);
    await fetchTaskActivityLogs(id!);
    showToast({
      title: "Activity logged",
      description: "Activity has been logged successfully.",
      variant: "success",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Tasks
        </Button>
        <div className="flex space-x-2 flex-wrap">
          {canStart && task.status !== "pending_approval" && (
            <Button onClick={handleStart}>
              <PlayIcon className="h-4 w-4 mr-2" /> Start Task
            </Button>
          )}
          {canComplete && task.status !== "pending_approval" && (
            <Button onClick={handleComplete} variant="default">
              <CheckIcon className="h-4 w-4 mr-2" /> Complete Task
            </Button>
          )}
          <Button 
            onClick={() => setShowLogActivityModal(true)}
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            <PlusIcon className="h-4 w-4 mr-2" /> Log Activity
          </Button>
          {canManageTasks && (
            <>
              <Button variant="outline" onClick={() => router.push(`/technician/tasks/${task.id}/edit`)}>
                <PencilIcon className="h-4 w-4 mr-2" /> Edit
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancel Task
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <TrashIcon className="h-4 w-4 mr-2" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <h1 className="text-3xl font-bold text-slate-900">{task.title}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white shadow rounded-lg p-6">
        <div>
          <p className="text-sm font-medium text-slate-500">Status</p>
          <TaskStatusBadge status={task.status} className="text-lg mt-1" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Priority</p>
          <TaskPriorityBadge priority={task.priority} className="text-lg mt-1" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Task Type</p>
          <p className="text-lg font-semibold capitalize">{task.task_type}</p>
        </div>
        {task.scheduled_at && (
          <div>
            <p className="text-sm font-medium text-slate-500">Scheduled At</p>
            <p className="text-lg">{format(new Date(task.scheduled_at), "PPp")}</p>
          </div>
        )}
        {task.started_at && (
          <div>
            <p className="text-sm font-medium text-slate-500">Started At</p>
            <p className="text-lg">{format(new Date(task.started_at), "PPp")}</p>
          </div>
        )}
        {task.completed_at && (
          <div>
            <p className="text-sm font-medium text-slate-500">Completed At</p>
            <p className="text-lg">{format(new Date(task.completed_at), "PPp")}</p>
          </div>
        )}
        {task.estimated_hours && (
          <div>
            <p className="text-sm font-medium text-slate-500">Estimated Hours</p>
            <p className="text-lg">{task.estimated_hours}h</p>
          </div>
        )}
        {task.actual_hours && (
          <div>
            <p className="text-sm font-medium text-slate-500">Actual Hours</p>
            <p className="text-lg">{task.actual_hours}h</p>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-slate-500">Created At</p>
          <p className="text-lg">{format(new Date(task.created_at), "PPp")}</p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Description</h2>
        <p className="text-slate-700">{task.description}</p>
      </div>

      {task.address && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Location</h2>
          <p className="text-slate-700">{task.address}</p>
          {task.latitude && task.longitude && (
            <p className="text-sm text-slate-500 mt-2">
              Coordinates: {task.latitude}, {task.longitude}
            </p>
          )}
        </div>
      )}

      {task.notes && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Notes</h2>
          <p className="text-slate-700 whitespace-pre-wrap">{task.notes}</p>
        </div>
      )}

      {/* Activity Logs */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Activity Logs</h2>
        {!activityLogs || activityLogs.length === 0 ? (
          <p className="text-slate-500">No activity logs yet.</p>
        ) : (
          <div className="space-y-3">
            {activityLogs.map((log: ActivityLog) => (
              <div key={log.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-slate-900">{log.activity_type}</p>
                    <p className="text-sm text-slate-600">{log.description}</p>
                  </div>
                  <p className="text-xs text-slate-500">{format(new Date(log.created_at), "PPp")}</p>
                </div>
                {log.photo_urls && log.photo_urls.length > 0 && (
                  <div className="mt-2 flex space-x-2">
                    {log.photo_urls.map((url, idx) => (
                      <img key={idx} src={url} alt={`Activity photo ${idx + 1}`} className="h-20 w-20 object-cover rounded" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Activity Modal */}
      {showLogActivityModal && task && (
        <LogActivityModal
          taskId={task.id}
          onClose={() => setShowLogActivityModal(false)}
          onSuccess={handleLogActivitySuccess}
        />
      )}
    </div>
  );
}

