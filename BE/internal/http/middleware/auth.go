package middleware

import (
	"net/http"
	"strings"

	"rrnet/internal/auth"
)

// AuthMiddleware creates middleware that validates JWT tokens
func AuthMiddleware(jwtManager *auth.JWTManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error":"Authorization header required"}`, http.StatusUnauthorized)
				return
			}

			// Check Bearer prefix
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, `{"error":"Invalid authorization format"}`, http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]

			// Validate token
			claims, err := jwtManager.ValidateAccessToken(tokenString)
			if err != nil {
				switch err {
				case auth.ErrExpiredToken:
					http.Error(w, `{"error":"Token expired"}`, http.StatusUnauthorized)
				default:
					http.Error(w, `{"error":"Invalid token"}`, http.StatusUnauthorized)
				}
				return
			}

			// Inject claims into context
			ctx := r.Context()
			ctx = auth.SetClaims(ctx, claims)
			ctx = auth.SetUserID(ctx, claims.UserID)
			ctx = auth.SetTenantID(ctx, claims.TenantID)
			ctx = auth.SetRole(ctx, claims.Role)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth creates middleware that validates JWT if present, but doesn't require it
func OptionalAuth(jwtManager *auth.JWTManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				next.ServeHTTP(w, r)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				next.ServeHTTP(w, r)
				return
			}

			tokenString := parts[1]
			claims, err := jwtManager.ValidateAccessToken(tokenString)
			if err != nil {
				// Token invalid, but optional - continue without auth context
				next.ServeHTTP(w, r)
				return
			}

			// Inject claims into context
			ctx := r.Context()
			ctx = auth.SetClaims(ctx, claims)
			ctx = auth.SetUserID(ctx, claims.UserID)
			ctx = auth.SetTenantID(ctx, claims.TenantID)
			ctx = auth.SetRole(ctx, claims.Role)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}





























