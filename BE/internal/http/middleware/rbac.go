package middleware

import (
	"encoding/json"
	"net/http"

	"rrnet/internal/auth"
	"rrnet/internal/rbac"
)

// RBACMiddleware creates middleware that checks capabilities
func RBACMiddleware(rbacService *rbac.Service, requiredCapabilities ...rbac.Capability) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get role from context (set by auth middleware)
			role, ok := auth.GetRole(r.Context())
			if !ok {
				sendForbiddenResponse(w, "role not found in context")
				return
			}

			// Check if user has any of the required capabilities
			if !rbacService.HasAnyCapability(role, requiredCapabilities...) {
				sendForbiddenResponse(w, "you do not have permission to perform this action")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireCapability creates middleware that requires a specific capability
func RequireCapability(rbacService *rbac.Service, capability rbac.Capability) func(http.Handler) http.Handler {
	return RBACMiddleware(rbacService, capability)
}

// RequireAnyCapability creates middleware that requires any of the capabilities
func RequireAnyCapability(rbacService *rbac.Service, capabilities ...rbac.Capability) func(http.Handler) http.Handler {
	return RBACMiddleware(rbacService, capabilities...)
}

// RequireAllCapabilities creates middleware that requires all capabilities
func RequireAllCapabilities(rbacService *rbac.Service, capabilities ...rbac.Capability) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := auth.GetRole(r.Context())
			if !ok {
				sendForbiddenResponse(w, "role not found in context")
				return
			}

			if !rbacService.HasAllCapabilities(role, capabilities...) {
				sendForbiddenResponse(w, "you do not have permission to perform this action")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireRole creates middleware that requires a specific role
func RequireRole(roles ...rbac.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := auth.GetRole(r.Context())
			if !ok {
				sendForbiddenResponse(w, "role not found in context")
				return
			}

			hasRole := false
			for _, allowedRole := range roles {
				if role == string(allowedRole) {
					hasRole = true
					break
				}
			}

			if !hasRole {
				sendForbiddenResponse(w, "insufficient role")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireSuperAdmin creates middleware that only allows super_admin
func RequireSuperAdmin() func(http.Handler) http.Handler {
	return RequireRole(rbac.RoleSuperAdmin)
}

// RequireTenantAdmin creates middleware that allows owner or admin
func RequireTenantAdmin() func(http.Handler) http.Handler {
	return RequireRole(rbac.RoleOwner, rbac.RoleAdmin)
}

func sendForbiddenResponse(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   "Forbidden",
		"message": message,
	})
}





























