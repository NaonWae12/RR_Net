"use client";

import { useEffect, useState } from "react";
import { useTechnicianStore } from "@/stores/technicianStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format } from "date-fns";
import { ActivityLog } from "@/lib/api/types";
import { useRole } from "@/lib/hooks/useRole";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@heroicons/react/20/solid";
import { LogActivityModal } from "@/components/technician/LogActivityModal";
import { useNotificationStore } from "@/stores/notificationStore";
import { RoleGuard } from "@/components/guards/RoleGuard";

export default function ActivitiesPage() {
  const { activityLogs, loading, error, fetchActivityLogs, logActivity } = useTechnicianStore();
  const { isTechnician, canViewAllActivities, userId } = useRole();
  const { showToast } = useNotificationStore();
  const [showLogActivityModal, setShowLogActivityModal] = useState(false);

  useEffect(() => {
    // For technician: only fetch own activities
    // For admin: fetch all activities
    // Pass technician_id as query param (backend expects UUID string)
    const technicianId = isTechnician && userId ? userId : undefined;
    fetchActivityLogs(technicianId, 100);
  }, [fetchActivityLogs, isTechnician, userId]);

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading activities: {error}
      </div>
    );
  }

  const handleLogActivitySuccess = async () => {
    setShowLogActivityModal(false);
    const technicianId = isTechnician ? userId : undefined;
    await fetchActivityLogs(technicianId, 100);
    showToast({
      title: "Activity logged",
      description: "Activity has been logged successfully.",
      variant: "success",
    });
  };

  return (
    <RoleGuard allowedRoles={["owner", "admin", "technician"]} redirectTo="/dashboard">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">
            {isTechnician ? "My Activities" : "Activity Logs"}
          </h1>
          <Button onClick={() => setShowLogActivityModal(true)}>
            <PlusIcon className="h-5 w-5 mr-2" /> Log Activity
          </Button>
        </div>

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

      {/* Log Activity Modal */}
      {showLogActivityModal && (
        <LogActivityModal
          onClose={() => setShowLogActivityModal(false)}
          onSuccess={handleLogActivitySuccess}
        />
      )}
      </div>
    </RoleGuard>
  );
}

