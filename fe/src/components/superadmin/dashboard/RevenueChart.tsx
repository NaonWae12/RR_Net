"use client";

import * as React from "react";
import { LineChart, BarChart } from "@/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, BarChart3, LineChart as LineIcon } from "lucide-react";
import { motion } from "framer-motion";

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

import { formatCurrency } from "@/lib/utils";

export const RevenueChart = React.memo<RevenueChartProps>(
  ({ data, loading, className }) => {
    if (loading) {
      return (
        <Card className={cn("overflow-hidden border-none shadow-sm", className)}>
          <CardHeader className="pb-2">
            <div className="h-6 bg-slate-100 animate-pulse rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="h-64 bg-slate-50 animate-pulse rounded-xl"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-20 bg-slate-50 animate-pulse rounded-xl"></div>
                <div className="h-20 bg-slate-50 animate-pulse rounded-xl"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!data) {
      return (
        <Card className={cn("p-6 text-center border-dashed", className)}>
          <DollarSign className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No revenue data available</p>
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
      <Card className={cn("overflow-hidden border-none shadow-sm h-full", className)}>
        <CardHeader className="pb-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <DollarSign className="h-4 w-4" />
              </div>
              Revenue Performance
            </CardTitle>
            <p className="text-xs text-slate-400 font-medium">Tracking growth and distribution</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Revenue</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold tracking-tight text-slate-900">{formatCurrency(data.total, true)}</p>
                <div className={cn("flex items-center text-xs font-bold", data.growth.isPositive ? "text-green-600" : "text-red-600")}>
                  {data.growth.isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {data.growth.value}%
                </div>
              </div>
            </div>
            <button className="p-2 hover:bg-slate-50 rounded-lg transition-colors border border-slate-100">
              <TrendingUp size={16} className="text-slate-400" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div whileHover={{ y: -2 }} className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                <h4 className="text-[10px] uppercase font-bold text-blue-500 tracking-wider mb-1">Plan Subscriptions</h4>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(data.breakdown.plan)}</p>
                <div className="mt-2 h-1 w-full bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(data.breakdown.plan / data.total) * 100}%` }} />
                </div>
              </motion.div>
              <motion.div whileHover={{ y: -2 }} className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl">
                <h4 className="text-[10px] uppercase font-bold text-purple-500 tracking-wider mb-1">Add-on Upgrades</h4>
                <p className="text-xl font-bold text-purple-700">{formatCurrency(data.breakdown.addon)}</p>
                <div className="mt-2 h-1 w-full bg-purple-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(data.breakdown.addon / data.total) * 100}%` }} />
                </div>
              </motion.div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <LineIcon size={14} /> Monthly Growth
              </h4>
              <div className="bg-slate-50/50 rounded-xl p-4">
                <LineChart
                  data={chartData}
                  xAxis={{ dataKey: "month" }}
                  yAxis={{ dataKey: "revenue" }}
                  lines={[
                    {
                      dataKey: "revenue",
                      name: "Monthly Revenue",
                      stroke: "#10b981",
                      strokeWidth: 4,
                    },
                  ]}
                  tooltip={{
                    show: true,
                    formatter: (value: any) => [formatCurrency(Number(value), false, true), "Revenue"]
                  }}
                  height={250}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <BarChart3 size={14} /> Source Comparison
              </h4>
              <div className="bg-slate-50/50 rounded-xl p-4">
                <BarChart
                  data={chartData}
                  xAxisKey="month"
                  bars={[
                    { dataKey: "plan", name: "Plans", fill: "#3b82f6", radius: [4, 4, 0, 0] },
                    { dataKey: "addon", name: "Add-ons", fill: "#8b5cf6", radius: [4, 4, 0, 0] },
                  ]}
                  tooltip={{
                    show: true,
                    formatter: (value: any, name: any) => [formatCurrency(Number(value), false, true), name]
                  }}
                  height={200}
                  grouped
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

RevenueChart.displayName = "RevenueChart";


RevenueChart.displayName = "RevenueChart";

