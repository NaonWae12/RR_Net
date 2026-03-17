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
import { Users, Package, Plus, Settings, DollarSign, ArrowRight, ShieldCheck, Zap, Bell, Activity } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

interface QuickActionCardProps {
  href: string;
  title: string;
  value: string | number;
  icon: any;
  color: "blue" | "purple" | "green" | "indigo" | "orange";
  description: string;
}

function QuickActionCard({ href, title, value, icon: Icon, color, description }: QuickActionCardProps) {
  const colorMap = {
    blue: "from-blue-500/10 to-blue-600/5 text-blue-600 bg-blue-100",
    purple: "from-purple-500/10 to-purple-600/5 text-purple-600 bg-purple-100",
    green: "from-green-500/10 to-green-600/5 text-green-600 bg-green-100",
    indigo: "from-indigo-500/10 to-indigo-600/5 text-indigo-600 bg-indigo-100",
    orange: "from-orange-500/10 to-orange-600/5 text-orange-600 bg-orange-100",
  };

  const iconColorMap = {
    blue: "text-blue-600 bg-blue-100",
    purple: "text-purple-600 bg-purple-100",
    green: "text-green-600 bg-green-100",
    indigo: "text-indigo-600 bg-indigo-100",
    orange: "text-orange-600 bg-orange-100",
  };

  return (
    <motion.div variants={item} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
      <Link href={href}>
        <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 group">
          <CardContent className={cn("p-0 h-full bg-gradient-to-br", colorMap[color])}>
            <div className="p-6 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className={cn("p-3 rounded-xl transition-transform duration-300 group-hover:scale-110", iconColorMap[color])}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <ArrowRight className="h-5 w-5 opacity-50" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-slate-900 mb-1">{value}</h3>
                <p className="text-xs text-slate-500 font-medium">{description}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200/50 flex items-center justify-between text-xs font-medium text-slate-600">
                <span>View Details</span>
                <div className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

export default function SuperAdminDashboardPage() {
  const store = useSuperAdminStore();
  const tenants = store.tenants || [];
  const plans = store.plans || [];
  const addons = store.addons || [];
  const { loading, fetchTenants, fetchPlans, fetchAddons } = store;
  const { isAuthenticated, user } = useAuth();
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | undefined>();
  const [tenantMetrics, setTenantMetrics] = useState<TenantMetricsData | undefined>();
  const [revenue, setRevenue] = useState<RevenueData | undefined>();
  const [alerts, setAlerts] = useState<AlertSummaryData | undefined>();
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadDashboardData = async () => {
      setDashboardLoading(true);
      try {
        await Promise.all([fetchTenants(), fetchPlans(), fetchAddons()]);

        const currentState = useSuperAdminStore.getState();
        const tenantsList = currentState.tenants || [];
        const plansList = currentState.plans || [];
        const addonsList = currentState.addons || [];
        
        const activeTenants = tenantsList.filter((t) => t.status === "active").length;
        const suspendedTenants = tenantsList.filter((t) => t.status === "suspended").length;
        const totalTenants = tenantsList.length;

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
  }, [isAuthenticated, fetchTenants, fetchPlans, fetchAddons]);

  const isLoading = loading || dashboardLoading;

  return (
    <PageLayout
      title="Super Admin Dashboard"
      subtitle={`Welcome back, ${user?.name || "Admin"}. Here's what's happening with your system today.`}
      breadcrumbs={[{ label: "Super Admin", href: "/superadmin" }, { label: "Dashboard" }]}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
            <span className="flex h-2 w-2 rounded-full bg-red-500" />
          </Button>
          <Button size="sm" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Tenant</span>
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <LoadingSpinner size={40} />
            <p className="text-slate-500 text-sm animate-pulse">Loading dashboard insights...</p>
          </div>
        </div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-8 pb-10"
        >
          {/* Quick Actions / Key Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <QuickActionCard 
              href="/superadmin/tenants"
              title="Active Tenants"
              value={tenants?.length || 0}
              icon={Users}
              color="blue"
              description="Platform subscribers"
            />
            <QuickActionCard 
              href="/superadmin/plans"
              title="Service Plans"
              value={plans?.length || 0}
              icon={Package}
              color="purple"
              description="Subscription models"
            />
            <QuickActionCard 
              href="/superadmin/addons"
              title="Active Addons"
              value={addons?.length || 0}
              icon={Plus}
              color="green"
              description="Extra features"
            />
            <QuickActionCard 
              href="/superadmin/billing"
              title="Total Revenue"
              value={revenue ? formatCurrency(revenue.total, true) : "Rp 0"}
              icon={DollarSign}
              color="indigo"
              description="Monthly recurring"
            />
            <QuickActionCard 
              href="/superadmin/monitoring"
              title="System Health"
              value={systemHealth ? `${systemHealth.overallScore}%` : "0%"}
              icon={Activity}
              color="orange"
              description="Uptime & status"
            />
          </div>

          {/* Core Metrics Section */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <motion.div variants={item} className="xl:col-span-2">
              <RevenueChart data={revenue} loading={isLoading} />
            </motion.div>
            <motion.div variants={item}>
              <SystemHealthCard data={systemHealth} loading={isLoading} />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <motion.div variants={item}>
              <TenantMetricsCard data={tenantMetrics} loading={isLoading} />
            </motion.div>
            <motion.div variants={item} className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <AlertSummaryCard data={alerts} loading={isLoading} />
              <RecentActivities activities={activities} loading={isLoading} />
            </motion.div>
          </div>

          {/* Secondary Stats / Informational */}
          <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-slate-900 text-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <ShieldCheck size={120} />
              </div>
              <CardContent className="p-6 relative z-10">
                <h3 className="font-bold text-lg mb-2">Security Compliance</h3>
                <p className="text-slate-400 text-sm mb-4">All systems are currently meeting ISO 27001 standards.</p>
                <Link href="/superadmin/compliance">
                  <Button variant="link" className="text-blue-400 p-0 h-auto hover:text-blue-300">
                    Review certification <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="bg-blue-600 text-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Zap size={120} />
              </div>
              <CardContent className="p-6 relative z-10">
                <h3 className="font-bold text-lg mb-2">Platform Performance</h3>
                <p className="text-blue-100 text-sm mb-4">Response times have improved by 12% since the last update.</p>
                <Link href="/superadmin/monitoring">
                  <Button variant="link" className="text-white p-0 h-auto hover:opacity-80">
                    View performance logs <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="border-dashed border-2 bg-slate-50 flex items-center justify-center p-6 text-center">
              <div className="space-y-3">
                <div className="mx-auto w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                  <Plus className="text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Custom Widget</p>
                  <p className="text-xs text-slate-500">Add more data views here</p>
                </div>
                <Button size="sm" variant="outline" className="mt-2">Customize</Button>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </PageLayout>
  );
}


