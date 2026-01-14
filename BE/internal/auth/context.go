package auth

import (
	"context"

	"github.com/google/uuid"
)

// Context keys for auth data
type contextKey string

const (
	userIDKey   contextKey = "user_id"
	tenantIDKey contextKey = "tenant_id"
	roleKey     contextKey = "role"
	claimsKey   contextKey = "claims"
)

// SetUserID sets the user ID in context
func SetUserID(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}

// GetUserID retrieves the user ID from context
func GetUserID(ctx context.Context) (uuid.UUID, bool) {
	userID, ok := ctx.Value(userIDKey).(uuid.UUID)
	return userID, ok
}

// SetTenantID sets the tenant ID in context
func SetTenantID(ctx context.Context, tenantID uuid.UUID) context.Context {
	return context.WithValue(ctx, tenantIDKey, tenantID)
}

// GetTenantID retrieves the tenant ID from context
func GetTenantID(ctx context.Context) (uuid.UUID, bool) {
	tenantID, ok := ctx.Value(tenantIDKey).(uuid.UUID)
	return tenantID, ok
}

// SetRole sets the role in context
func SetRole(ctx context.Context, role string) context.Context {
	return context.WithValue(ctx, roleKey, role)
}

// GetRole retrieves the role from context
func GetRole(ctx context.Context) (string, bool) {
	role, ok := ctx.Value(roleKey).(string)
	return role, ok
}

// SetClaims sets the full claims in context
func SetClaims(ctx context.Context, claims *Claims) context.Context {
	return context.WithValue(ctx, claimsKey, claims)
}

// GetClaims retrieves the full claims from context
func GetClaims(ctx context.Context) (*Claims, bool) {
	claims, ok := ctx.Value(claimsKey).(*Claims)
	return claims, ok
}






























