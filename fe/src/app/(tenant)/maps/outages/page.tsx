"use client";

import { useEffect, useState } from "react";
import { useMapsStore } from "@/stores/mapsStore";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function OutagesPage() {
  const { outages, loading, error, fetchOutages, resolveOutage } = useMapsStore();
  const { showToast } = useNotificationStore();
  const [includeResolved, setIncludeResolved] = useState(false);

  useEffect(() => {
    fetchOutages(includeResolved);
  }, [fetchOutages, includeResolved]);

  const handleResolve = async (outageId: string) => {
    if (!confirm("Are you sure you want to resolve this outage?")) {
      return;
    }
    try {
      await resolveOutage(outageId);
      showToast({
        title: "Outage resolved",
        description: "Outage has been successfully resolved.",
        variant: "success",
      });
    } catch (error: any) {
      showToast({
        title: "Failed to resolve outage",
        description: error.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading outages: {error}
      </div>
    );
  }

  const activeOutages = outages.filter((o) => !o.is_resolved);
  const resolvedOutages = outages.filter((o) => o.is_resolved);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Outages</h1>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="include-resolved"
            checked={includeResolved}
            onChange={(e) => setIncludeResolved(e.target.checked)}
            className="rounded border-slate-300"
          />
          <label htmlFor="include-resolved" className="text-sm text-slate-700">
            Include resolved
          </label>
        </div>
      </div>

      {/* Active Outages */}
      {activeOutages.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-red-600">Active Outages ({activeOutages.length})</h2>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node Type</TableHead>
                  <TableHead>Node ID</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reported At</TableHead>
                  <TableHead>Affected Nodes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeOutages.map((outage) => (
                  <TableRow key={outage.id}>
                    <TableCell className="uppercase font-medium">{outage.node_type}</TableCell>
                    <TableCell className="text-sm text-slate-500">{outage.node_id.slice(0, 8)}...</TableCell>
                    <TableCell>{outage.reason}</TableCell>
                    <TableCell>{format(new Date(outage.reported_at), "PPp")}</TableCell>
                    <TableCell>{outage.affected_nodes?.length || 0}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleResolve(outage.id)}>
                        Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Resolved Outages */}
      {includeResolved && resolvedOutages.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-600">Resolved Outages ({resolvedOutages.length})</h2>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node Type</TableHead>
                  <TableHead>Node ID</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reported At</TableHead>
                  <TableHead>Resolved At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedOutages.map((outage) => (
                  <TableRow key={outage.id}>
                    <TableCell className="uppercase font-medium">{outage.node_type}</TableCell>
                    <TableCell className="text-sm text-slate-500">{outage.node_id.slice(0, 8)}...</TableCell>
                    <TableCell>{outage.reason}</TableCell>
                    <TableCell>{format(new Date(outage.reported_at), "PPp")}</TableCell>
                    <TableCell>
                      {outage.resolved_at ? format(new Date(outage.resolved_at), "PPp") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      ) : outages.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No outages found.
        </div>
      ) : null}
    </div>
  );
}

