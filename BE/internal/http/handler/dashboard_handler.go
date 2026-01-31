package handler

import (
	"net/http"

	"rrnet/internal/auth"
	"rrnet/internal/service"

	"github.com/google/uuid"
)

// DashboardHandler handles dashboard-related HTTP requests
type DashboardHandler struct {
	clientService   *service.ClientService
	planService     *service.PlanService
	featureResolver *service.FeatureResolver
	limitResolver   *service.LimitResolver
}

// NewDashboardHandler creates a new dashboard handler
func NewDashboardHandler(
	clientService *service.ClientService,
	planService *service.PlanService,
	featureResolver *service.FeatureResolver,
	limitResolver *service.LimitResolver,
) *DashboardHandler {
	return &DashboardHandler{
		clientService:   clientService,
		planService:     planService,
		featureResolver: featureResolver,
		limitResolver:   limitResolver,
	}
}

// GetSummary returns all dashboard-related bootstrap data in a single request
func (h *DashboardHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	// Fetch all data
	// We do this sequentially for simplicity as these are fast DB/local lookups
	stats, _ := h.clientService.GetStats(r.Context(), tenantID)
	plan, _ := h.planService.GetTenantPlan(r.Context(), tenantID)
	features := h.featureResolver.GetAllFeatures(r.Context(), tenantID)
	limits := h.limitResolver.GetAllLimits(r.Context(), tenantID)

	response := map[string]interface{}{
		"clientStats": stats,
		"plan":        plan,
		"features":    features,
		"limits":      limits,
	}

	sendJSON(w, http.StatusOK, response)
}
