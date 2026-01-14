"use client";

import * as React from "react";
import { Alert } from "@/components/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bell, CheckCircle2, XCircle, Info } from "lucide-react";
import { useRouter } from "next/navigation";

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

export const AlertSummaryCard = React.memo<AlertSummaryCardProps>(
  ({ data, loading, className, onViewAll }) => {
    const router = useRouter();

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
            <p className="text-sm text-slate-600">No alert data available</p>
          </CardContent>
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
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alert Summary
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleViewAll}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{data.critical}</p>
                <p className="text-xs text-red-700 mt-1">Critical</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-600">{data.warning}</p>
                <p className="text-xs text-amber-700 mt-1">Warning</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{data.info}</p>
                <p className="text-xs text-blue-700 mt-1">Info</p>
              </div>
              <div className="text-center p-3 bg-slate-100 rounded-lg">
                <p className="text-2xl font-bold text-slate-900">{data.total}</p>
                <p className="text-xs text-slate-600 mt-1">Total</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 text-slate-900">Recent Alerts</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.recent.length === 0 ? (
                  <p className="text-sm text-slate-600 text-center py-4">No recent alerts</p>
                ) : (
                  data.recent.map((alert) => {
                    const Icon = alertIcons[alert.type];
                    return (
                      <Alert
                        key={alert.id}
                        variant={alertVariants[alert.type]}
                        title={alert.title}
                        message={alert.message}
                        icon={<Icon className="h-4 w-4" />}
                        className="text-sm"
                      >
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                          <span>{alert.source || "System"}</span>
                          <span>{new Date(alert.timestamp).toLocaleString()}</span>
                        </div>
                        {alert.actionUrl && (
                          <Button
                            variant="link"
                            size="sm"
                            className="mt-2 h-auto p-0 text-xs"
                            onClick={() => router.push(alert.actionUrl!)}
                          >
                            View Details →
                          </Button>
                        )}
                      </Alert>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

AlertSummaryCard.displayName = "AlertSummaryCard";

