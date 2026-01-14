"use client";

import * as React from "react";
import { GaugeChart } from "@/components/charts";
import { StatusBadge } from "@/components/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, Server, Database, AlertTriangle } from "lucide-react";

export interface SystemHealthData {
  overallScore: number; // 0-100
  services: {
    name: string;
    status: "healthy" | "degraded" | "down";
    uptime: number; // percentage
  }[];
  resources: {
    cpu: number; // percentage
    memory: number; // percentage
    disk: number; // percentage
  };
}

export interface SystemHealthCardProps {
  data?: SystemHealthData;
  loading?: boolean;
  className?: string;
}

export const SystemHealthCard = React.memo<SystemHealthCardProps>(
  ({ data, loading, className }) => {
    if (loading) {
      return (
        <Card className={cn("p-6", className)}>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </Card>
      );
    }

    if (!data) {
      return (
        <Card className={cn("p-6", className)}>
          <p className="text-sm text-slate-600">No health data available</p>
        </Card>
      );
    }

    const getStatusColor = (score: number) => {
      if (score >= 80) return "text-green-600";
      if (score >= 50) return "text-yellow-600";
      return "text-red-600";
    };

    const getStatusVariant = (status: string) => {
      switch (status) {
        case "healthy":
          return "success";
        case "degraded":
          return "warning";
        case "down":
          return "error";
        default:
          return "info";
      }
    };

    const chartData = [
      { name: "Score", value: data.overallScore, fill: data.overallScore >= 80 ? "#10b981" : data.overallScore >= 50 ? "#f59e0b" : "#ef4444" },
    ];

    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <StatusBadge
              status={data.overallScore >= 80 ? "Healthy" : data.overallScore >= 50 ? "Degraded" : "Critical"}
              variant={getStatusVariant(data.overallScore >= 80 ? "healthy" : data.overallScore >= 50 ? "degraded" : "down")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <GaugeChart
                height={150}
                title="Overall Health Score"
                value={data.overallScore}
                min={0}
                max={100}
                ranges={[
                  { from: 0, to: 50, color: "#ef4444" },
                  { from: 50, to: 80, color: "#f59e0b" },
                  { from: 80, to: 100, color: "#10b981" },
                ]}
              />
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-slate-900">
                  <Server className="h-4 w-4 text-slate-700" />
                  Services Status
                </h4>
                <div className="space-y-2">
                  {data.services.map((service) => (
                    <div key={service.name} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{service.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{service.uptime}% uptime</span>
                        <StatusBadge status={service.status} variant={getStatusVariant(service.status)} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-slate-900">
                  <Database className="h-4 w-4 text-slate-700" />
                  Resource Usage
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">CPU</span>
                    <span className={cn("font-medium", getStatusColor(100 - data.resources.cpu))}>
                      {data.resources.cpu}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">Memory</span>
                    <span className={cn("font-medium", getStatusColor(100 - data.resources.memory))}>
                      {data.resources.memory}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">Disk</span>
                    <span className={cn("font-medium", getStatusColor(100 - data.resources.disk))}>
                      {data.resources.disk}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

SystemHealthCard.displayName = "SystemHealthCard";

