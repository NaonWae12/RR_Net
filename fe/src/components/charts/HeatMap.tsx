"use client";

import * as React from "react";
import { ChartContainer } from "./ChartContainer";
import { cn } from "@/lib/utils";

export interface HeatMapData {
  x: string;
  y: string;
  value: number;
}

export interface HeatMapProps {
  data: HeatMapData[];
  xLabels: string[];
  yLabels: string[];
  colorScale?: string[];
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  className?: string;
  cellSize?: number;
}

export function HeatMap({
  data,
  xLabels,
  yLabels,
  colorScale = ["#f0f0f0", "#ffcccc", "#ff6666", "#ff0000", "#cc0000"],
  title,
  subtitle,
  loading = false,
  error,
  className,
  cellSize = 40,
}: HeatMapProps) {
  // Create a map for quick lookup
  const dataMap = new Map<string, number>();
  data.forEach((item) => {
    dataMap.set(`${item.x}-${item.y}`, item.value);
  });

  // Find min and max values for color scaling
  const values = data.map((item) => item.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const getColor = (value: number) => {
    const normalizedValue = (value - minValue) / range;
    const colorIndex = Math.floor(normalizedValue * (colorScale.length - 1));
    return colorScale[colorIndex];
  };

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      className={className}
    >
      <div className="w-full overflow-x-auto">
        <div className="inline-block min-w-full">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left"></th>
                {xLabels.map((label) => (
                  <th key={label} className="p-2 text-center text-sm font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yLabels.map((yLabel) => (
                <tr key={yLabel}>
                  <td className="p-2 text-sm font-medium">{yLabel}</td>
                  {xLabels.map((xLabel) => {
                    const value = dataMap.get(`${xLabel}-${yLabel}`) || 0;
                    const color = getColor(value);
                    return (
                      <td
                        key={`${xLabel}-${yLabel}`}
                        className="p-1"
                        style={{
                          width: cellSize,
                          height: cellSize,
                        }}
                      >
                        <div
                          className={cn(
                            "w-full h-full rounded flex items-center justify-center text-xs font-medium",
                            value === 0 && "bg-gray-100 text-gray-400"
                          )}
                          style={{
                            backgroundColor: value > 0 ? color : undefined,
                            color: value > 0 ? (color === colorScale[0] ? "#000" : "#fff") : undefined,
                          }}
                          title={`${xLabel} - ${yLabel}: ${value}`}
                        >
                          {value > 0 && value}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="text-xs text-slate-600">Less</span>
        {colorScale.map((color, index) => (
          <div
            key={index}
            className="w-4 h-4 rounded"
            style={{ backgroundColor: color }}
          />
        ))}
        <span className="text-xs text-slate-600">More</span>
      </div>
    </ChartContainer>
  );
}

