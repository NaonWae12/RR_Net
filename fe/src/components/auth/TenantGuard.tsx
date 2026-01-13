"use client";

import { useEffect } from "react";
import { useTenant } from "../../lib/hooks/useTenant";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";

export const TenantGuard: React.FC<{
  slug?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ slug, children, fallback = null }) => {
  const { tenant, loading, resolved, error, resolveTenant } = useTenant();
  const authTenant = useAuthStore((state) => state.tenant);
  const authTenantSlug = useAuthStore((state) => state.tenantSlug);

  useEffect(() => {
    // If tenant already exists in tenantStore, skip resolve
    if (tenant && resolved) {
      return;
    }
    
    // If tenant exists in authStore but not in tenantStore, sync it
    if (authTenant && authTenantSlug && !tenant) {
      useTenantStore.getState().setTenant(authTenant, authTenantSlug);
      return;
    }
    
    // Otherwise, resolve tenant
    if (!resolved && !authTenant) {
      void resolveTenant(slug);
    }
  }, [resolved, resolveTenant, slug, tenant, authTenant, authTenantSlug]);

  // Use tenant from tenantStore or authStore
  const currentTenant = tenant || authTenant;

  if (loading || (!resolved && !authTenant)) return null;
  if (error || !currentTenant) return <>{fallback}</>;
  return <>{children}</>;
};


