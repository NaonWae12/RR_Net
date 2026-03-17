"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { setAccessToken, setTenantSlug } from "@/lib/api/apiClient";
import { authService } from "@/lib/api/authService";
import { Loader2 } from "lucide-react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (!accessToken || !refreshToken) {
      router.replace("/login?error=oauth_failed");
      return;
    }

    // 1. Inject token into apiClient so /auth/me call is authorized
    setAccessToken(accessToken);

    // 2. Fetch user profile from backend
    authService.me()
      .then((userProfile: any) => {
        // userProfile may contain user + tenant depending on the backend response shape
        const user = userProfile.user ?? userProfile;
        const tenant = userProfile.tenant ?? null;

        // 3. Sync auth state via the store (sets token in apiClient, persists sessionStorage)
        setAuth(user, tenant, accessToken, refreshToken);

        // 4. Set tenant slug in apiClient
        if (tenant?.slug) {
          setTenantSlug(tenant.slug);
        }

        // 5. Navigate to dashboard
        router.replace("/dashboard");
      })
      .catch(() => {
        // /auth/me failed - try navigating anyway with tokens we have
        // The AuthProvider will handle syncing user data
        useAuthStore.getState().hydrate({
          token: accessToken,
          refreshToken,
          isAuthenticated: true,
          ready: true,
        });

        const state = useAuthStore.getState();
        // Persist
        if (typeof window !== "undefined") {
          const snapshot = {
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            tenantSlug: state.tenantSlug ?? null,
            tenant: state.tenant ?? null,
            user: state.user ?? null,
          };
          window.sessionStorage.setItem("rrnet_auth_state", JSON.stringify(snapshot));
        }

        router.replace("/dashboard");
      });
  }, [searchParams, router, setAuth]);

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center space-y-4">
      <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold text-white">Authenticating...</h1>
        <p className="text-sm text-white/40">Please wait while we sync your secure session.</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CallbackHandler />
    </Suspense>
  );
}
