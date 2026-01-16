import { cn } from "@/lib/utils/styles";
import { RouterStatus } from "@/lib/api/types";

interface RouterStatusBadgeProps {
  status: RouterStatus;
  className?: string;
}

export function RouterStatusBadge({ status, className }: RouterStatusBadgeProps) {
  let colorClass = "";
  let text: React.ReactNode = "";

  switch (status) {
    case "online":
      colorClass = "bg-emerald-100 text-emerald-800 ring-emerald-600/20";
      text = (
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Online
        </span>
      );
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

