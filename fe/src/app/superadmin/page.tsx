"use client";

import { useEffect, useState } from "react";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import type { Tenant, Plan, Addon } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities";
import { PageLayout } from "@/components/layouts";
import {
  SystemHealthCard,
  TenantMetricsCard,
  RevenueChart,
  AlertSummaryCard,
  RecentActivities,
  type SystemHealthData,
  type TenantMetricsData,
  type RevenueData,
  type AlertSummaryData,
  type ActivityItem,
} from "@/components/superadmin/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Package, Plus, Settings } from "lucide-react";
import Link from "next/link";

export default function SuperAdminDashboardPage() {
  const store = useSuperAdminStore();
  const tenants = store.tenants || [];
  const plans = store.plans || [];
  const addons = store.addons || [];
  const { loading, fetchTenants, fetchPlans, fetchAddons } = store;
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | undefined>();
  const [tenantMetrics, setTenantMetrics] = useState<TenantMetricsData | undefined>();
  const [revenue, setRevenue] = useState<RevenueData | undefined>();
  const [alerts, setAlerts] = useState<AlertSummaryData | undefined>();
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      setDashboardLoading(true);
      try {
        // Fetch basic data
        await Promise.all([fetchTenants(), fetchPlans(), fetchAddons()]);

        // Get fresh data from store after fetch
        const currentState = useSuperAdminStore.getState();
        const tenantsList = currentState.tenants || [];
        const plansList = currentState.plans || [];
        const addonsList = currentState.addons || [];
        
        // TODO: Replace with actual API calls when backend is ready
        // For now, generate mock data from existing data
        const activeTenants = tenantsList.filter((t) => t.status === "active").length;
        const suspendedTenants = tenantsList.filter((t) => t.status === "suspended").length;
        const totalTenants = tenantsList.length;

        // Mock system health data (always show, even if no tenants)
        setSystemHealth({
          overallScore: 95,
          services: [
            { name: "API Server", status: "healthy", uptime: 99.9 },
            { name: "Database", status: "healthy", uptime: 99.8 },
            { name: "Redis", status: "healthy", uptime: 99.7 },
            { name: "Worker Queue", status: "healthy", uptime: 99.5 },
          ],
          resources: {
            cpu: 45,
            memory: 62,
            disk: 38,
          },
        });

        // Mock tenant metrics (show 0 if no tenants, but still display the card)
        setTenantMetrics({
          total: totalTenants,
          active: activeTenants,
          suspended: suspendedTenants,
          growth: {
            value: totalTenants > 0 ? 12.5 : 0,
            isPositive: totalTenants > 0,
          },
          planDistribution: plansList.length > 0
            ? plansList.map((plan) => ({
                planName: plan.name,
                count: Math.floor(Math.random() * 10) + 1,
              }))
            : [
                { planName: "No plans yet", count: 0 },
              ],
          growthTrend: Array.from({ length: 12 }, (_, i) => ({
            date: new Date(2024, i, 1).toISOString(),
            count: totalTenants > 0 ? Math.floor(Math.random() * 50) + 10 : 0,
          })),
        });

        // Mock revenue data
        setRevenue({
          monthly: Array.from({ length: 12 }, (_, i) => ({
            month: new Date(2024, i, 1).toISOString(),
            revenue: Math.floor(Math.random() * 50000000) + 10000000,
            planRevenue: Math.floor(Math.random() * 40000000) + 8000000,
            addonRevenue: Math.floor(Math.random() * 10000000) + 2000000,
          })),
          total: 450000000,
          growth: {
            value: 18.3,
            isPositive: true,
          },
          breakdown: {
            plan: 360000000,
            addon: 90000000,
          },
        });

        // Mock alerts
        setAlerts({
          total: 5,
          critical: 1,
          warning: 2,
          info: 2,
          recent: [
            {
              id: "1",
              type: "critical",
              title: "High CPU Usage",
              message: "CPU usage exceeded 90% on server-01",
              timestamp: new Date(),
              source: "System Monitor",
            },
            {
              id: "2",
              type: "warning",
              title: "Database Connection Pool",
              message: "Connection pool usage at 85%",
              timestamp: new Date(Date.now() - 3600000),
              source: "Database Monitor",
            },
          ],
        });

        // Mock activities
        setActivities([
          {
            id: "1",
            type: "tenant",
            action: "Created new tenant",
            user: "Super Admin",
            target: "Acme Corp",
            timestamp: new Date(),
            status: "success",
          },
          {
            id: "2",
            type: "plan",
            action: "Updated plan pricing",
            user: "Super Admin",
            target: "Business Plan",
            timestamp: new Date(Date.now() - 7200000),
            status: "success",
          },
          {
            id: "3",
            type: "system",
            action: "System backup completed",
            user: "System",
            timestamp: new Date(Date.now() - 10800000),
            status: "success",
          },
        ]);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setDashboardLoading(false);
      }
    };

    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const isLoading = loading || dashboardLoading;

  return (
    <PageLayout
      title="Super Admin Dashboard"
      breadcrumbs={[{ label: "Super Admin", href: "/superadmin" }, { label: "Dashboard" }]}
    >
      {isLoading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size={40} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link href="/superadmin/tenants">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Manage Tenants</p>
                      <p className="text-2xl font-bold text-slate-900">{tenants?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/superadmin/plans">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Package className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Manage Plans</p>
                      <p className="text-2xl font-bold text-slate-900">{plans?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/superadmin/addons">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Plus className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Manage Addons</p>
                      <p className="text-2xl font-bold text-slate-900">{addons?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/superadmin/monitoring">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <Settings className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">System Monitoring</p>
                      <p className="text-2xl font-bold text-slate-900">View</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* System Health & Tenant Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SystemHealthCard data={systemHealth} loading={isLoading} />
            <TenantMetricsCard data={tenantMetrics} loading={isLoading} />
          </div>

          {/* Revenue Chart */}
          <RevenueChart data={revenue} loading={isLoading} />

          {/* Alerts & Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AlertSummaryCard data={alerts} loading={isLoading} />
            <RecentActivities activities={activities} loading={isLoading} />
          </div>
        </div>
      )}
    </PageLayout>
  );
}

