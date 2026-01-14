"use client";

import * as React from "react";
import { PieChart, LineChart } from "@/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Users, TrendingUp, AlertCircle } from "lucide-react";

export interface TenantMetricsData {
  total: number;
  active: number;
  suspended: number;
  growth: {
    value: number; // percentage
    isPositive: boolean;
  };
  planDistribution: {
    planName: string;
    count: number;
    color?: string;
  }[];
  growthTrend: {
    date: string;
    count: number;
  }[];
}

export interface TenantMetricsCardProps {
  data?: TenantMetricsData;
  loading?: boolean;
  className?: string;
}

export const TenantMetricsCard = React.memo<TenantMetricsCardProps>(
  ({ data, loading, className }) => {
    if (loading) {
      return (
        <Card className={className}>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
          </CardContent>
        </Card>
      );
    }

    if (!data) {
      return (
        <Card className={className}>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">No tenant data available</p>
          </CardContent>
        </Card>
      );
    }

    const pieData = data.planDistribution.map((item, index) => ({
      name: item.planName,
      value: item.count,
      fill: item.color || `hsl(${(index * 360) / data.planDistribution.length}, 70%, 50%)`,
    }));

    const lineData = data.growthTrend.map((item) => ({
      date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: item.count,
    }));

    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tenant Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-slate-100 rounded-lg">
                  <p className="text-2xl font-bold text-slate-900">{data.total}</p>
                  <p className="text-xs text-slate-600 mt-1">Total</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{data.active}</p>
                  <p className="text-xs text-green-700 mt-1">Active</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{data.suspended}</p>
                  <p className="text-xs text-red-700 mt-1">Suspended</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-lg">
                {data.growth.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">
                  <span className={cn("font-medium", data.growth.isPositive ? "text-green-600" : "text-red-600")}>
                    {data.growth.isPositive ? "+" : ""}
                    {data.growth.value}%
                  </span>
                  <span className="text-slate-600 ml-1">growth this month</span>
                </span>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2 text-slate-900">Plan Distribution</h4>
                <PieChart
                  data={pieData}
                  height={200}
                  donut
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 text-slate-900">Growth Trend</h4>
              <LineChart
                data={lineData}
                xAxis={{ dataKey: "date", label: "Date" }}
                yAxis={{ dataKey: "count", label: "Tenants" }}
                lines={[
                  {
                    dataKey: "count",
                    name: "Total Tenants",
                    stroke: "#3b82f6",
                    strokeWidth: 2,
                  },
                ]}
                height={250}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

TenantMetricsCard.displayName = "TenantMetricsCard";

