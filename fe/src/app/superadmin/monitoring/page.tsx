"use client";

import { useEffect, useState } from "react";
import { PageLayout } from "@/components/layouts";
import { LineChart, BarChart, GaugeChart } from "@/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, LoadingSpinner } from "@/components/utilities";
import { Alert } from "@/components/feedback";
import { Server, Database, Cpu, HardDrive, Activity, AlertTriangle } from "lucide-react";

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  networkIn: number;
  networkOut: number;
}

interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  uptime: number;
  responseTime: number;
}

interface PerformanceData {
  timestamp: string;
  responseTime: number;
  throughput: number;
  errorRate: number;
}

export default function MonitoringPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);

  useEffect(() => {
    const loadMonitoringData = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API calls
        // Mock data for now
        setMetrics({
          cpu: 45,
          memory: 62,
          disk: 38,
          networkIn: 1250,
          networkOut: 890,
        });

        setServices([
          { name: "API Server", status: "healthy", uptime: 99.9, responseTime: 120 },
          { name: "Database", status: "healthy", uptime: 99.8, responseTime: 45 },
          { name: "Redis", status: "healthy", uptime: 99.7, responseTime: 5 },
          { name: "Worker Queue", status: "degraded", uptime: 98.5, responseTime: 250 },
        ]);

        setPerformanceData(
          Array.from({ length: 24 }, (_, i) => ({
            timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
            responseTime: Math.floor(Math.random() * 200) + 50,
            throughput: Math.floor(Math.random() * 1000) + 500,
            errorRate: Math.random() * 2,
          }))
        );
      } catch (error) {
        console.error("Failed to load monitoring data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMonitoringData();
    const interval = setInterval(loadMonitoringData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "healthy":
        return "success";
      case "degraded":
        return "warning";
      case "down":
        return "error";
      default:
        return "info";
    }
  };

  const chartData = performanceData.map((item) => ({
    time: new Date(item.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    responseTime: item.responseTime,
    throughput: item.throughput,
    errorRate: item.errorRate,
  }));

  return (
    <PageLayout
      title="System Monitoring"
      breadcrumbs={[
        { label: "Super Admin", href: "/superadmin" },
        { label: "Monitoring" },
      ]}
    >
      {loading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size={40} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* System Resources */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-900">
                  <Cpu className="h-4 w-4 text-slate-700" />
                  CPU Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GaugeChart
                  height={120}
                  min={0}
                  max={100}
                  value={metrics?.cpu || 0}
                  ranges={[
                    { from: 0, to: 50, color: "#10b981" },
                    { from: 50, to: 80, color: "#f59e0b" },
                    { from: 80, to: 100, color: "#ef4444" },
                  ]}
                />
                <p className="text-center text-sm font-medium text-slate-900 mt-2">{metrics?.cpu || 0}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-900">
                  <Database className="h-4 w-4 text-slate-700" />
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GaugeChart
                  height={120}
                  min={0}
                  max={100}
                  value={metrics?.memory || 0}
                  ranges={[
                    { from: 0, to: 60, color: "#10b981" },
                    { from: 60, to: 85, color: "#f59e0b" },
                    { from: 85, to: 100, color: "#ef4444" },
                  ]}
                />
                <p className="text-center text-sm font-medium text-slate-900 mt-2">{metrics?.memory || 0}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-900">
                  <HardDrive className="h-4 w-4 text-slate-700" />
                  Disk Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GaugeChart
                  height={120}
                  min={0}
                  max={100}
                  value={metrics?.disk || 0}
                  ranges={[
                    { from: 0, to: 70, color: "#10b981" },
                    { from: 70, to: 90, color: "#f59e0b" },
                    { from: 90, to: 100, color: "#ef4444" },
                  ]}
                />
                <p className="text-center text-sm font-medium text-slate-900 mt-2">{metrics?.disk || 0}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-900">
                  <Activity className="h-4 w-4 text-slate-700" />
                  Network
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-600">In</p>
                    <p className="text-lg font-bold text-slate-900">{(metrics?.networkIn || 0).toLocaleString()} KB/s</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Out</p>
                    <p className="text-lg font-bold text-slate-900">{(metrics?.networkOut || 0).toLocaleString()} KB/s</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Service Status */}
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                <Server className="h-5 w-5 text-slate-700" />
                Service Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service) => (
                  <div key={service.name} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-900">{service.name}</span>
                      <StatusBadge
                        status={service.status}
                        variant={getStatusVariant(service.status)}
                        size="sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-slate-600">Uptime</p>
                        <p className="font-medium text-slate-900">{service.uptime}%</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Response Time</p>
                        <p className="font-medium text-slate-900">{service.responseTime}ms</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Time (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart
                  data={chartData}
                  xAxis={{ dataKey: "time", label: "Time" }}
                  yAxis={{ dataKey: "responseTime", label: "Response Time (ms)" }}
                  lines={[
                    {
                      dataKey: "responseTime",
                      name: "Response Time",
                      stroke: "#3b82f6",
                      strokeWidth: 2,
                    },
                  ]}
                  height={250}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Throughput (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={chartData}
                  xAxisKey="time"
                  bars={[
                    {
                      dataKey: "throughput",
                      name: "Throughput",
                      fill: "#10b981",
                    },
                  ]}
                  height={250}
                />
              </CardContent>
            </Card>
          </div>

          {/* Error Rate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Error Rate (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart
                data={chartData}
                xAxis={{ dataKey: "time", label: "Time" }}
                yAxis={{ dataKey: "errorRate", label: "Error Rate (%)" }}
                lines={[
                  {
                    dataKey: "errorRate",
                    name: "Error Rate",
                    stroke: "#ef4444",
                    strokeWidth: 2,
                  },
                ]}
                height={200}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}

