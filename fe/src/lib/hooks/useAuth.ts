import { useCallback } from "react";
import { useAuthStore } from "../../stores/authStore";
import { toApiError } from "../utils/errors";
import type { LoginRequest } from "../api/types";

export function useAuth() {
  const { user, token, refreshToken, isLoading, error, login, logout, refresh } =
    useAuthStore();

  const loginSafe = useCallback(
    async (payload: LoginRequest, tenantSlug?: string | null) => {
      try {
        await login(payload, tenantSlug);
      } catch (err) {
        throw toApiError(err);
      }
    },
    [login]
  );

  const refreshSafe = useCallback(async () => {
    try {
      await refresh();
    } catch (err) {
      throw toApiError(err);
    }
  }, [refresh]);

  // isAuthenticated: true if token exists (user might not be loaded yet from localStorage)
  // This allows page refresh to work - token is checked first, user can be loaded later
  const isAuthenticated = Boolean(token);

  return {
    user,
    token,
    refreshToken,
    isLoading,
    error,
    login: loginSafe,
    logout,
    refresh: refreshSafe,
    isAuthenticated,
  };
}

