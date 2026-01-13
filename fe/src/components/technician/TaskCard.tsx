import { TechnicianTask } from "@/lib/api/types";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface TaskCardProps {
  task: TechnicianTask;
  onStart?: (id: string) => void;
  onComplete?: (id: string) => void;
  showActions?: boolean;
}

export function TaskCard({ task, onStart, onComplete, showActions = true }: TaskCardProps) {
  const router = useRouter();

  const canStart = task.status === "pending";
  const canComplete = task.status === "in_progress" || task.status === "pending";

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-slate-900">{task.title}</h3>
          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
        </div>
        <div className="flex space-x-2">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mt-3">
        <div>
          <span className="font-medium">Type:</span> {task.task_type}
        </div>
        {task.scheduled_at && (
          <div>
            <span className="font-medium">Scheduled:</span>{" "}
            {format(new Date(task.scheduled_at), "PPp")}
          </div>
        )}
        {task.estimated_hours && (
          <div>
            <span className="font-medium">Est. Hours:</span> {task.estimated_hours}h
          </div>
        )}
        {task.actual_hours && (
          <div>
            <span className="font-medium">Actual Hours:</span> {task.actual_hours}h
          </div>
        )}
      </div>

      {task.address && (
        <div className="mt-2 text-sm text-slate-600">
          <span className="font-medium">Location:</span> {task.address}
        </div>
      )}

      {showActions && (
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => router.push(`/technician/tasks/${task.id}`)}>
            View
          </Button>
          {canStart && onStart && (
            <Button size="sm" onClick={() => onStart(task.id)}>
              Start
            </Button>
          )}
          {canComplete && onComplete && (
            <Button size="sm" variant="default" onClick={() => onComplete(task.id)}>
              Complete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

