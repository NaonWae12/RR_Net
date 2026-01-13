package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"rrnet/internal/auth"
	"rrnet/internal/repository"
)

type tenantContextKey string

const (
	TenantSubdomainKey tenantContextKey = "tenant_subdomain"
)

type tenantResolver struct {
	repo *repository.TenantRepository
}

// TenantContext resolves tenant by subdomain or X-Tenant-Slug header and injects tenant_id + slug into context.
// If no subdomain/header is present, it leaves tenant empty (useful for super_admin).
func TenantContext(repo *repository.TenantRepository) func(http.Handler) http.Handler {
	resolver := tenantResolver{repo: repo}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Public endpoints which resolve tenant internally (e.g. via NAS-IP) must not be blocked by host subdomain parsing.
			if strings.HasPrefix(r.URL.Path, "/api/v1/radius/") {
				next.ServeHTTP(w, r)
				return
			}

			slug := strings.TrimSpace(r.Header.Get("X-Tenant-Slug"))
			if slug == "" {
				slug = resolver.extractSubdomain(r.Host)
			}

			// If no slug, continue without tenant context (super_admin or public routes)
			if slug == "" {
				log.Printf("[tenant_ctx] no slug for path=%s host=%s", r.URL.Path, r.Host)
				ctx := context.WithValue(r.Context(), TenantSubdomainKey, "")
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			tenant, err := repo.GetBySlug(r.Context(), slug)
			if err != nil {
				if errors.Is(err, repository.ErrTenantNotFound) {
					log.Printf("[tenant_ctx] slug not found slug=%s", slug)
					writeJSON(w, http.StatusNotFound, map[string]string{"error": "Tenant not found"})
					return
				}
				log.Printf("[tenant_ctx] slug lookup error slug=%s err=%v", slug, err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to resolve tenant"})
				return
			}

			if !tenant.CanAccess() {
				log.Printf("[tenant_ctx] tenant not active slug=%s status=%s", slug, tenant.Status)
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "Tenant not active"})
				return
			}

			log.Printf("[tenant_ctx] resolved slug=%s tenant_id=%s", slug, tenant.ID.String())
			ctx := context.WithValue(r.Context(), TenantSubdomainKey, tenant.Slug)
			ctx = auth.SetTenantID(ctx, tenant.ID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetTenantSubdomain retrieves the tenant subdomain from context.
func GetTenantSubdomain(ctx context.Context) string {
	if subdomain, ok := ctx.Value(TenantSubdomainKey).(string); ok {
		return subdomain
	}
	return ""
}

// extractSubdomain extracts subdomain from host.
// Example: "tenant.rrnet.id" -> "tenant"
func (tenantResolver) extractSubdomain(host string) string {
	// Remove port if present
	if idx := strings.Index(host, ":"); idx != -1 {
		host = host[:idx]
	}

	parts := strings.Split(host, ".")
	if len(parts) > 2 {
		return parts[0]
	}

	return ""
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

