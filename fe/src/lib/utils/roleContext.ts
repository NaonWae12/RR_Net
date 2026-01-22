/**
 * Role Context Utilities (FE-only)
 * 
 * Manages active role context for admin role switching.
 * This is a UI-only feature, does not affect backend/auth.
 */

import { Role } from "@/lib/api/types";

export const ROLE_CONTEXT_STORAGE_KEY = "rrnet_active_role_context";
export const ROLE_CONTEXT_CHANGE_EVENT = "rrnet_role_context_changed";

export interface RoleContext {
  originalRole: Role;
  activeRole: Role;
  switchedFrom: Role;
  switchedAt: string; // ISO date string
}

/**
 * Get the effective role (activeRole if admin is switched, otherwise originalRole)
 */
export function getEffectiveRole(originalRole?: Role): Role | undefined {
  if (!originalRole) return undefined;
  
  // Only admin can switch roles
  if (originalRole !== "admin" && originalRole !== "owner") {
    return originalRole;
  }

  try {
    const contextStr = localStorage.getItem(ROLE_CONTEXT_STORAGE_KEY);
    if (!contextStr) return originalRole;

    const context: RoleContext = JSON.parse(contextStr);
    
    // Validate context
    if (context.originalRole === originalRole && context.activeRole) {
      return context.activeRole;
    }
  } catch (error) {
    // Invalid context, clear it
    clearRoleContext();
  }

  return originalRole;
}

/**
 * Set active role context (switch role)
 */
export function setActiveRole(originalRole: Role, targetRole: Role): void {
  if (originalRole !== "admin" && originalRole !== "owner") {
    throw new Error("Only admin can switch roles");
  }

  const context: RoleContext = {
    originalRole,
    activeRole: targetRole,
    switchedFrom: originalRole,
    switchedAt: new Date().toISOString(),
  };

  localStorage.setItem(ROLE_CONTEXT_STORAGE_KEY, JSON.stringify(context));
  
  // Dispatch custom event to notify components of role context change
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROLE_CONTEXT_CHANGE_EVENT, { detail: context }));
  }
}

/**
 * Clear role context (return to original role)
 */
export function clearRoleContext(): void {
  localStorage.removeItem(ROLE_CONTEXT_STORAGE_KEY);
  
  // Dispatch custom event to notify components of role context change
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROLE_CONTEXT_CHANGE_EVENT, { detail: null }));
  }
}

/**
 * Get current role context (if any)
 */
export function getRoleContext(): RoleContext | null {
  try {
    const contextStr = localStorage.getItem(ROLE_CONTEXT_STORAGE_KEY);
    if (!contextStr) return null;

    return JSON.parse(contextStr) as RoleContext;
  } catch (error) {
    clearRoleContext();
    return null;
  }
}

/**
 * Check if user is currently switched to a different role
 */
export function isRoleSwitched(originalRole?: Role): boolean {
  if (!originalRole) return false;
  const effectiveRole = getEffectiveRole(originalRole);
  return effectiveRole !== originalRole;
}

