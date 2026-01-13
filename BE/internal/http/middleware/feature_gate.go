package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"rrnet/internal/auth"
)

// FeatureChecker is the minimal interface required to check plan/addon feature availability.
// Implemented by service.FeatureResolver.
type FeatureChecker interface {
	Has(ctx context.Context, tenantID uuid.UUID, featureCode string) bool
}

func sendFeatureForbidden(w http.ResponseWriter, message string, features []string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error":    "Forbidden",
		"message":  message,
		"features": features,
	})
}

func sendBadRequest(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error":   "Bad Request",
		"message": message,
	})
}

// RequireFeature blocks the request unless the tenant has the given feature.
// This is tier gating (plan/addon/toggle), NOT role RBAC.
func RequireFeature(checker FeatureChecker, featureCode string) func(http.Handler) http.Handler {
	return RequireAnyFeature(checker, featureCode)
}

// RequireAnyFeature blocks the request unless the tenant has at least one of the given features.
// This is tier gating (plan/addon/toggle), NOT role RBAC.
func RequireAnyFeature(checker FeatureChecker, featureCodes ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tenantID, ok := auth.GetTenantID(r.Context())
			if !ok || tenantID == uuid.Nil {
				sendBadRequest(w, "No tenant context")
				return
			}

			for _, code := range featureCodes {
				if code != "" && checker.Has(r.Context(), tenantID, code) {
					next.ServeHTTP(w, r)
					return
				}
			}

			sendFeatureForbidden(w, "feature not available for this tenant", featureCodes)
		})
	}
}


