"use client";

import { createContext, useContext, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { token, user, isLoading, refresh } = useAuthStore();

  // Attempt refresh on mount if refresh token exists
  useEffect(() => {
    const state = useAuthStore.getState();
    // Only try to refresh if we have a refresh token but no access token
    // And if not already ready (to avoid duplicate refresh calls)
    if (!token && state.refreshToken && !state.ready) {
      void refresh();
    }
  }, [token, refresh]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: Boolean(token && user),
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);

