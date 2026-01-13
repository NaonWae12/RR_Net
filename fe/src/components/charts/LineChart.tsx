"use client";

import * as React from "react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ChartContainer, LegendConfig, TooltipConfig } from "./ChartContainer";
import { cn } from "@/lib/utils";

export interface AxisConfig {
  label?: string;
  dataKey: string;
  type?: "number" | "category";
  domain?: [number | string, number | string] | [number | string, number | string, "dataMin" | "dataMax"];
  tickFormatter?: (value: any) => string;
}

export interface LineConfig {
  dataKey: string;
  name: string;
  stroke?: string;
  strokeWidth?: number;
  dot?: boolean;
  activeDot?: boolean;
  type?: "linear" | "monotone" | "step" | "stepBefore" | "stepAfter";
}

export interface Annotation {
  type: "line" | "area";
  value: number | string;
  label?: string;
  stroke?: string;
  strokeDasharray?: string;
}

export interface LineChartProps {
  data: any[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  lines: LineConfig[];
  annotations?: Annotation[];
  zoomable?: boolean;
  crosshair?: boolean;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  legend?: LegendConfig;
  tooltip?: TooltipConfig;
  className?: string;
  height?: number;
}

export const LineChart = React.memo(function LineChart({
  data,
  xAxis,
  yAxis,
  lines,
  annotations,
  zoomable = false,
  crosshair = true,
  title,
  subtitle,
  loading = false,
  error,
  legend = { show: true, position: "top" },
  tooltip = { show: true },
  className,
  height = 300,
}: LineChartProps) {
  const [zoomDomain, setZoomDomain] = React.useState<[number, number] | undefined>();

  const handleZoom = (e: any) => {
    if (zoomable && e?.activeLabel) {
      // Simple zoom implementation - can be enhanced
      const index = data.findIndex((item) => item[xAxis.dataKey] === e.activeLabel);
      if (index !== -1) {
        const start = Math.max(0, index - 5);
        const end = Math.min(data.length - 1, index + 5);
        setZoomDomain([start, end]);
      }
    }
  };

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
        <RechartsLineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onMouseMove={handleZoom}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={xAxis.dataKey}
            type={xAxis.type}
            label={xAxis.label ? { value: xAxis.label, position: "insideBottom", offset: -5 } : undefined}
            tickFormatter={xAxis.tickFormatter}
            domain={xAxis.domain as any}
          />
          <YAxis
            label={yAxis.label ? { value: yAxis.label, angle: -90, position: "insideLeft" } : undefined}
            tickFormatter={yAxis.tickFormatter}
            domain={yAxis.domain as any}
          />
          {tooltip?.show && (
            <Tooltip
              cursor={crosshair ? { stroke: "#8884d8", strokeWidth: 1 } : false}
              formatter={tooltip.formatter}
            />
          )}
          {legend?.show && (
            <Legend
              verticalAlign={legend.position === "top" ? "top" : legend.position === "bottom" ? "bottom" : "top"}
              align={legend.align || "center"}
            />
          )}
          {annotations?.map((annotation, index) => (
            <ReferenceLine
              key={index}
              x={annotation.value}
              stroke={annotation.stroke || "#888"}
              strokeDasharray={annotation.strokeDasharray}
              label={annotation.label}
            />
          ))}
          {lines.map((line, index) => (
            <Line
              key={line.dataKey}
              type={line.type || "monotone"}
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.stroke || `hsl(var(--chart-${index + 1}))`}
              strokeWidth={line.strokeWidth || 2}
              dot={line.dot !== false}
              activeDot={line.activeDot !== false ? { r: 6 } : false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
});

LineChart.displayName = "LineChart";

