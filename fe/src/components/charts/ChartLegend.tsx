"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface LegendItem {
  name: string;
  color: string;
  value?: number | string;
}

export interface ChartLegendProps {
  items: LegendItem[];
  position?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
}

export function ChartLegend({
  items,
  position = "bottom",
  align = "center",
  className,
}: ChartLegendProps) {
  const getAlignmentClass = () => {
    if (position === "left" || position === "right") {
      return "flex-col";
    }
    switch (align) {
      case "start":
        return "justify-start";
      case "end":
        return "justify-end";
      default:
        return "justify-center";
    }
  };

  return (
    <div
      className={cn(
        "flex gap-4 flex-wrap",
        getAlignmentClass(),
        position === "top" && "mb-4",
        position === "bottom" && "mt-4",
        position === "left" && "mr-4",
        position === "right" && "ml-4",
        className
      )}
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-sm text-slate-600">{item.name}</span>
          {item.value !== undefined && (
            <span className="text-sm font-medium text-slate-900">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

