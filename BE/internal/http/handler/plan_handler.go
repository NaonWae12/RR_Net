package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/http/middleware"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

// PlanHandler handles plan-related HTTP requests
type PlanHandler struct {
	planService     *service.PlanService
	featureResolver *service.FeatureResolver
	limitResolver   *service.LimitResolver
}

// NewPlanHandler creates a new plan handler
func NewPlanHandler(planService *service.PlanService, featureResolver *service.FeatureResolver, limitResolver *service.LimitResolver) *PlanHandler {
	return &PlanHandler{
		planService:     planService,
		featureResolver: featureResolver,
		limitResolver:   limitResolver,
	}
}

// List returns all plans
func (h *PlanHandler) List(w http.ResponseWriter, r *http.Request) {
	// Parse query params
	activeOnly := r.URL.Query().Get("active") == "true"
	publicOnly := r.URL.Query().Get("public") == "true"

	plans, err := h.planService.List(r.Context(), activeOnly, publicOnly)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to list plans")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"plans": plans,
		"total": len(plans),
	})
}

// Get returns a single plan by ID
func (h *PlanHandler) Get(w http.ResponseWriter, r *http.Request) {
	// Extract ID from context (set by router)
	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Plan ID is required")
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid plan ID")
		return
	}

	plan, err := h.planService.GetByID(r.Context(), id)
	if err != nil {
		if err == repository.ErrPlanNotFound {
			sendError(w, http.StatusNotFound, "Plan not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to get plan")
		return
	}

	sendJSON(w, http.StatusOK, plan)
}

// Create creates a new plan
func (h *PlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.CreatePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	plan, err := h.planService.Create(r.Context(), &req)
	if err != nil {
		switch err {
		case service.ErrPlanCodeRequired:
			sendError(w, http.StatusBadRequest, "Plan code is required")
		case service.ErrPlanNameRequired:
			sendError(w, http.StatusBadRequest, "Plan name is required")
		case repository.ErrPlanCodeTaken:
			sendError(w, http.StatusConflict, "Plan code already exists")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to create plan")
		}
		return
	}

	sendJSON(w, http.StatusCreated, plan)
}

// Update updates a plan
func (h *PlanHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Plan ID is required")
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid plan ID")
		return
	}

	var req service.UpdatePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	plan, err := h.planService.Update(r.Context(), id, &req)
	if err != nil {
		if err == repository.ErrPlanNotFound {
			sendError(w, http.StatusNotFound, "Plan not found")
			return
		}
		// Check if error is a validation error (e.g., invalid feature codes)
		// Validation errors should return 400 Bad Request, not 500 Internal Server Error
		errMsg := err.Error()
		if strings.Contains(errMsg, "invalid feature codes") {
			sendError(w, http.StatusBadRequest, errMsg)
			return
		}
		// Log error for debugging
		log.Error().Err(err).Str("request_id", middleware.GetRequestID(r.Context())).Msg("Failed to update plan in service")
		sendError(w, http.StatusInternalServerError, "Failed to update plan")
		return
	}

	sendJSON(w, http.StatusOK, plan)
}

// Delete deletes a plan
func (h *PlanHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Plan ID is required")
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid plan ID")
		return
	}

	if err := h.planService.Delete(r.Context(), id); err != nil {
		if err == repository.ErrPlanNotFound {
			sendError(w, http.StatusNotFound, "Plan not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to delete plan")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Plan deleted"})
}

// AssignToTenant assigns a plan to a tenant
func (h *PlanHandler) AssignToTenant(w http.ResponseWriter, r *http.Request) {
	tenantIDStr := getPathParam(r, "tenant_id")
	if tenantIDStr == "" {
		sendError(w, http.StatusBadRequest, "Tenant ID is required")
		return
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	var req struct {
		PlanID string `json:"plan_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	planID, err := uuid.Parse(req.PlanID)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid plan ID")
		return
	}

	if err := h.planService.AssignToTenant(r.Context(), tenantID, planID); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to assign plan")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Plan assigned to tenant"})
}

// GetTenantPlan returns the plan assigned to the current tenant
func (h *PlanHandler) GetTenantPlan(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	plan, err := h.planService.GetTenantPlan(r.Context(), tenantID)
	if err != nil {
		if err == repository.ErrPlanNotFound {
			sendError(w, http.StatusNotFound, "No plan assigned to tenant")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to get tenant plan")
		return
	}

	sendJSON(w, http.StatusOK, plan)
}

// GetTenantFeatures returns all features and their availability for current tenant
func (h *PlanHandler) GetTenantFeatures(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	features := h.featureResolver.GetAllFeatures(r.Context(), tenantID)

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"features": features,
	})
}

// GetTenantLimits returns all limits for current tenant
func (h *PlanHandler) GetTenantLimits(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	limits := h.limitResolver.GetAllLimits(r.Context(), tenantID)

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"limits": limits,
	})
}

// CheckFeature checks if tenant has a specific feature
func (h *PlanHandler) CheckFeature(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	featureCode := r.URL.Query().Get("feature")
	if featureCode == "" {
		sendError(w, http.StatusBadRequest, "Feature code is required")
		return
	}

	hasFeature := h.featureResolver.Has(r.Context(), tenantID, featureCode)

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"feature":   featureCode,
		"available": hasFeature,
	})
}

// CheckLimit checks tenant limit and remaining capacity
func (h *PlanHandler) CheckLimit(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	limitName := r.URL.Query().Get("limit")
	if limitName == "" {
		sendError(w, http.StatusBadRequest, "Limit name is required")
		return
	}

	currentUsage := 0
	if usageStr := r.URL.Query().Get("current"); usageStr != "" {
		if u, err := strconv.Atoi(usageStr); err == nil {
			currentUsage = u
		}
	}

	limit := h.limitResolver.Get(r.Context(), tenantID, limitName)
	remaining := h.limitResolver.GetRemaining(r.Context(), tenantID, limitName, currentUsage)

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"limit":        limitName,
		"value":        limit,
		"unlimited":    limit == service.Unlimited,
		"current":      currentUsage,
		"remaining":    remaining,
		"within_limit": h.limitResolver.IsWithinLimit(r.Context(), tenantID, limitName, currentUsage),
	})
}

