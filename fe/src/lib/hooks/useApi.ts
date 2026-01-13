import { useMemo } from "react";
import { apiClient, setAccessToken } from "../api/apiClient";
import { useAuthStore } from "../../stores/authStore";

export function useApi() {
  const token = useAuthStore((s) => s.token);

  return useMemo(() => {
    setAccessToken(token);
    return apiClient;
  }, [token]);
}

