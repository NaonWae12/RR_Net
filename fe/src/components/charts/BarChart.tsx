"use client";

import * as React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartContainer, LegendConfig, TooltipConfig } from "./ChartContainer";
import { cn } from "@/lib/utils";

export interface ChartData {
  [key: string]: any;
}

export interface BarChartProps {
  data: ChartData[];
  orientation?: "vertical" | "horizontal";
  grouped?: boolean;
  stacked?: boolean;
  animated?: boolean;
  showValues?: boolean;
  colorScheme?: string[];
  xAxisKey: string;
  bars: Array<{
    dataKey: string;
    name: string;
    fill?: string;
    stackId?: string;
  }>;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  legend?: LegendConfig;
  tooltip?: TooltipConfig;
  className?: string;
  height?: number;
}

export const BarChart = React.memo(function BarChart({
  data,
  orientation = "vertical",
  grouped = false,
  stacked = false,
  animated = true,
  showValues = false,
  colorScheme,
  xAxisKey,
  bars,
  title,
  subtitle,
  loading = false,
  error,
  legend = { show: true, position: "top" },
  tooltip = { show: true },
  className,
  height = 300,
}: BarChartProps) {
  const defaultColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];
  const colors = colorScheme || defaultColors;

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      legend={legend}
      tooltip={tooltip}
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={orientation === "horizontal" ? "vertical" : "horizontal"}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          {orientation === "vertical" ? (
            <>
              <XAxis dataKey={xAxisKey} />
              <YAxis />
            </>
          ) : (
            <>
              <XAxis type="number" />
              <YAxis dataKey={xAxisKey} type="category" width={100} />
            </>
          )}
          {tooltip?.show && (
            <Tooltip
              formatter={tooltip.formatter}
              cursor={{ fill: "rgba(0, 0, 0, 0.1)" }}
            />
          )}
          {legend?.show && (
            <Legend
              verticalAlign={legend.position === "top" ? "top" : legend.position === "bottom" ? "bottom" : "top"}
              align={legend.align || "center"}
            />
          )}
          {bars.map((bar, index) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name}
              fill={bar.fill || colors[index % colors.length]}
              stackId={stacked ? bar.stackId || "stack" : undefined}
              isAnimationActive={animated}
              label={showValues ? { position: orientation === "vertical" ? "top" : "right" } : false}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
});

BarChart.displayName = "BarChart";

