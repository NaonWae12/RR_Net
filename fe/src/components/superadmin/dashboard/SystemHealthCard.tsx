"use client";

import * as React from "react";
import { GaugeChart } from "@/components/charts";
import { StatusBadge } from "@/components/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, Server, Database, Zap, Cpu, HardDrive } from "lucide-react";
import { motion } from "framer-motion";

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

const ProgressBar = ({ value, label, icon: Icon, colorClass }: { value: number; label: string; icon: any; colorClass: string }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-sm">
      <div className="flex items-center gap-2 text-slate-600">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <span className={cn("font-bold", value > 80 ? "text-red-500" : value > 60 ? "text-orange-500" : "text-green-600")}>
        {value}%
      </span>
    </div>
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={cn("h-full rounded-full", colorClass)}
      />
    </div>
  </div>
);

export const SystemHealthCard = React.memo<SystemHealthCardProps>(
  ({ data, loading, className }) => {
    if (loading) {
      return (
        <Card className={cn("overflow-hidden border-none shadow-sm", className)}>
          <CardHeader className="pb-2">
            <div className="h-6 bg-slate-100 animate-pulse rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="h-32 bg-slate-50 animate-pulse rounded-xl"></div>
              <div className="space-y-3">
                <div className="h-4 bg-slate-100 animate-pulse rounded w-full"></div>
                <div className="h-4 bg-slate-100 animate-pulse rounded w-full"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!data) {
      return (
        <Card className={cn("p-6 text-center border-dashed", className)}>
          <Activity className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No health data available</p>
        </Card>
      );
    }

    const getStatusVariant = (status: string) => {
      switch (status) {
        case "healthy": return "success";
        case "degraded": return "warning";
        case "down": return "error";
        default: return "info";
      }
    };

    return (
      <Card className={cn("overflow-hidden border-none shadow-sm h-full", className)}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Activity className="h-4 w-4" />
            </div>
            System Health
          </CardTitle>
          <StatusBadge
            status={data.overallScore >= 80 ? "Optimal" : data.overallScore >= 50 ? "Degraded" : "Critical"}
            variant={getStatusVariant(data.overallScore >= 80 ? "healthy" : data.overallScore >= 50 ? "degraded" : "down")}
          />
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-8">
            <div className="flex justify-center py-4 bg-slate-50/50 rounded-xl">
              <GaugeChart
                height={180}
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

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Zap size={14} /> Critical Resources
                </h4>
                <div className="space-y-4 px-1">
                  <ProgressBar 
                    label="CPU Load" 
                    value={data.resources.cpu} 
                    icon={Cpu} 
                    colorClass={data.resources.cpu > 80 ? "bg-red-500" : "bg-blue-500"} 
                  />
                  <ProgressBar 
                    label="Memory Usage" 
                    value={data.resources.memory} 
                    icon={Database} 
                    colorClass={data.resources.memory > 80 ? "bg-red-500" : "bg-indigo-500"} 
                  />
                  <ProgressBar 
                    label="Disk Space" 
                    value={data.resources.disk} 
                    icon={HardDrive} 
                    colorClass={data.resources.disk > 90 ? "bg-red-500" : "bg-emerald-500"} 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Server size={14} /> Service Status
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {data.services.map((service) => (
                    <div key={service.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full", 
                          service.status === "healthy" ? "bg-green-500" : 
                          service.status === "degraded" ? "bg-yellow-500" : "bg-red-500"
                        )} />
                        <span className="text-sm font-medium text-slate-700">{service.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-slate-400">{service.uptime}% uptime</span>
                        <StatusBadge status={service.status} variant={getStatusVariant(service.status)} size="sm" />
                      </div>
                    </div>
                  ))}
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


SystemHealthCard.displayName = "SystemHealthCard";

