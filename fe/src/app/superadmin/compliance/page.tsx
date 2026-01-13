"use client";

import { useEffect, useState } from "react";
import { PageLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/tables";
import { GaugeChart, BarChart } from "@/components/charts";
import { StatusBadge, LoadingSpinner } from "@/components/utilities";
import { Alert } from "@/components/feedback";
import { Shield, FileText, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { toast } from "@/components/feedback";

interface ComplianceItem {
  id: string;
  standard: string;
  category: "GDPR" | "SOX" | "ISO27001" | "PCI-DSS" | "HIPAA";
  requirement: string;
  status: "compliant" | "non-compliant" | "pending" | "not-applicable";
  lastChecked: string;
  nextCheck: string;
  score: number;
}

interface ComplianceScore {
  overall: number;
  gdpr: number;
  sox: number;
  iso27001: number;
  pciDss: number;
  hipaa: number;
}

export default function CompliancePage() {
  const [loading, setLoading] = useState(true);
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([]);
  const [scores, setScores] = useState<ComplianceScore | null>(null);

  useEffect(() => {
    const loadComplianceData = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API calls
        setScores({
          overall: 87,
          gdpr: 92,
          sox: 85,
          iso27001: 88,
          pciDss: 90,
          hipaa: 82,
        });

        setComplianceItems([
          {
            id: "1",
            standard: "GDPR",
            category: "GDPR",
            requirement: "Data Subject Access Rights",
            status: "compliant",
            lastChecked: new Date().toISOString(),
            nextCheck: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
            score: 100,
          },
          {
            id: "2",
            standard: "GDPR",
            category: "GDPR",
            requirement: "Data Breach Notification",
            status: "compliant",
            lastChecked: new Date().toISOString(),
            nextCheck: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
            score: 95,
          },
          {
            id: "3",
            standard: "SOX",
            category: "SOX",
            requirement: "Financial Reporting Controls",
            status: "compliant",
            lastChecked: new Date().toISOString(),
            nextCheck: new Date(Date.now() + 90 * 24 * 3600000).toISOString(),
            score: 88,
          },
          {
            id: "4",
            standard: "ISO27001",
            category: "ISO27001",
            requirement: "Information Security Management",
            status: "pending",
            lastChecked: new Date(Date.now() - 60 * 24 * 3600000).toISOString(),
            nextCheck: new Date(Date.now() + 15 * 24 * 3600000).toISOString(),
            score: 75,
          },
          {
            id: "5",
            standard: "PCI-DSS",
            category: "PCI-DSS",
            requirement: "Payment Card Data Protection",
            status: "compliant",
            lastChecked: new Date().toISOString(),
            nextCheck: new Date(Date.now() + 90 * 24 * 3600000).toISOString(),
            score: 90,
          },
        ]);
      } catch (error) {
        console.error("Failed to load compliance data:", error);
        toast({ type: "error", title: "Error", message: "Failed to load compliance data" });
      } finally {
        setLoading(false);
      }
    };

    loadComplianceData();
  }, []);

  const columns: DataTableColumn<ComplianceItem>[] = [
    {
      key: "standard",
      title: "Standard",
      sortable: true,
      filterable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "requirement",
      title: "Requirement",
      sortable: true,
      filterable: true,
      render: (value) => <span>{value}</span>,
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      filterable: true,
      render: (value) => (
        <StatusBadge
          status={value}
          variant={value === "compliant" ? "success" : value === "non-compliant" ? "error" : value === "pending" ? "warning" : "info"}
          size="sm"
        />
      ),
    },
    {
      key: "score",
      title: "Score",
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{value}%</span>
          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${
                value >= 90 ? "bg-green-500" : value >= 70 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${value}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "lastChecked",
      title: "Last Checked",
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: "nextCheck",
      title: "Next Check",
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
  ];

  const scoreData = scores
    ? [
        { name: "GDPR", value: scores.gdpr, fill: "#10b981" },
        { name: "SOX", value: scores.sox, fill: "#3b82f6" },
        { name: "ISO27001", value: scores.iso27001, fill: "#f59e0b" },
        { name: "PCI-DSS", value: scores.pciDss, fill: "#8b5cf6" },
        { name: "HIPAA", value: scores.hipaa, fill: "#ef4444" },
      ]
    : [];

  return (
    <PageLayout
      title="Compliance Dashboard"
      breadcrumbs={[
        { label: "Super Admin", href: "/superadmin" },
        { label: "Compliance" },
      ]}
      actions={
        <Button variant="outline" onClick={() => toast({ type: "info", title: "Export", message: "Generating compliance report..." })}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      }
    >
      {loading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size={40} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Compliance Score */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Overall Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GaugeChart
                  height={150}
                  min={0}
                  max={100}
                  value={scores?.overall || 0}
                  ranges={[
                    { from: 0, to: 70, color: "#ef4444" },
                    { from: 70, to: 90, color: "#f59e0b" },
                    { from: 90, to: 100, color: "#10b981" },
                  ]}
                />
                <p className="text-center text-2xl font-bold mt-2">{scores?.overall || 0}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance by Standard</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={scoreData}
                  xAxisKey="name"
                  bars={[
                    {
                      dataKey: "value",
                      name: "Compliance Score",
                      fill: "#3b82f6",
                    },
                  ]}
                  height={200}
                  orientation="vertical"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Compliant</span>
                    </div>
                    <span className="font-medium">
                      {complianceItems.filter((item) => item.status === "compliant").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm">Pending</span>
                    </div>
                    <span className="font-medium">
                      {complianceItems.filter((item) => item.status === "pending").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm">Non-Compliant</span>
                    </div>
                    <span className="font-medium">
                      {complianceItems.filter((item) => item.status === "non-compliant").length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compliance Requirements Table */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Requirements</CardTitle>
              <CardDescription>
                Detailed view of all compliance requirements and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={complianceItems}
                columns={columns}
                loading={loading}
                pagination={{ pageSize: 10, pageSizeOptions: [10, 20, 50] }}
                searchable
                filterable
                onExport={(format) => {
                  toast({ type: "info", title: "Export", message: `Exporting to ${format}...` });
                }}
                emptyMessage="No compliance items found."
              />
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}

