import { useAuth } from "./useAuth";
import { getEffectiveRole, getRoleContext, isRoleSwitched, ROLE_CONTEXT_CHANGE_EVENT } from "@/lib/utils/roleContext";
import { useMemo, useState, useEffect } from "react";

/**
 * Hook to check user role and permissions
 * Uses effectiveRole (role context if admin switched, otherwise original role)
 */
export function useRole() {
  const { user } = useAuth();
  const [roleContextVersion, setRoleContextVersion] = useState(0);

  // Listen for role context changes
  useEffect(() => {
    const handleRoleContextChange = () => {
      setRoleContextVersion((prev) => prev + 1);
    };

    window.addEventListener(ROLE_CONTEXT_CHANGE_EVENT, handleRoleContextChange);
    return () => {
      window.removeEventListener(ROLE_CONTEXT_CHANGE_EVENT, handleRoleContextChange);
    };
  }, []);

  // Get effective role (activeRole if admin switched, otherwise originalRole)
  // Include roleContextVersion in dependency to trigger re-computation when role context changes
  const effectiveRole = useMemo(() => getEffectiveRole(user?.role), [user?.role, roleContextVersion]);
  const roleContext = useMemo(() => getRoleContext(), [roleContextVersion]);
  const switched = useMemo(() => isRoleSwitched(user?.role), [user?.role, roleContextVersion]);

  // Use effectiveRole for all checks
  const isTechnician = effectiveRole === "technician";
  const isAdmin = effectiveRole === "admin" || effectiveRole === "owner";
  const isCollector = effectiveRole === "collector";
  const isFinance = effectiveRole === "finance";
  const isHR = effectiveRole === "hr";

  // Original role checks (for admin-only features like role switching)
  const originalIsAdmin = user?.role === "admin" || user?.role === "owner";

  const canManageTasks = isAdmin; // Only admin/owner can create/edit/delete tasks
  const canViewAllTasks = isAdmin; // Only admin can see all tasks
  const canViewAllActivities = isAdmin; // Only admin can see all activities

  return {
    user,
    role: effectiveRole, // Effective role (switched if applicable)
    originalRole: user?.role, // Original role from auth
    isTechnician,
    isAdmin,
    isCollector,
    isFinance,
    isHR,
    canManageTasks,
    canViewAllTasks,
    canViewAllActivities,
    userId: user?.id,
    // Role switching context
    roleContext,
    switched,
    canSwitchRole: originalIsAdmin, // Only original admin can switch roles
  };
}

