"use client";

import { useEffect } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuthStore } from "@/stores/authStore";
import { useRouter, usePathname } from "next/navigation";

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const ready = useAuthStore((state) => state.ready);

  const isDashboard = pathname.startsWith("/affiliate/dashboard");

  useEffect(() => {
    // SECURITY: Only enforce role checks for the dashboard area
    if (ready && user && isDashboard) {
      const allowedRoles = ["affiliate", "super_admin", "owner", "tenant_admin"];
      
      if (!allowedRoles.includes(user.role)) {
        // Redirect non-affiliates to their correct system entry points
        if (user.role === "client") {
          router.replace("/portal/dashboard");
        } else {
          router.replace("/dashboard");
        }
      }
    }
  }, [ready, user, router, isDashboard]);

  // Wrap with AuthGuard only for dashboard paths
  if (isDashboard) {
    return (
      <AuthGuard>
        {children}
      </AuthGuard>
    );
  }

  return <>{children}</>;
}
