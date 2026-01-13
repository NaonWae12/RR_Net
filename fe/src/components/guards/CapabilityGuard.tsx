"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useMemo } from "react";

interface CapabilityGuardProps {
  capabilities: string | string[];
  operator?: "AND" | "OR";
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function CapabilityGuard({
  capabilities,
  operator = "OR",
  fallback = null,
  children,
}: CapabilityGuardProps) {
  const { user } = useAuth();

  const hasAccess = useMemo(() => {
    if (!user?.capabilities || !user?.capabilities.length) {
      return false;
    }

    const requiredCaps = Array.isArray(capabilities) ? capabilities : [capabilities];
    const userCaps = user.capabilities;

    if (operator === "AND") {
      return requiredCaps.every((cap) => userCaps.includes(cap));
    } else {
      return requiredCaps.some((cap) => userCaps.includes(cap));
    }
  }, [user, capabilities, operator]);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

