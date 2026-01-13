package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/addon"
	"rrnet/internal/domain/tenant"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

type SuperAdminHandler struct {
	tenantRepo   *repository.TenantRepository
	planRepo     *repository.PlanRepository
	addonRepo    *repository.AddonRepository
	planService  *service.PlanService
	addonService *service.AddonService
}

func NewSuperAdminHandler(
	tenantRepo *repository.TenantRepository,
	planRepo *repository.PlanRepository,
	addonRepo *repository.AddonRepository,
	planService *service.PlanService,
	addonService *service.AddonService,
) *SuperAdminHandler {
	return &SuperAdminHandler{
		tenantRepo:   tenantRepo,
		planRepo:     planRepo,
		addonRepo:    addonRepo,
		planService:  planService,
		addonService: addonService,
	}
}

// ========== Tenant Management ==========

func (h *SuperAdminHandler) ListTenants(w http.ResponseWriter, r *http.Request) {
	tenants, err := h.tenantRepo.ListAll(r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  tenants,
		"total": len(tenants),
	}); err != nil {
		http.Error(w, `{"error":"Failed to encode response"}`, http.StatusInternalServerError)
		return
	}
}

func (h *SuperAdminHandler) GetTenant(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid tenant ID"}`, http.StatusBadRequest)
		return
	}

	tenant, err := h.tenantRepo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tenant)
}

type UpdateTenantRequest struct {
	Name   *string `json:"name,omitempty"`
	Slug   *string `json:"slug,omitempty"`
	Domain *string `json:"domain,omitempty"`
	Status *string `json:"status,omitempty"`
}

func (h *SuperAdminHandler) UpdateTenant(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid tenant ID"}`, http.StatusBadRequest)
		return
	}

	var req UpdateTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	t, err := h.tenantRepo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	if req.Name != nil {
		t.Name = *req.Name
	}
	if req.Slug != nil {
		t.Slug = *req.Slug
	}
	if req.Domain != nil {
		t.Domain = req.Domain
	}
	if req.Status != nil {
		t.Status = tenant.Status(*req.Status)
	}
	t.UpdatedAt = time.Now()

	if err := h.tenantRepo.Update(r.Context(), t); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

func (h *SuperAdminHandler) SuspendTenant(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid tenant ID"}`, http.StatusBadRequest)
		return
	}

	t, err := h.tenantRepo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	t.Status = tenant.StatusSuspended
	t.UpdatedAt = time.Now()

	if err := h.tenantRepo.Update(r.Context(), t); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

func (h *SuperAdminHandler) UnsuspendTenant(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid tenant ID"}`, http.StatusBadRequest)
		return
	}

	t, err := h.tenantRepo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	t.Status = tenant.StatusActive
	t.UpdatedAt = time.Now()

	if err := h.tenantRepo.Update(r.Context(), t); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

// ========== Plan Management ==========

func (h *SuperAdminHandler) ListPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := h.planRepo.ListAll(r.Context())
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  plans,
		"total": len(plans),
	})
}

func (h *SuperAdminHandler) GetPlan(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid plan ID"}`, http.StatusBadRequest)
		return
	}

	plan, err := h.planRepo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plan)
}

type CreatePlanRequest struct {
	Code         string          `json:"code"`
	Name         string          `json:"name"`
	Description  string          `json:"description,omitempty"`
	PriceMonthly float64         `json:"price_monthly"`
	PriceYearly  *float64        `json:"price_yearly,omitempty"`
	Currency     string          `json:"currency,omitempty"`
	Limits       map[string]int  `json:"limits"`
	Features     []string        `json:"features"`
	IsActive     bool            `json:"is_active"`
	IsPublic     bool            `json:"is_public"`
	SortOrder    int             `json:"sort_order"`
}

func (h *SuperAdminHandler) CreatePlan(w http.ResponseWriter, r *http.Request) {
	var req CreatePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Code == "" {
		http.Error(w, `{"error":"name and code are required"}`, http.StatusBadRequest)
		return
	}

	plan, err := h.planService.Create(r.Context(), &service.CreatePlanRequest{
		Code:         req.Code,
		Name:         req.Name,
		Description:  req.Description,
		PriceMonthly: req.PriceMonthly,
		PriceYearly:  req.PriceYearly,
		Currency:     req.Currency,
		Limits:       req.Limits,
		Features:     req.Features,
		IsActive:     req.IsActive,
		IsPublic:     req.IsPublic,
		SortOrder:    req.SortOrder,
	})
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(plan)
}

