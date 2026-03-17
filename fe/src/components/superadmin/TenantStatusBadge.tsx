import { cn } from "@/lib/utils";
import type { SuperAdminTenant } from "@/lib/api/types";

interface TenantStatusBadgeProps {
  status: SuperAdminTenant["status"] | string;
  className?: string;
  size?: "sm" | "md";
}

export function TenantStatusBadge({ status, className, size = "md" }: TenantStatusBadgeProps) {
  const config = {
    active: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
      label: "Active",
      border: "border-emerald-100",
    },
    suspended: {
      bg: "bg-red-50",
      text: "text-red-700",
      dot: "bg-red-500",
      label: "Suspended",
      border: "border-red-100",
    },
    pending: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-500",
      label: "Pending",
      border: "border-amber-100",
    },
    deleted: {
      bg: "bg-slate-50",
      text: "text-slate-700",
      dot: "bg-slate-400",
      label: "Deleted",
      border: "border-slate-200",
    },
  }[status as keyof typeof config] || {
    bg: "bg-slate-50",
    text: "text-slate-700",
    dot: "bg-slate-400",
    label: status,
    border: "border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold tracking-tight transition-all",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", config.dot)} />
      {config.label}
    </span>
  );
}

