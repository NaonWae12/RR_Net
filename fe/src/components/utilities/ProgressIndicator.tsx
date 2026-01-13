"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressIndicatorProps {
  value: number;
  max: number;
  type?: "linear" | "circular";
  showPercentage?: boolean;
  color?: string;
  animated?: boolean;
  steps?: string[];
  className?: string;
}

export const ProgressIndicator = React.memo<ProgressIndicatorProps>(function ProgressIndicator({
  value,
  max,
  type = "linear",
  showPercentage = true,
  color,
  animated = false,
  steps,
  className,
}: ProgressIndicatorProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  if (type === "circular") {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className={cn("relative inline-flex items-center justify-center", className)}>
        <svg className="transform -rotate-90 w-20 h-20">
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-muted"
          />
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            stroke={color || "currentColor"}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn("transition-all duration-300", animated && "animate-pulse")}
            style={{
              strokeLinecap: "round",
            }}
          />
        </svg>
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-medium">{Math.round(percentage)}%</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-1", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {steps && steps.length > 0 ? (
          <span>{steps[Math.floor((percentage / 100) * steps.length)]}</span>
        ) : (
          <span>Progress</span>
        )}
        {showPercentage && <span>{Math.round(percentage)}%</span>}
      </div>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            animated && "animate-pulse"
          )}
          style={{
            width: `${percentage}%`,
            backgroundColor: color || "hsl(var(--primary))",
          }}
        />
      </div>
    </div>
  );
});

ProgressIndicator.displayName = "ProgressIndicator";

