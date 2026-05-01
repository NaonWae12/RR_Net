"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Pencil,
  Check,
  CreditCard,
  Calendar,
  Layers,
  Activity,
  Globe,
  Hash,
  Clock,
  Tag,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { featureService } from "@/lib/api/featureService";
import type { Feature } from "@/lib/api/types";

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { plan, loading, error, fetchPlan, clearPlan } = useSuperAdminStore();
  const [featureCatalog, setFeatureCatalog] = useState<Feature[]>([]);

  useEffect(() => {
    if (id) {
      fetchPlan(id);
    }
    return () => {
      clearPlan();
    };
  }, [id, fetchPlan, clearPlan]);

  // Load feature catalog to display readable feature names
  useEffect(() => {
    const loadFeatures = async () => {
      try {
        const catalog = await featureService.getFeatures();
        setFeatureCatalog(catalog);
      } catch (err) {
        console.error("Failed to load feature catalog:", err);
      }
    };
    loadFeatures();
  }, []);

  // Create feature code to name mapping
  const featureMap = useMemo(() => {
    const map = new Map<string, string>();
    featureCatalog.forEach((f) => map.set(f.code, f.name));
    return map;
  }, [featureCatalog]);

  // Get feature display names
  const getFeatureDisplayName = (code: string): string => {
    if (code === "*") {
      return "All Features (Multi-tenant SaaS - Super Admin)";
    }
    return featureMap.get(code) || code;
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
        <div className="text-red-600 font-medium text-lg">Error loading plan</div>
        <p className="text-slate-500">{error}</p>
        <Button onClick={() => router.push("/superadmin/plans")}>Back to Plans</Button>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
        <div className="text-slate-900 font-medium text-lg">Plan not found</div>
        <Button onClick={() => router.push("/superadmin/plans")}>Back to Plans</Button>
      </div>
    );
  }

  // Check if plan has wildcard feature (Enterprise plan)
  const hasWildcardFeature = plan.features && plan.features.includes("*");

  // Get all features if wildcard, otherwise use plan features
  const displayFeatures = hasWildcardFeature
    ? featureCatalog.map((f) => f.code)
    : plan.features || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center text-sm text-slate-500 mb-2">
            <span
              className="cursor-pointer hover:text-slate-900 transition-colors"
              onClick={() => router.push("/superadmin/plans")}
            >
              Plans
            </span>
            <span className="mx-2">/</span>
            <span className="font-medium text-slate-900 truncate max-w-[200px] md:max-w-xs">{plan.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{plan.name}</h1>
            <Badge variant={plan.is_active ? "success" : "secondary"} className="h-6">
              {plan.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/superadmin/plans")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Button onClick={() => router.push(`/superadmin/plans/${plan.id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit Plan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Description Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <Tag className="h-5 w-5 mr-2 text-slate-500" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 leading-relaxed">
                {plan.description || <span className="text-slate-400 italic">No description provided for this plan.</span>}
              </p>
            </CardContent>
          </Card>

          {/* Limits Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <Activity className="h-5 w-5 mr-2 text-slate-500" />
                Plan Limits
              </CardTitle>
              <CardDescription>Defined usage limits for tenants on this plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(plan.limits)
                  .filter(([key]) => {
                    // Skip max_user(s) as requested
                    if (key === "max_user" || key === "max_users") return false;

                    if (key === "rbac_client_reseller") {
                      const hasRbacClientReseller =
                        plan.features?.includes("rbac_client_reseller") ||
                        plan.features?.includes("*");
                      return hasRbacClientReseller;
                    }
                    return true;
                  })
                  .map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
                    >
                      <span className="text-sm font-medium text-slate-600 capitalize">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="text-lg font-bold text-slate-900">{value}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Features Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <Layers className="h-5 w-5 mr-2 text-slate-500" />
                Included Features
                <Badge variant="secondary" className="ml-3 rounded-full text-xs font-normal">
                  {displayFeatures ? displayFeatures.length : 0}
                </Badge>
              </CardTitle>
              <CardDescription>Modules and capabilities enabled for this plan</CardDescription>
            </CardHeader>
            <CardContent>
              {displayFeatures && displayFeatures.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  {displayFeatures.map((feature, idx) => {
                    const displayName = getFeatureDisplayName(feature);
                    return (
                      <div key={idx} className="flex items-start">
                        <div className="mt-1 mr-3 flex-shrink-0">
                          {hasWildcardFeature ? (
                            <ShieldCheck className="h-4 w-4 text-purple-600" />
                          ) : (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{displayName}</p>
                          {featureMap.has(feature) && feature !== "*" && (
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{feature}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 border-2 border-dashed rounded-lg">
                  No features assigned to this plan.
                </div>
              )}

              
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary & Meta */}
        <div className="space-y-8">
          {/* Pricing Card */}
          <Card className="border-l-4 border-l-blue-600">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <CreditCard className="h-5 w-5 mr-2 text-slate-500" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Monthly Billing</p>
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-slate-900">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: plan.currency || "IDR",
                    }).format(plan.price_monthly)}
                  </span>
                  <span className="ml-2 text-sm text-slate-500">/ mo</span>
                </div>
              </div>

              {plan.price_yearly !== undefined && (
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm font-medium text-slate-500 mb-1">Yearly Billing</p>
                  <div className="flex items-baseline">
                    <span className="text-2xl font-bold text-slate-900">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: plan.currency || "IDR",
                      }).format(plan.price_yearly)}
                    </span>
                    <span className="ml-2 text-sm text-slate-500">/ yr</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan Meta Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm text-slate-600">
                  <Hash className="h-4 w-4 mr-2" /> Code
                </div>
                <span className="font-mono text-sm font-medium bg-slate-100 px-2 py-1 rounded">
                  {plan.code}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm text-slate-600">
                  <Globe className="h-4 w-4 mr-2" /> Visibility
                </div>
                <Badge variant={plan.is_public ? "default" : "outline"}>
                  {plan.is_public ? "Public" : "Private"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm text-slate-600">
                  <Layers className="h-4 w-4 mr-2" /> Sort Order
                </div>
                <span className="font-medium text-slate-900">{plan.sort_order}</span>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div>
                  <div className="flex items-center text-xs font-medium text-slate-500 mb-1">
                    <Clock className="h-3 w-3 mr-1" /> Created At
                  </div>
                  <p className="text-sm text-slate-900">
                    {format(new Date(plan.created_at), "PPP p")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Debug Info (Collapsed by default) */}
          <details className="text-xs text-slate-400 cursor-pointer">
            <summary className="hover:text-slate-600 transition-colors">Debug Information</summary>
            <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200 overflow-auto max-h-60">
                <pre className="whitespace-pre-wrap font-mono">
                    {JSON.stringify(plan, null, 2)}
                </pre>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

