"use client";

import * as React from "react";
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer, LegendConfig, TooltipConfig } from "./ChartContainer";
import { cn } from "@/lib/utils";

export interface AxisConfig {
  label?: string;
  dataKey: string;
  type?: "number" | "category";
  tickFormatter?: (value: any) => string;
}

export interface AreaConfig {
  dataKey: string;
  name: string;
  color?: string;
  strokeWidth?: number;
  type?: "linear" | "monotone" | "step";
  fillOpacity?: number;
}

export interface AreaChartProps {
  data: any[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  areas: AreaConfig[];
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  legend?: LegendConfig;
  tooltip?: TooltipConfig;
  className?: string;
  height?: number;
}

export const AreaChart = React.memo(function AreaChart({
  data,
  xAxis,
  yAxis,
  areas,
  title,
  subtitle,
  loading = false,
  error,
  legend = { show: true, position: "top" },
  tooltip = { show: true },
  className,
  height = 300,
}: AreaChartProps) {
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
        <RechartsAreaChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
        >
          <defs>
            {areas.map((area, index) => (
              <linearGradient
                key={`gradient-${area.dataKey}`}
                id={`color-${area.dataKey}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={area.color || `hsl(var(--chart-${index + 1}))`}
                  stopOpacity={area.fillOpacity || 0.3}
                />
                <stop
                  offset="95%"
                  stopColor={area.color || `hsl(var(--chart-${index + 1}))`}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey={xAxis.dataKey}
            type={xAxis.type}
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e1' }}
            tickFormatter={xAxis.tickFormatter}
            minTickGap={30}
          />
          <YAxis
            tickFormatter={yAxis.tickFormatter}
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e1' }}
            width={70}
          />
          {tooltip?.show && (
            <Tooltip
              cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              formatter={tooltip.formatter}
              labelFormatter={tooltip.labelFormatter}
            />
          )}
          {legend?.show && (
            <Legend
              verticalAlign={legend.position === "top" ? "top" : "bottom"}
              align={legend.align || "center"}
            />
          )}
          {areas.map((area, index) => (
            <Area
              key={area.dataKey}
              type={area.type || "monotone"}
              dataKey={area.dataKey}
              name={area.name}
              stroke={area.color || `hsl(var(--chart-${index + 1}))`}
              strokeWidth={area.strokeWidth || 3}
              fillOpacity={1}
              fill={`url(#color-${area.dataKey})`}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
});

AreaChart.displayName = "AreaChart";