type UpdatePlanRequest struct {
	Name         string          `json:"name"`
	Description  string          `json:"description,omitempty"`
	PriceMonthly float64         `json:"price_monthly"`
	PriceYearly  *float64        `json:"price_yearly,omitempty"`
	Currency     string          `json:"currency,omitempty"`
	Limits       map[string]int  `json:"limits"`
	Features     []string        `json:"features"`
	IsActive     bool            `json:"is_active"`
	IsPublic     bool            `json:"is_public"`
	SortOrder    int             `json:"sort_order"`
}

func (h *SuperAdminHandler) UpdatePlan(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid plan ID"}`, http.StatusBadRequest)
		return
	}

	var req UpdatePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	plan, err := h.planService.Update(r.Context(), id, &service.UpdatePlanRequest{
		Name:         req.Name,
		Description:  req.Description,
		PriceMonthly: req.PriceMonthly,
		PriceYearly:  req.PriceYearly,
		Currency:     req.Currency,
		Limits:       req.Limits,
		Features:     req.Features,
		IsActive:     req.IsActive,
		IsPublic:     req.IsPublic,
		SortOrder:    req.SortOrder,
	})
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plan)
}

func (h *SuperAdminHandler) DeletePlan(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid plan ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.planService.Delete(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *SuperAdminHandler) AssignPlanToTenant(w http.ResponseWriter, r *http.Request) {
	planIDStr := getPathParam(r, "plan_id")
	planID, err := uuid.Parse(planIDStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid plan ID"}`, http.StatusBadRequest)
		return
	}

	tenantIDStr := getPathParam(r, "tenant_id")
	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid tenant ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.planService.AssignToTenant(r.Context(), tenantID, planID); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Plan assigned successfully",
	})
}

// ========== Addon Management ==========

func (h *SuperAdminHandler) ListAddons(w http.ResponseWriter, r *http.Request) {
	addons, err := h.addonRepo.ListAll(r.Context())
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  addons,
		"total": len(addons),
	})
}

func (h *SuperAdminHandler) GetAddon(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid addon ID"}`, http.StatusBadRequest)
		return
	}

	addon, err := h.addonRepo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(addon)
}

type CreateAddonRequest struct {
	Code             string                 `json:"code"`
	Name             string                 `json:"name"`
	Description      string                 `json:"description,omitempty"`
	Price            float64                `json:"price"`
	BillingCycle     string                 `json:"billing_cycle"`
	Currency         string                 `json:"currency,omitempty"`
	AddonType        string                 `json:"addon_type"`
	Value            map[string]interface{} `json:"value"`
	IsActive         bool                   `json:"is_active"`
	AvailableForPlans []string              `json:"available_for_plans"`
}

func (h *SuperAdminHandler) CreateAddon(w http.ResponseWriter, r *http.Request) {
	var req CreateAddonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Code == "" {
		http.Error(w, `{"error":"name and code are required"}`, http.StatusBadRequest)
		return
	}

	addon, err := h.addonService.Create(r.Context(), &service.CreateAddonRequest{
		Code:             req.Code,
		Name:             req.Name,
		Description:      req.Description,
		Price:            req.Price,
		BillingCycle:     addon.BillingCycle(req.BillingCycle),
		Currency:         req.Currency,
		Type:             addon.AddonType(req.AddonType),
		Value:            req.Value,
		IsActive:         req.IsActive,
		AvailableForPlans: req.AvailableForPlans,
	})
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(addon)
}

type UpdateAddonRequest struct {
	Name              string                 `json:"name"`
	Description       string                 `json:"description,omitempty"`
	Price             float64                `json:"price"`
	BillingCycle      string                 `json:"billing_cycle"`
	Currency          string                 `json:"currency,omitempty"`
	AddonType         string                 `json:"addon_type"`
	Value             map[string]interface{} `json:"value"`
	IsActive          bool                   `json:"is_active"`
	AvailableForPlans []string               `json:"available_for_plans"`
}

func (h *SuperAdminHandler) UpdateAddon(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid addon ID"}`, http.StatusBadRequest)
		return
	}

	var req UpdateAddonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	addon, err := h.addonService.Update(r.Context(), id, &service.UpdateAddonRequest{
		Name:              req.Name,
		Description:       req.Description,
		Price:             req.Price,
		BillingCycle:      addon.BillingCycle(req.BillingCycle),
		Currency:          req.Currency,
		Type:              addon.AddonType(req.AddonType),
		Value:             req.Value,
		IsActive:          req.IsActive,
		AvailableForPlans: req.AvailableForPlans,
	})
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(addon)
}

func (h *SuperAdminHandler) DeleteAddon(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid addon ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.addonService.Delete(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

