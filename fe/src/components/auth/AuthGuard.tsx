"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../stores/authStore";
import { useAuth } from "../../lib/hooks/useAuth";

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const router = useRouter();

  useEffect(() => {
    // Only redirect if hydrated and not loading and not authenticated
    if (isHydrated && !isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isHydrated, isLoading, isAuthenticated, router]);

  // Show nothing while hydrating or loading
  if (!isHydrated || isLoading) return null;
  
  // Show nothing if not authenticated (will redirect)
  if (!isAuthenticated) return null;
  
  return <>{children}</>;
};


