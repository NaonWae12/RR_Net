import { cn } from "@/lib/utils/styles";
import { TaskStatus } from "@/lib/api/types";

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  let colorClass = "";
  let text = "";

  switch (status) {
    case "pending":
      colorClass = "bg-yellow-100 text-yellow-800";
      text = "Pending";
      break;
    case "in_progress":
      colorClass = "bg-blue-100 text-blue-800";
      text = "In Progress";
      break;
    case "completed":
      colorClass = "bg-green-100 text-green-800";
      text = "Completed";
      break;
    case "cancelled":
      colorClass = "bg-gray-100 text-gray-800";
      text = "Cancelled";
      break;
    default:
      colorClass = "bg-gray-100 text-gray-800";
      text = "Unknown";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10",
        colorClass,
        className
      )}
    >
      {text}
    </span>
  );
}

