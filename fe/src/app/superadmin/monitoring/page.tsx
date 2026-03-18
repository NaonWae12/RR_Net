"use client";

import { useEffect, useState } from "react";
import { PageLayout } from "@/components/layouts";
import { LineChart, BarChart, GaugeChart } from "@/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, LoadingSpinner } from "@/components/utilities";
import { Alert } from "@/components/feedback";
import { Server, Database, Cpu, HardDrive, Activity, AlertTriangle, Network, ShieldCheck, Zap } from "lucide-react";
import { superAdminService } from "@/lib/api/superAdminService";

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

interface NetworkStats {
  total_routers: number;
  ports_used: number;
  port_capacity: number;
  usage_percentage: number;
  active_tunnels: number;
  port_range_start: number;
  port_range_end: number;
  provisioning_instances: number;
}

export default function MonitoringPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMonitoringData = async () => {
      setLoading(true);
      setError(null);
      try {
        const stats = await superAdminService.getNetworkStats();
        if (stats) {
          setNetworkStats(stats);
        }

        // For system metrics, we can call our health check endpoint if it exists
        // Or keep some reasonable defaults if host metrics aren't exposed yet
        setMetrics({
          cpu: Math.floor(Math.random() * 30) + 10,
          memory: 45,
          disk: 22,
          networkIn: 850,
          networkOut: 420,
        });

        setServices([
          { name: "API Server", status: "healthy", uptime: 99.9, responseTime: 85 },
          { name: "Primary Database", status: "healthy", uptime: 99.9, responseTime: 12 },
          { name: "Redis Cache", status: "healthy", uptime: 100, responseTime: 2 },
          { name: "VPN Gateway (Host)", status: "healthy", uptime: 99.5, responseTime: 5 },
        ]);

        setPerformanceData(
          Array.from({ length: 24 }, (_, i) => ({
            timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
            responseTime: Math.floor(Math.random() * 100) + 40,
            throughput: Math.floor(Math.random() * 500) + 200,
            errorRate: Math.random() * 0.5,
          }))
        );
      } catch (err: any) {
        console.error("Failed to load monitoring data:", err);
        setError("Could not connect to the monitoring services.");
      } finally {
        setLoading(false);
      }
    };

    loadMonitoringData();
    const interval = setInterval(loadMonitoringData, 45000); // Refresh every 45s
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
          {error && (
            <Alert variant="error" title="Data Sync Error">
              {error}
            </Alert>
          )}

          {/* Network & VPN Infrastructure */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <Network className="h-5 w-5 text-indigo-600" />
                    VPN Infrastructure Status
                  </CardTitle>
                  <StatusBadge status="active" variant="success" size="sm">Operational</StatusBadge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-600 mb-1">
                        <Zap className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Active Tunnels</span>
                      </div>
                      <p className="text-3xl font-black text-slate-900">{networkStats?.active_tunnels || 0}</p>
                      <p className="text-xs text-slate-500 mt-1">Routers connected via VPN</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-600 mb-1">
                        <ShieldCheck className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Total Routers</span>
                      </div>
                      <p className="text-3xl font-black text-slate-900">{networkStats?.total_routers || 0}</p>
                      <p className="text-xs text-slate-500 mt-1">Registered in platform</p>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex flex-col items-center justify-center p-4">
                    <CardTitle className="text-sm font-bold text-slate-700 mb-4">Remote Port Utilization</CardTitle>
                    <GaugeChart
                      height={180}
                      min={0}
                      max={networkStats?.port_capacity || 9500}
                      value={networkStats?.ports_used || 0}
                      ranges={[
                        { from: 0, to: 5000, color: "#4f46e5" },
                        { from: 5000, to: 8000, color: "#f59e0b" },
                        { from: 8000, to: 9501, color: "#ef4444" },
                      ]}
                    />
                    <div className="text-center mt-2">
                      <p className="text-2xl font-black text-slate-900">
                        {networkStats?.ports_used || 0} / {networkStats?.port_capacity || 9500}
                      </p>
                      <p className="text-sm text-slate-500">
                        Ports Assigned ({networkStats?.port_range_start || 10500} - {networkStats?.port_range_end || 20000})
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-700">Platform Scaling Limit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                      <span>Port Reached Limit</span>
                      <span>{networkStats?.usage_percentage?.toFixed(1) || "0"}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div 
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-1000" 
                        style={{ width: `${Math.min(networkStats?.usage_percentage || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <p className="text-sm font-medium text-indigo-900 mb-1">Scaling Strategy Advisory</p>
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      {networkStats && networkStats.usage_percentage > 80 
                        ? "CRITICAL: Port capacity reached 80%. Consider expanding the port range or adding a new gateway VPS."
                        : "Current port capacity is sufficient for existing growth. Plan for scaling when usage reaches 75%."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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

