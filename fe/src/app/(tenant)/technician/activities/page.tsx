"use client";

import { useEffect } from "react";
import { useTechnicianStore } from "@/stores/technicianStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format } from "date-fns";
import { ActivityLog } from "@/lib/api/types";

export default function ActivitiesPage() {
  const { activityLogs, loading, error, fetchActivityLogs } = useTechnicianStore();

  useEffect(() => {
    fetchActivityLogs(undefined, 100);
  }, [fetchActivityLogs]);

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading activities: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Activity Logs</h1>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      ) : !activityLogs || activityLogs.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No activity logs found.
        </div>
      ) : (
        <div className="space-y-4">
          {activityLogs.map((log: ActivityLog) => (
            <div key={log.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900 capitalize">{log.activity_type.replace(/_/g, " ")}</h3>
                  <p className="text-sm text-slate-600 mt-1">{log.description}</p>
                </div>
                <p className="text-xs text-slate-500">{format(new Date(log.created_at), "PPp")}</p>
              </div>

              {log.location_type && log.location_id && (
                <div className="text-sm text-slate-600 mt-2">
                  <span className="font-medium">Location:</span> {log.location_type} ({log.location_id.slice(0, 8)}...)
                </div>
              )}

              {log.latitude && log.longitude && (
                <div className="text-sm text-slate-600 mt-1">
                  <span className="font-medium">Coordinates:</span> {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                </div>
              )}

              {log.photo_urls && log.photo_urls.length > 0 && (
                <div className="mt-3 flex space-x-2">
                  {log.photo_urls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Activity photo ${idx + 1}`}
                      className="h-24 w-24 object-cover rounded border border-slate-200"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

