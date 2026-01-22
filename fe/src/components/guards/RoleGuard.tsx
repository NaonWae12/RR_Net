"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useMemo, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Role } from "@/lib/api/types";
import { getEffectiveRole } from "@/lib/utils/roleContext";

interface RoleGuardProps {
  allowedRoles: Role[];
  redirectTo?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * RoleGuard component for page-level access control
 * Uses effectiveRole (activeRole if admin switched, otherwise originalRole)
 * 
 * @param allowedRoles - Array of roles that can access this page
 * @param redirectTo - Redirect path when access is denied (default: /dashboard)
 * @param fallback - Custom fallback UI (if not provided, redirects automatically)
 * @param children - Page content to render if access is granted
 * 
 * Note: Technician can also access collector-restricted pages (collector is subset of technician)
 * Note: Admin can access any page even when switched (uses effectiveRole for UI, but allows access)
 */
export function RoleGuard({
  allowedRoles,
  redirectTo = "/dashboard",
  fallback = null,
  children,
}: RoleGuardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const hasAccess = useMemo(() => {
    if (!user?.role) {
      return false;
    }

    // Get effective role (activeRole if admin switched, otherwise originalRole)
    const effectiveRole = getEffectiveRole(user.role);
    const isSwitched = effectiveRole !== user.role;

    // STRICT MODE: When admin is switched, use effectiveRole strictly
    // Admin should NOT be able to access admin-only pages when switched
    if (isSwitched) {
      // Exception: Always allow dashboard access so admin can return to admin mode
      if (pathname === "/dashboard") {
        return true;
      }

      // Use effectiveRole for access control
      if (effectiveRole && allowedRoles.includes(effectiveRole)) {
        return true;
      }
      // Technician can access collector-restricted pages
      if (effectiveRole === "technician" && allowedRoles.includes("collector")) {
        return true;
      }
      // If switched role is not allowed, deny access
      return false;
    }

    // Normal mode: Use original role logic
    // Direct role match
    if (user.role && allowedRoles.includes(user.role)) {
      return true;
    }

    // Technician can access collector-restricted pages
    if (user.role === "technician" && allowedRoles.includes("collector")) {
      return true;
    }

    // Admin/Owner can access any page when NOT switched
    if (user.role === "admin" || user.role === "owner") {
      return true;
    }

    return false;
  }, [user?.role, allowedRoles, pathname]);

  useEffect(() => {
    if (!hasAccess && user?.role) {
      // Only redirect if user is authenticated (to avoid redirect loop)
      router.replace(redirectTo);
    }
  }, [hasAccess, user?.role, redirectTo, router]);

  if (!hasAccess) {
    // Show fallback if provided, otherwise show nothing (redirect will happen)
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

