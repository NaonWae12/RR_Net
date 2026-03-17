"use client";

import React from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Globe, CreditCard, Calendar } from "lucide-react";
import { useDashboardStore } from "@/stores/dashboardStore";

export function TenantTab() {
  const { tenant } = useAuth();
  const { data: dashboardData } = useDashboardStore();
  const plan = dashboardData?.plan;

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-xl">Organization Details</CardTitle>
          <CardDescription>
            Configuration and details for your RRNet tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tenant-name" className="text-slate-500">Organization Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="tenant-name"
                  value={tenant.name}
                  readOnly
                  className="pl-10 bg-slate-50 border-slate-200 cursor-default"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-slug" className="text-slate-500">Tenant Slug</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="tenant-slug"
                  value={tenant.slug}
                  readOnly
                  className="pl-10 bg-slate-50 border-slate-200 cursor-default"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-500">Active Subscription Plan</Label>
              <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-md shadow-sm">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{plan?.name || "Loading..."}</p>
                    <p className="text-xs text-slate-500 capitalize">Status: {tenant.status}</p>
                  </div>
                </div>
                <Badge className="bg-indigo-600 hover:bg-indigo-700">Active</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-500">Created At</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={new Date(tenant.created_at).toLocaleDateString()}
                  readOnly
                  className="pl-10 bg-slate-50 border-slate-200 cursor-default"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {tenant.status === 'pending' && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex gap-3">
          <div className="shrink-0 pt-0.5">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Pending Approval</p>
            <p className="mt-1">Akun tenant Anda sedang menunggu persetujuan dari Super Admin. Beberapa fitur mungkin dibatasi hingga akun disetujui.</p>
          </div>
        </div>
      )}
    </div>
  );
}
