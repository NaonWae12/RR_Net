"use client";

import * as React from "react";
import { Alert } from "@/components/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bell, CheckCircle2, XCircle, Info, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export interface AlertItem {
  id: string;
  type: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  timestamp: Date;
  source?: string;
  actionUrl?: string;
}

export interface AlertSummaryData {
  total: number;
  critical: number;
  warning: number;
  info: number;
  recent: AlertItem[];
}

export interface AlertSummaryCardProps {
  data?: AlertSummaryData;
  loading?: boolean;
  className?: string;
  onViewAll?: () => void;
}

const alertIcons = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const alertVariants = {
  critical: "error" as const,
  warning: "warning" as const,
  info: "info" as const,
  success: "success" as const,
};

const StatItem = ({ label, count, colorClass }: { label: string; count: number; colorClass: string }) => (
  <div className={cn("p-3 rounded-xl border border-transparent flex flex-col items-center justify-center transition-all", colorClass)}>
    <span className="text-xl font-bold">{count}</span>
    <span className="text-[10px] uppercase font-bold tracking-tight opacity-70">{label}</span>
  </div>
);

export const AlertSummaryCard = React.memo<AlertSummaryCardProps>(
  ({ data, loading, className, onViewAll }) => {
    const router = useRouter();

    if (loading) {
      return (
        <Card className={cn("overflow-hidden border-none shadow-sm", className)}>
          <CardHeader className="pb-2">
            <div className="h-6 bg-slate-100 animate-pulse rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-lg" />)}
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
          <Bell className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No alert data available</p>
        </Card>
      );
    }

    const handleViewAll = () => {
      if (onViewAll) {
        onViewAll();
      } else {
        router.push("/superadmin/monitoring");
      }
    };

    return (
      <Card className={cn("overflow-hidden border-none shadow-sm h-full", className)}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">
              <Bell className="h-4 w-4" />
            </div>
            Alert Summary
          </CardTitle>
          <button onClick={handleViewAll} className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
            Resolve All
          </button>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-2">
              <StatItem label="Crit" count={data.critical} colorClass="bg-red-50 text-red-600 border-red-100" />
              <StatItem label="Warn" count={data.warning} colorClass="bg-amber-50 text-amber-600 border-amber-100" />
              <StatItem label="Info" count={data.info} colorClass="bg-blue-50 text-blue-600 border-blue-100" />
              <StatItem label="Total" count={data.total} colorClass="bg-slate-50 text-slate-600 border-slate-100" />
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Notifications</h4>
              <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
                {data.recent.length === 0 ? (
                  <div className="py-10 text-center bg-slate-50 rounded-xl">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-green-200 mb-2" />
                    <p className="text-xs text-slate-500 font-medium">System is running smooth</p>
                  </div>
                ) : (
                  data.recent.map((alert, index) => {
                    const Icon = alertIcons[alert.type];
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={alert.id}
                      >
                        <Alert
                          variant={alertVariants[alert.type]}
                          title={alert.title}
                          message={alert.message}
                          icon={<Icon className="h-4 w-4" />}
                          className="border border-transparent shadow-sm bg-white hover:bg-blue-50/50 hover:border-blue-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                        >
                          <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-slate-400">
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-200" /> {alert.source || "System"}
                            </span>
                            <span>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {alert.actionUrl && (
                            <button
                              className="mt-2 text-[11px] font-bold text-blue-600 flex items-center gap-1 hover:underline"
                              onClick={() => router.push(alert.actionUrl!)}
                            >
                              Take Action <ArrowRight size={12} />
                            </button>
                          )}
                        </Alert>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
            
            <Button variant="outline" className="w-full text-xs font-bold py-5 bg-slate-50 border-slate-100 hover:bg-slate-100" onClick={handleViewAll}>
              View All System Logs
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
);

AlertSummaryCard.displayName = "AlertSummaryCard";


AlertSummaryCard.displayName = "AlertSummaryCard";

