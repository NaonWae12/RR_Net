import { cn } from "@/lib/utils/styles";
import { TaskPriority } from "@/lib/api/types";

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

export function TaskPriorityBadge({ priority, className }: TaskPriorityBadgeProps) {
  let colorClass = "";
  let text = "";

  switch (priority) {
    case "low":
      colorClass = "bg-gray-100 text-gray-800";
      text = "Low";
      break;
    case "normal":
      colorClass = "bg-blue-100 text-blue-800";
      text = "Normal";
      break;
    case "high":
      colorClass = "bg-orange-100 text-orange-800";
      text = "High";
      break;
    case "critical":
      colorClass = "bg-red-100 text-red-800";
      text = "Critical";
      break;
    default:
      colorClass = "bg-gray-100 text-gray-800";
      text = "Normal";
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

