"use client";

import * as React from "react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer, LegendConfig, TooltipConfig } from "./ChartContainer";

export interface PieChartData {
  [key: string]: any;
  name: string;
  value: number;
  color?: string;
}

export interface PieChartProps {
  data: PieChartData[];
  donut?: boolean;
  explode?: number[];
  showPercentages?: boolean;
  legend?: LegendConfig;
  colors?: string[];
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  tooltip?: TooltipConfig;
  className?: string;
  height?: number;
}

const RADIAN = Math.PI / 180;

export const PieChart = React.memo(function PieChart({
  data,
  donut = false,
  explode = [],
  showPercentages = true,
  legend = { show: true, position: "right" },
  colors,
  title,
  subtitle,
  loading = false,
  error,
  tooltip = { show: true },
  className,
  height = 300,
}: PieChartProps) {
  const defaultColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6))",
  ];
  const chartColors = colors || defaultColors;

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    name,
  }: any) => {
    if (!showPercentages) return null;

    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const renderCustomizedLabel = (entry: any, index: number) => {
    if (explode.includes(index)) {
      return { ...entry, outerRadius: entry.outerRadius * 1.1 };
    }
    return entry;
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
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={donut ? 80 : 100}
            innerRadius={donut ? 40 : 0}
            fill="#8884d8"
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
          >
            {data.map((entry, index) => {
              const isExploded = explode.includes(index);
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || chartColors[index % chartColors.length]}
                  style={{
                    transform: isExploded ? "scale(1.1)" : "scale(1)",
                    transformOrigin: "center",
                  }}
                />
              );
            })}
          </Pie>
          {tooltip?.show && (
            <Tooltip
              formatter={(value: any, name?: any) => {
                const v = typeof value === "number" ? value : Number(value || 0);
                const label = typeof name === "string" ? name : String(name ?? "");
                return [`${v} (${total ? ((v / total) * 100).toFixed(1) : "0.0"}%)`, label];
              }}
            />
          )}
          {legend?.show && (
            <Legend
              verticalAlign={legend.position === "top" ? "top" : legend.position === "bottom" ? "bottom" : "middle"}
              align={legend.align || "center"}
              layout={legend.position === "left" || legend.position === "right" ? "vertical" : "horizontal"}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
});

PieChart.displayName = "PieChart";

