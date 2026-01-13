package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"rrnet/internal/auth"
)

const SuperAdminContextKey contextKey = "super_admin"

// extractToken extracts token from Authorization header
func extractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}
	return parts[1]
}

// SuperAdminMiddleware ensures the user is a super admin
func SuperAdminMiddleware(jwtManager *auth.JWTManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractToken(r)
			if token == "" {
				http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
				return
			}

			claims, err := jwtManager.ValidateAccessToken(token)
			if err != nil {
				http.Error(w, `{"error":"Invalid token"}`, http.StatusUnauthorized)
				return
			}

			// Check if user is super admin
			// Super admin can be identified by:
			// 1. TenantID == uuid.Nil (traditional way - tenant_id IS NULL in database)
			// 2. OR role == "super_admin" (fallback - in case tenant_id is set but role is super_admin)
			isSuperAdmin := claims.TenantID == uuid.Nil || claims.Role == "super_admin"
			
			// Debug logging
			log.Info().
				Str("tenant_id", claims.TenantID.String()).
				Str("role", claims.Role).
				Bool("tenant_id_nil", claims.TenantID == uuid.Nil).
				Bool("role_super_admin", claims.Role == "super_admin").
				Bool("is_super_admin", isSuperAdmin).
				Str("path", r.URL.Path).
				Msg("[SuperAdminMiddleware] Checking super admin access")
			
			if !isSuperAdmin {
				log.Warn().
					Str("tenant_id", claims.TenantID.String()).
					Str("role", claims.Role).
					Str("path", r.URL.Path).
					Msg("[SuperAdminMiddleware] Access denied - not super admin")
				http.Error(w, `{"error":"Super admin access required"}`, http.StatusForbidden)
				return
			}

			// Add super admin context and also set auth context (claims, userID, tenantID, role)
			// This ensures handlers can access role and other auth info from context
			ctx := r.Context()
			ctx = context.WithValue(ctx, SuperAdminContextKey, true)
			ctx = auth.SetClaims(ctx, claims)
			ctx = auth.SetUserID(ctx, claims.UserID)
			ctx = auth.SetTenantID(ctx, claims.TenantID)
			ctx = auth.SetRole(ctx, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// IsSuperAdmin checks if the request is from a super admin
func IsSuperAdmin(ctx context.Context) bool {
	val := ctx.Value(SuperAdminContextKey)
	return val != nil && val.(bool)
}

