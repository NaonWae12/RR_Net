"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  History, 
  Users, 
  Package, 
  Settings, 
  CheckCircle2, 
  Clock, 
  User,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

export interface ActivityItem {
  id: string;
  type: "tenant" | "plan" | "addon" | "system" | "security";
  action: string;
  user: string;
  target?: string;
  timestamp: Date;
  status: "success" | "warning" | "error" | "info" | "failed" | "pending";
}

export interface RecentActivitiesProps {
  activities: ActivityItem[];
  loading?: boolean;
  className?: string;
}

const getActivityIcon = (type: ActivityItem["type"]) => {
  switch (type) {
    case "tenant": return <Users size={14} />;
    case "plan": return <Package size={14} />;
    case "system": return <Settings size={14} />;
    case "security": return <ShieldCheck size={14} />;
    default: return <History size={14} />;
  }
};

const getActivityColor = (type: ActivityItem["type"]) => {
  switch (type) {
    case "tenant": return "bg-blue-50 text-blue-600";
    case "plan": return "bg-purple-50 text-purple-600";
    case "system": return "bg-orange-50 text-orange-600";
    case "security": return "bg-indigo-50 text-indigo-600";
    default: return "bg-slate-50 text-slate-600";
  }
};

export const RecentActivities = React.memo<RecentActivitiesProps>(
  ({ activities, loading, className }) => {
    if (loading) {
      return (
        <Card className={cn("overflow-hidden border-none shadow-sm", className)}>
          <CardHeader className="pb-2">
            <div className="h-6 bg-slate-100 animate-pulse rounded w-1/3"></div>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="w-10 h-10 bg-slate-50 animate-pulse rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-50 animate-pulse rounded w-3/4"></div>
                  <div className="h-3 bg-slate-50 animate-pulse rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={cn("overflow-hidden border-none shadow-sm h-full", className)}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="p-1.5 bg-slate-50 text-slate-600 rounded-lg">
              <History className="h-4 w-4" />
            </div>
            Recent Global Activities
          </CardTitle>
          <button className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
            View Log
          </button>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="relative space-y-4">
            {/* Timeline Line */}
            <div className="absolute left-[19px] top-2 bottom-2 w-[1px] bg-slate-100" />
            
            {activities && activities.length > 0 ? (
              <div className="space-y-6">
                {activities.map((activity, index) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    key={activity.id} 
                    className="relative flex gap-4 group"
                  >
                    <div className={cn("relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm shrink-0 transition-transform group-hover:scale-110", 
                      getActivityColor(activity.type)
                    )}>
                      {getActivityIcon(activity.type)}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {activity.action}
                            {activity.target && (
                              <span className="text-slate-400 font-normal"> on </span>
                            )}
                            {activity.target && (
                              <span className="text-blue-600 font-medium">{activity.target}</span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <User size={10} /> {activity.user}
                            </span>
                            <span className="text-slate-200">|</span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock size={10} /> {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        {(activity.status === "success") && (
                          <div className="p-1 rounded-full bg-green-50 text-green-500">
                            <CheckCircle2 size={14} />
                          </div>
                        )}
                        {(activity.status === "error" || activity.status === "failed") && (
                          <div className="p-1 rounded-full bg-red-50 text-red-500">
                            <AlertCircle size={14} />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <Clock className="mx-auto h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-500">No recent activities found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

RecentActivities.displayName = "RecentActivities";
