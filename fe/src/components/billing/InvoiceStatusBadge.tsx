import { cn } from "@/lib/utils/styles";
import { InvoiceStatus } from "@/lib/api/types";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  let colorClass = "";
  let text = "";

  switch (status) {
    case "draft":
      colorClass = "bg-gray-100 text-gray-800";
      text = "Draft";
      break;
    case "pending":
      colorClass = "bg-yellow-100 text-yellow-800";
      text = "Pending";
      break;
    case "paid":
      colorClass = "bg-green-100 text-green-800";
      text = "Paid";
      break;
    case "overdue":
      colorClass = "bg-red-100 text-red-800";
      text = "Overdue";
      break;
    case "cancelled":
      colorClass = "bg-gray-100 text-gray-500";
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

