"use client";

import { useEffect, useState } from "react";
import { PageLayout } from "@/components/layouts";
import { DataTable, type DataTableColumn } from "@/components/tables";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/utilities";
import { Download, Eye, Filter } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/feedback";

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string;
  ip_address: string;
  user_agent?: string;
  status: "success" | "failed" | "pending";
  details?: Record<string, any>;
  created_at: string;
}

export default function AuditPage() {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    const loadAuditLogs = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API call
        // Mock data for now
        setAuditLogs(
          Array.from({ length: 50 }, (_, i) => ({
            id: `log-${i + 1}`,
            user_id: `user-${Math.floor(Math.random() * 10) + 1}`,
            user_name: `User ${Math.floor(Math.random() * 10) + 1}`,
            action: ["create", "update", "delete", "view", "login", "logout"][Math.floor(Math.random() * 6)],
            resource_type: ["tenant", "plan", "addon", "user", "system"][Math.floor(Math.random() * 5)],
            resource_id: `resource-${i + 1}`,
            resource_name: `Resource ${i + 1}`,
            ip_address: `192.168.1.${Math.floor(Math.random() * 255)}`,
            user_agent: "Mozilla/5.0...",
            status: ["success", "failed", "pending"][Math.floor(Math.random() * 3)] as "success" | "failed" | "pending",
            details: { key: "value" },
            created_at: new Date(Date.now() - i * 3600000).toISOString(),
          }))
        );
      } catch (error) {
        console.error("Failed to load audit logs:", error);
        toast({ type: "error", title: "Error", message: "Failed to load audit logs" });
      } finally {
        setLoading(false);
      }
    };

    loadAuditLogs();
  }, []);

  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: "created_at",
      title: "Timestamp",
      sortable: true,
      render: (value) => format(new Date(value), "PPp"),
    },
    {
      key: "user_name",
      title: "User",
      sortable: true,
      filterable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-slate-900">{value}</div>
          <div className="text-xs text-slate-600">{row.user_id}</div>
        </div>
      ),
    },
    {
      key: "action",
      title: "Action",
      sortable: true,
      filterable: true,
      render: (value) => (
          <span className="capitalize font-medium text-slate-900">{value}</span>
      ),
    },
    {
      key: "resource_type",
      title: "Resource Type",
      sortable: true,
      filterable: true,
      render: (value, row) => (
        <div>
          <span className="capitalize text-slate-900">{value}</span>
          {row.resource_name && (
            <div className="text-xs text-slate-600">{row.resource_name}</div>
          )}
        </div>
      ),
    },
    {
      key: "ip_address",
      title: "IP Address",
      filterable: true,
      render: (value) => <code className="text-xs text-slate-900">{value}</code>,
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      filterable: true,
      render: (value) => (
        <StatusBadge
          status={value}
          variant={value === "success" ? "success" : value === "failed" ? "error" : "warning"}
          size="sm"
        />
      ),
    },
    {
      key: "actions",
      title: "Actions",
      align: "right",
      render: (_, row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedLog(row)}
        >
          <Eye className="h-4 w-4 mr-1" />
          Details
        </Button>
      ),
    },
  ];

  return (
    <PageLayout
      title="Audit Logs"
      breadcrumbs={[
        { label: "Super Admin", href: "/superadmin" },
        { label: "Audit Logs" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filters
          </Button>
          <Button variant="outline" onClick={() => toast({ type: "info", title: "Export", message: "Exporting audit logs..." })}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      }
    >
      <DataTable
        data={auditLogs}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 20, pageSizeOptions: [20, 50, 100, 200] }}
        searchable
        filterable
        onExport={(format) => {
          toast({ type: "info", title: "Export", message: `Exporting to ${format}...` });
        }}
        emptyMessage="No audit logs found."
      />

      {/* Log Details Modal - TODO: Implement using Modal component from FE_12 */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 text-slate-900">Audit Log Details</h3>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-600">User</p>
                  <p className="font-medium text-slate-900">{selectedLog.user_name}</p>
                </div>
                <div>
                  <p className="text-slate-600">Action</p>
                  <p className="font-medium text-slate-900 capitalize">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-slate-600">Resource</p>
                  <p className="font-medium text-slate-900">{selectedLog.resource_type} - {selectedLog.resource_name || selectedLog.resource_id}</p>
                </div>
                <div>
                  <p className="text-slate-600">Status</p>
                  <StatusBadge status={selectedLog.status} variant={selectedLog.status === "success" ? "success" : selectedLog.status === "failed" ? "error" : "warning"} size="sm" />
                </div>
                <div>
                  <p className="text-slate-600">IP Address</p>
                  <p className="font-medium text-slate-900">{selectedLog.ip_address}</p>
                </div>
                <div>
                  <p className="text-slate-600">Timestamp</p>
                  <p className="font-medium text-slate-900">{format(new Date(selectedLog.created_at), "PPpp")}</p>
                </div>
              </div>
              {selectedLog.details && (
                <div>
                  <p className="text-slate-600 mb-2">Details</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedLog(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

