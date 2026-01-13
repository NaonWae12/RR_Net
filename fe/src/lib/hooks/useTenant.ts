import { useCallback, useEffect } from "react";
import { useTenantStore } from "../../stores/tenantStore";
import { toApiError } from "../utils/errors";

export function useTenant() {
  const { tenant, slug, loading, error, resolved, resolveTenant, setSlug, clear } =
    useTenantStore();

  useEffect(() => {
    if (!resolved) {
      void resolveTenant(slug);
    }
  }, [resolved, slug, resolveTenant]);

  const resolve = useCallback(
    async (s?: string | null) => {
      try {
        await resolveTenant(s);
      } catch (err) {
        throw toApiError(err);
      }
    },
    [resolveTenant]
  );

  return {
    tenant,
    slug,
    loading,
    error,
    resolved,
    setSlug,
    clear,
    resolveTenant: resolve,
  };
}


