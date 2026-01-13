import { cn } from "@/lib/utils";
import type { SuperAdminTenant } from "@/lib/api/types";

interface TenantStatusBadgeProps {
  status: SuperAdminTenant["status"];
  className?: string;
}

export function TenantStatusBadge({ status, className }: TenantStatusBadgeProps) {
  let colorClass = "";
  let text = "";

  switch (status) {
    case "active":
      colorClass = "bg-green-100 text-green-800";
      text = "Active";
      break;
    case "suspended":
      colorClass = "bg-red-100 text-red-800";
      text = "Suspended";
      break;
    case "pending":
      colorClass = "bg-yellow-100 text-yellow-800";
      text = "Pending";
      break;
    case "deleted":
      colorClass = "bg-gray-100 text-gray-800";
      text = "Deleted";
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

