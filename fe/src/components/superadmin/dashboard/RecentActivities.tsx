"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/utilities";
import { cn } from "@/lib/utils";
import { Clock, User, Activity } from "lucide-react";
import { useRouter } from "next/navigation";

export interface ActivityItem {
  id: string;
  type: "tenant" | "plan" | "addon" | "system" | "security";
  action: string;
  user: string;
  target?: string;
  timestamp: Date;
  status?: "success" | "failed" | "pending";
  details?: string;
}

export interface RecentActivitiesProps {
  activities?: ActivityItem[];
  loading?: boolean;
  maxItems?: number;
  className?: string;
  onViewAll?: () => void;
}

const activityIcons = {
  tenant: "🏢",
  plan: "📦",
  addon: "➕",
  system: "⚙️",
  security: "🔒",
};

const activityColors = {
  tenant: "bg-blue-100 text-blue-700",
  plan: "bg-purple-100 text-purple-700",
  addon: "bg-green-100 text-green-700",
  system: "bg-gray-100 text-gray-700",
  security: "bg-red-100 text-red-700",
};

export const RecentActivities = React.memo<RecentActivitiesProps>(
  ({ activities = [], loading, maxItems = 10, className, onViewAll }) => {
    const router = useRouter();

    if (loading) {
      return (
        <Card className={className}>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    const displayActivities = activities.slice(0, maxItems);
    const handleViewAll = () => {
      if (onViewAll) {
        onViewAll();
      } else {
        router.push("/superadmin/audit");
      }
    };

    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activities
            </CardTitle>
            {activities.length > maxItems && (
              <Button variant="outline" size="sm" onClick={handleViewAll}>
                View All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {displayActivities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No recent activities</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full text-lg",
                      activityColors[activity.type]
                    )}
                  >
                    {activityIcons[activity.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                        {activity.target && (
                          <p className="text-xs text-slate-600 mt-1">Target: {activity.target}</p>
                        )}
                        {activity.details && (
                          <p className="text-xs text-slate-600 mt-1">{activity.details}</p>
                        )}
                      </div>
                      {activity.status && (
                        <StatusBadge
                          status={activity.status}
                          variant={activity.status === "success" ? "success" : activity.status === "failed" ? "error" : "warning"}
                          size="sm"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-500" />
                        <span>{activity.user}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span>{new Date(activity.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

RecentActivities.displayName = "RecentActivities";

