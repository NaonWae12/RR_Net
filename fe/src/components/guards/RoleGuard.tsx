"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useMemo } from "react";

interface RoleGuardProps {
  roles: string | string[];
  operator?: "AND" | "OR";
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({
  roles,
  operator = "OR",
  fallback = null,
  children,
}: RoleGuardProps) {
  const { user } = useAuth();

  const hasAccess = useMemo(() => {
    if (!user?.role) {
      return false;
    }

    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    if (operator === "AND") {
      return requiredRoles.every((role) => user.role === role);
    } else {
      return requiredRoles.includes(user.role);
    }
  }, [user, roles, operator]);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

