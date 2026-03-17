package handler

import (
	"net/http"

	"github.com/google/uuid"
	"golang.org/x/sync/errgroup"

	"rrnet/internal/auth"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

// DashboardHandler handles dashboard-related HTTP requests
type DashboardHandler struct {
	clientService   *service.ClientService
	planService     *service.PlanService
	featureResolver *service.FeatureResolver
	limitResolver   *service.LimitResolver
	routerRepo      *repository.RouterRepository
	voucherRepo     *repository.VoucherRepository
}

func NewDashboardHandler(
	clientService *service.ClientService,
	planService *service.PlanService,
	featureResolver *service.FeatureResolver,
	limitResolver *service.LimitResolver,
	routerRepo *repository.RouterRepository,
	voucherRepo *repository.VoucherRepository,
) *DashboardHandler {
	return &DashboardHandler{
		clientService:   clientService,
		planService:     planService,
		featureResolver: featureResolver,
		limitResolver:   limitResolver,
		routerRepo:      routerRepo,
		voucherRepo:     voucherRepo,
	}
}

// GetSummary returns all dashboard-related bootstrap data in a single request
func (h *DashboardHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var stats map[string]interface{}
	var resolvedData *service.ResolvedData
	var features map[string]bool
	var limits map[string]int
	var resourceStats map[string]interface{}

	g, ctx := errgroup.WithContext(r.Context())

	// Task 1: Fetch Client Stats
	g.Go(func() error {
		stats, _ = h.clientService.GetStats(ctx, tenantID)
		return nil
	})

	// Task 2: Fetch Master Data (Plan, Addons, Toggles)
	g.Go(func() error {
		var err error
		resolvedData, err = h.featureResolver.GetResolvedData(ctx, tenantID)
		if err != nil {
			return err
		}

		features = h.featureResolver.GetAllFeaturesWithData(ctx, tenantID, resolvedData)
		limits = h.limitResolver.GetAllLimitsWithData(ctx, tenantID, resolvedData)
		return nil
	})

	// Task 3: Fetch Full Resource Usage
	g.Go(func() error {
		routerCount, _ := h.routerRepo.CountByTenant(ctx, tenantID)
		voucherCount, _ := h.voucherRepo.CountVouchersByTenant(ctx, tenantID)
		clientCount, _ := h.clientService.GetStats(ctx, tenantID) // This is redundant but okay for now

		resourceStats = map[string]interface{}{
			"routers": map[string]interface{}{
				"used":  routerCount,
				"limit": h.limitResolver.Get(ctx, tenantID, "max_routers"),
			},
			"vouchers": map[string]interface{}{
				"used":  voucherCount,
				"limit": h.limitResolver.Get(ctx, tenantID, "max_vouchers"),
			},
			"clients": map[string]interface{}{
				"used":  clientCount["total"],
				"limit": clientCount["limit"],
			},
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to fetch dashboard summary")
		return
	}

	response := map[string]interface{}{
		"clientStats":   stats,
		"plan":          resolvedData.Plan,
		"features":      features,
		"limits":        limits,
		"resourceUsage": resourceStats,
	}

	sendJSON(w, http.StatusOK, response)
}

// GetBootstrap returns lightweight tenant info (Plan, Features, Limits) without stats
// Used by layouts/sidebars for feature gating
func (h *DashboardHandler) GetBootstrap(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	resolvedData, err := h.featureResolver.GetResolvedData(r.Context(), tenantID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to fetch bootstrap data")
		return
	}

	features := h.featureResolver.GetAllFeaturesWithData(r.Context(), tenantID, resolvedData)
	limits := h.limitResolver.GetAllLimitsWithData(r.Context(), tenantID, resolvedData)

	response := map[string]interface{}{
		"plan":     resolvedData.Plan,
		"features": features,
		"limits":   limits,
	}

	sendJSON(w, http.StatusOK, response)
}
