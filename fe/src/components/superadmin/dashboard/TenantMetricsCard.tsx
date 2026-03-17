"use client";

import * as React from "react";
import { PieChart, LineChart } from "@/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Users, TrendingUp, AlertCircle, PieChart as PieIcon, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

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

const StatBox = ({ label, value, colorClass, icon: Icon }: { label: string; value: number; colorClass: string; icon: any }) => (
  <motion.div 
    whileHover={{ y: -2 }}
    className={cn("flex flex-col p-4 rounded-xl border border-slate-100 bg-white shadow-sm transition-all", colorClass)}
  >
    <div className="flex items-center gap-2 mb-2 text-slate-500">
      <Icon size={14} />
      <span className="text-[10px] uppercase font-bold tracking-wider">{label}</span>
    </div>
    <div className="text-2xl font-bold tracking-tight">{value}</div>
  </motion.div>
);

export const TenantMetricsCard = React.memo<TenantMetricsCardProps>(
  ({ data, loading, className }) => {
    if (loading) {
      return (
        <Card className={cn("overflow-hidden border-none shadow-sm", className)}>
          <CardHeader className="pb-2">
            <div className="h-6 bg-slate-100 animate-pulse rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="h-20 bg-slate-50 animate-pulse rounded-xl"></div>
                <div className="h-20 bg-slate-50 animate-pulse rounded-xl"></div>
                <div className="h-20 bg-slate-50 animate-pulse rounded-xl"></div>
              </div>
              <div className="h-40 bg-slate-50 animate-pulse rounded-xl"></div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!data) {
      return (
        <Card className={cn("p-6 text-center border-dashed", className)}>
          <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No tenant data available</p>
        </Card>
      );
    }

    const pieData = data.planDistribution.map((item, index) => ({
      name: item.planName,
      value: item.count,
      fill: item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`, // Better color distribution
    }));

    const lineData = data.growthTrend.map((item) => ({
      date: new Date(item.date).toLocaleDateString("en-US", { month: "short" }),
      count: item.count,
    }));

    return (
      <Card className={cn("overflow-hidden border-none shadow-sm h-full", className)}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Users className="h-4 w-4" />
            </div>
            Tenant Metrics
          </CardTitle>
          <div className={cn("flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full", 
            data.growth.isPositive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
          )}>
            {data.growth.isPositive ? <TrendingUp size={12} /> : <AlertCircle size={12} />}
            {data.growth.isPositive ? "+" : ""}{data.growth.value}%
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Total" value={data.total} icon={Users} colorClass="hover:border-blue-200" />
              <StatBox label="Active" value={data.active} icon={TrendingUp} colorClass="hover:border-green-200 text-green-600" />
              <StatBox label="Hold" value={data.suspended} icon={AlertCircle} colorClass="hover:border-red-200 text-red-600" />
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <PieIcon size={14} /> Plan Distribution
                </h4>
                <div className="bg-slate-50/50 rounded-xl p-6 min-h-[300px] flex items-center justify-center">
                  <PieChart
                    data={pieData}
                    height={250}
                    donut
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <BarChart3 size={14} /> Registration Trend
                </h4>
                <div className="bg-slate-50/50 rounded-xl p-4 min-h-[250px]">
                  <LineChart
                    data={lineData}
                    xAxis={{ dataKey: "date" }}
                    yAxis={{ dataKey: "count" }}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    lines={[
                      {
                        dataKey: "count",
                        name: "Tenants",
                        stroke: "#8b5cf6",
                        strokeWidth: 3,
                      },
                    ]}
                    height={220}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

TenantMetricsCard.displayName = "TenantMetricsCard";


TenantMetricsCard.displayName = "TenantMetricsCard";

