"use client";

import { useState } from "react";
import { PageLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/modals";
import { Alert } from "@/components/feedback";
import { StatusBadge } from "@/components/utilities";
import { Power, AlertTriangle, RefreshCw, Shield, Database, Server, Users } from "lucide-react";
import { toast } from "@/components/feedback";

interface EmergencyAction {
  id: string;
  name: string;
  description: string;
  category: "system" | "tenant" | "database" | "network";
  severity: "critical" | "high" | "medium";
  requiresConfirmation: boolean;
  confirmationText?: string;
}

const emergencyActions: EmergencyAction[] = [
  {
    id: "system-shutdown",
    name: "System Shutdown",
    description: "Gracefully shutdown the entire system. All services will be stopped.",
    category: "system",
    severity: "critical",
    requiresConfirmation: true,
    confirmationText: "SHUTDOWN",
  },
  {
    id: "system-restart",
    name: "System Restart",
    description: "Restart all system services. There will be brief downtime.",
    category: "system",
    severity: "high",
    requiresConfirmation: true,
    confirmationText: "RESTART",
  },
  {
    id: "database-backup",
    name: "Force Database Backup",
    description: "Immediately trigger a full database backup.",
    category: "database",
    severity: "medium",
    requiresConfirmation: false,
  },
  {
    id: "database-restore",
    name: "Database Restore",
    description: "Restore database from latest backup. This will overwrite current data.",
    category: "database",
    severity: "critical",
    requiresConfirmation: true,
    confirmationText: "RESTORE",
  },
  {
    id: "tenant-isolate-all",
    name: "Isolate All Tenants",
    description: "Emergency isolation of all tenants. All tenant access will be blocked.",
    category: "tenant",
    severity: "critical",
    requiresConfirmation: true,
    confirmationText: "ISOLATE ALL",
  },
  {
    id: "tenant-unisolate-all",
    name: "Unisolate All Tenants",
    description: "Remove isolation from all tenants. Restore access to all tenants.",
    category: "tenant",
    severity: "high",
    requiresConfirmation: true,
    confirmationText: "UNISOLATE ALL",
  },
  {
    id: "clear-cache",
    name: "Clear All Cache",
    description: "Clear Redis cache and all application caches.",
    category: "system",
    severity: "medium",
    requiresConfirmation: false,
  },
  {
    id: "force-logout-all",
    name: "Force Logout All Users",
    description: "Invalidate all active sessions. All users will be logged out.",
    category: "tenant",
    severity: "high",
    requiresConfirmation: true,
    confirmationText: "LOGOUT ALL",
  },
];

const categoryIcons = {
  system: Server,
  tenant: Users,
  database: Database,
  network: Shield,
};

const severityColors = {
  critical: "destructive",
  high: "warning",
  medium: "default",
};

export default function EmergencyPage() {
  const [selectedAction, setSelectedAction] = useState<EmergencyAction | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);

  const handleActionClick = (action: EmergencyAction) => {
    setSelectedAction(action);
    if (action.requiresConfirmation) {
      setModalOpen(true);
    } else {
      executeAction(action);
    }
  };

  const executeAction = async (action: EmergencyAction) => {
    setExecuting(action.id);
    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate API call
      
      toast({
        type: "success",
        title: "Action Executed",
        message: `${action.name} has been executed successfully.`,
      });
    } catch (error: any) {
      toast({
        type: "error",
        title: "Action Failed",
        message: error?.message || `Failed to execute ${action.name}.`,
      });
    } finally {
      setExecuting(null);
      setModalOpen(false);
      setSelectedAction(null);
    }
  };

  const handleConfirm = () => {
    if (selectedAction) {
      executeAction(selectedAction);
    }
  };

  const groupedActions = emergencyActions.reduce((acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = [];
    }
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, EmergencyAction[]>);

  return (
    <>
      <PageLayout
        title="Emergency Controls"
        breadcrumbs={[
          { label: "Super Admin", href: "/superadmin" },
          { label: "Emergency Controls" },
        ]}
      >
        <div className="space-y-6">
          <Alert
            variant="warning"
            title="Warning: Emergency Controls"
            message="These controls have significant impact on the system. Use with extreme caution. All actions are logged and audited."
            dismissible={false}
          />

          {Object.entries(groupedActions).map(([category, actions]) => {
            const Icon = categoryIcons[category as keyof typeof categoryIcons];
            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {category.charAt(0).toUpperCase() + category.slice(1)} Controls
                  </CardTitle>
                  <CardDescription>
                    Emergency controls for {category} management
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {actions.map((action) => (
                      <div
                        key={action.id}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium flex items-center gap-2">
                              {action.name}
                              <StatusBadge
                                status={action.severity}
                                variant={action.severity === "critical" ? "error" : action.severity === "high" ? "warning" : "info"}
                                size="sm"
                              />
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                          </div>
                        </div>
                        <Button
                          variant={severityColors[action.severity] as any}
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => handleActionClick(action)}
                          disabled={executing === action.id}
                        >
                          {executing === action.id ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Executing...
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4 mr-2" />
                              Execute
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageLayout>

      {selectedAction && (
        <ConfirmModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedAction(null);
          }}
          onConfirm={handleConfirm}
          title={selectedAction.name}
          message={selectedAction.description}
          danger={selectedAction.severity === "critical"}
          requireConfirmation={selectedAction.requiresConfirmation}
          confirmationText={selectedAction.confirmationText || "CONFIRM"}
        />
      )}
    </>
  );
}

