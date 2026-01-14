"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Alert } from "@/components/ui/alert";

export interface LegendConfig {
  show?: boolean;
  position?: "top" | "bottom" | "left" | "right";
  align?: "left" | "center" | "right";
}

export interface TooltipConfig {
  show?: boolean;
  // Match Recharts Tooltip formatter signature loosely (name can be undefined)
  formatter?: (value: any, name?: string, ...args: any[]) => any;
}

export interface ChartContainerProps {
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  legend?: LegendConfig;
  tooltip?: TooltipConfig;
  exportable?: boolean;
  theme?: "light" | "dark";
  className?: string;
  children: React.ReactNode;
  onExport?: (format: "png" | "svg" | "pdf") => void;
}

export function ChartContainer({
  title,
  subtitle,
  loading = false,
  error,
  legend,
  tooltip,
  exportable = false,
  theme = "light",
  className,
  children,
  onExport,
}: ChartContainerProps) {
  const chartRef = React.useRef<HTMLDivElement>(null);

  const handleExport = (format: "png" | "svg" | "pdf") => {
    if (!chartRef.current || !onExport) return;
    onExport(format);
  };

  if (loading) {
    return (
      <div className={cn("flex justify-center items-center h-64", className)}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4", className)}>
        <Alert variant="destructive">
          <p className="text-sm">{error}</p>
        </Alert>
      </div>
    );
  }

  return (
    <div
      ref={chartRef}
      className={cn(
        "w-full rounded-lg border bg-card p-4",
        theme === "dark" && "bg-slate-900 text-slate-50",
        className
      )}
    >
      {(title || subtitle || exportable) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <h3 className={cn("text-lg font-semibold", theme === "dark" && "text-slate-50")}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p className={cn("text-sm text-slate-600", theme === "dark" && "text-slate-400")}>
                {subtitle}
              </p>
            )}
          </div>
          {exportable && onExport && (
            <div className="flex gap-2">
              <button
                onClick={() => handleExport("png")}
                className="text-xs px-2 py-1 rounded border hover:bg-muted"
              >
                PNG
              </button>
              <button
                onClick={() => handleExport("svg")}
                className="text-xs px-2 py-1 rounded border hover:bg-muted"
              >
                SVG
              </button>
            </div>
          )}
        </div>
      )}
      <div className="w-full">{children}</div>
    </div>
  );
}

