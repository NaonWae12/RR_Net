"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/feedback/Tooltip";

export interface StatusBadgeProps {
  status: string;
  variant?: "default" | "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
  pulse?: boolean;
  tooltip?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const StatusBadge = React.memo<StatusBadgeProps>(
  ({ status, variant = "default", icon, pulse = false, tooltip, size = "md", className }) => {
    const sizeClasses = {
      sm: "px-2 py-0.5 text-xs",
      md: "px-2.5 py-0.5 text-xs",
      lg: "px-3 py-1 text-sm",
    };
    const variantClasses = {
      default: "bg-slate-100 text-slate-700 ring-slate-200",
      success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      warning: "bg-amber-50 text-amber-700 ring-amber-200",
      error: "bg-rose-50 text-rose-700 ring-rose-200",
      info: "bg-blue-50 text-blue-700 ring-blue-200",
    };

    const badge = (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
          sizeClasses[size],
          variantClasses[variant],
          pulse && "animate-pulse",
          className
        )}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {status}
      </span>
    );

    if (tooltip) {
      return <Tooltip content={tooltip}>{badge}</Tooltip>;
    }

    return badge;
  }
);

StatusBadge.displayName = "StatusBadge";

