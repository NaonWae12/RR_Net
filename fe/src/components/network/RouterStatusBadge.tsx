import { cn } from "@/lib/utils/styles";
import { RouterStatus } from "@/lib/api/types";

interface RouterStatusBadgeProps {
  status: RouterStatus;
  className?: string;
}

export function RouterStatusBadge({ status, className }: RouterStatusBadgeProps) {
  let colorClass = "";
  let text = "";

  switch (status) {
    case "online":
      colorClass = "bg-green-100 text-green-800";
      text = "Online";
      break;
    case "offline":
      colorClass = "bg-red-100 text-red-800";
      text = "Offline";
      break;
    case "maintenance":
      colorClass = "bg-yellow-100 text-yellow-800";
      text = "Maintenance";
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

