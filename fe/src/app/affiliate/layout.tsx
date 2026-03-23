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
      if (user.role !== "affiliate" && user.role !== "super_admin") {
        // Redirect non-affiliates to their correct system entry points
        if (user.role === "client") {
          router.replace("/portal/dashboard");
        } else if (user.role === "super_admin") {
          router.replace("/superadmin");
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
