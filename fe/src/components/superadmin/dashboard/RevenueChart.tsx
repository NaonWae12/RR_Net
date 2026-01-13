"use client";

import * as React from "react";
import { LineChart, BarChart } from "@/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";

export interface RevenueData {
  monthly: {
    month: string;
    revenue: number;
    planRevenue: number;
    addonRevenue: number;
  }[];
  total: number;
  growth: {
    value: number; // percentage
    isPositive: boolean;
  };
  breakdown: {
    plan: number;
    addon: number;
  };
  forecast?: {
    month: string;
    projected: number;
  }[];
}

export interface RevenueChartProps {
  data?: RevenueData;
  loading?: boolean;
  className?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

export const RevenueChart = React.memo<RevenueChartProps>(
  ({ data, loading, className }) => {
    if (loading) {
      return (
        <Card className={className}>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
          </CardContent>
        </Card>
      );
    }

    if (!data) {
      return (
        <Card className={className}>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">No revenue data available</p>
          </CardContent>
        </Card>
      );
    }

    const chartData = data.monthly.map((item) => ({
      month: new Date(item.month).toLocaleDateString("en-US", { month: "short" }),
      revenue: item.revenue,
      plan: item.planRevenue,
      addon: item.addonRevenue,
    }));

    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Revenue Analytics
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(data.total)}</p>
              </div>
              <div className={cn(
                "flex items-center gap-1 px-3 py-1 rounded-full",
                data.growth.isPositive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              )}>
                {data.growth.isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {data.growth.isPositive ? "+" : ""}
                  {data.growth.value}%
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Plan Revenue</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(data.breakdown.plan)}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Addon Revenue</p>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(data.breakdown.addon)}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Monthly Revenue Trend</h4>
              <LineChart
                data={chartData}
                xAxis={{ dataKey: "month", label: "Month" }}
                yAxis={{ dataKey: "revenue", label: "Revenue (IDR)" }}
                lines={[
                  {
                    dataKey: "revenue",
                    name: "Total Revenue",
                    stroke: "#3b82f6",
                    strokeWidth: 2,
                  },
                ]}
                height={250}
              />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Revenue Breakdown</h4>
              <BarChart
                data={chartData}
                xAxisKey="month"
                bars={[
                  { dataKey: "plan", name: "Plan Revenue", fill: "#3b82f6" },
                  { dataKey: "addon", name: "Addon Revenue", fill: "#a855f7" },
                ]}
                height={200}
                grouped
              />
            </div>

            {data.forecast && data.forecast.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Revenue Forecast</h4>
                <div className="space-y-2">
                  {data.forecast.map((item) => (
                    <div key={item.month} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">
                        {new Date(item.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </span>
                      <span className="text-sm font-medium">{formatCurrency(item.projected)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

RevenueChart.displayName = "RevenueChart";

