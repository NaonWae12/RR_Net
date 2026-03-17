"use client";

import * as React from "react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer } from "./ChartContainer";
import { cn } from "@/lib/utils";

export interface GaugeRange {
  from: number;
  to: number;
  color: string;
}

export interface GaugeThreshold {
  value: number;
  color: string;
  label?: string;
}

export interface GaugeChartProps {
  value: number;
  min: number;
  max: number;
  ranges?: GaugeRange[];
  thresholds?: GaugeThreshold[];
  unit?: string;
  animated?: boolean;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  className?: string;
  height?: number;
}

export function GaugeChart({
  value,
  min,
  max,
  ranges = [],
  thresholds = [],
  unit,
  animated = true,
  title,
  subtitle,
  loading = false,
  error,
  className,
  height = 200,
}: GaugeChartProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  const normalizedValue = Math.max(0, Math.min(100, percentage));

  // Create gauge data - 180 degree arc (semi-circle)
  const gaugeData = [
    { name: "filled", value: normalizedValue, fill: "#8884d8" },
    { name: "remaining", value: 100 - normalizedValue, fill: "#e0e0e0" },
  ];

  // Determine color based on ranges or thresholds
  const getColor = () => {
    if (ranges.length > 0) {
      for (const range of ranges) {
        if (value >= range.from && value <= range.to) {
          return range.color;
        }
      }
    }
    if (thresholds.length > 0) {
      for (const threshold of thresholds) {
        if (value >= threshold.value) {
          return threshold.color;
        }
      }
    }
    return "#8884d8";
  };

  const fillColor = getColor();
  gaugeData[0].fill = fillColor;

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      className={className}
    >
      <div className="relative w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="90%"
              startAngle={180}
              endAngle={0}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={0}
              dataKey="value"
              isAnimationActive={animated}
            >
              {gaugeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
          </RechartsPieChart>
        </ResponsiveContainer>
        <div className="absolute inset-x-0 bottom-[10%] flex flex-col items-center justify-center">
          <div className="text-3xl font-bold tracking-tighter">
            {value.toFixed(1)}
            {unit && <span className="text-lg ml-0.5">{unit}</span>}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 -mt-1">
            {min} - {max}
          </p>
        </div>
      </div>
    </ChartContainer>
  );
}

