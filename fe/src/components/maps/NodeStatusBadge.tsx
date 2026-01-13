import { cn } from "@/lib/utils/styles";
import { NodeStatus } from "@/lib/api/types";

interface NodeStatusBadgeProps {
  status: NodeStatus;
  className?: string;
}

export function NodeStatusBadge({ status, className }: NodeStatusBadgeProps) {
  let colorClass = "";
  let text = "";

  switch (status) {
    case "ok":
      colorClass = "bg-green-100 text-green-800";
      text = "OK";
      break;
    case "warning":
      colorClass = "bg-yellow-100 text-yellow-800";
      text = "Warning";
      break;
    case "full":
      colorClass = "bg-orange-100 text-orange-800";
      text = "Full";
      break;
    case "outage":
      colorClass = "bg-red-100 text-red-800";
      text = "Outage";
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

