package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/domain/addon"
	"rrnet/internal/domain/tenant"
	"rrnet/internal/infra/wa_gateway"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

type SuperAdminHandler struct {
	tenantRepo    *repository.TenantRepository
	planRepo      *repository.PlanRepository
	addonRepo     *repository.AddonRepository
	planService   *service.PlanService
	addonService  *service.AddonService
	tenantService *service.TenantService
	userRepo       *repository.UserRepository
	waClient       *wa_gateway.Client
	networkService *service.NetworkService
}

type TenantDetailResponse struct {
	tenant.Tenant
	OwnerName  string   `json:"owner_name"`
	OwnerEmail string   `json:"owner_email"`
	OwnerPhone string   `json:"owner_phone"`
	PlanCode   *string  `json:"plan_code,omitempty"`
	PlanName   *string  `json:"plan_name,omitempty"`
	PlanPrice  *float64 `json:"plan_price,omitempty"`
}

func NewSuperAdminHandler(
	tenantRepo *repository.TenantRepository,
	planRepo *repository.PlanRepository,
	addonRepo *repository.AddonRepository,
	planService *service.PlanService,
	addonService *service.AddonService,
	tenantService *service.TenantService,
	userRepo *repository.UserRepository,
	waClient *wa_gateway.Client,
	networkService *service.NetworkService,
) *SuperAdminHandler {
	return &SuperAdminHandler{
		tenantRepo:     tenantRepo,
		planRepo:       planRepo,
		addonRepo:      addonRepo,
		planService:    planService,
		addonService:   addonService,
		tenantService:  tenantService,
		userRepo:       userRepo,
		waClient:       waClient,
		networkService: networkService,
	}
}

type CreateTenantRequest struct {
	Name   string  `json:"name"`
	Slug   string  `json:"slug"`
	Domain *string `json:"domain"`
	Status string  `json:"status"`
}

func (h *SuperAdminHandler) CreateTenant(w http.ResponseWriter, r *http.Request) {
	var req CreateTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Slug == "" {
		http.Error(w, `{"error":"name and slug are required"}`, http.StatusBadRequest)
		return
	}

	// For superadmin, we create a tenant without a specific owner for now,
	// or we use a simplified version of RegisterTenant.
	// Since TenantService.RegisterTenant requires owner details, let's create a basic tenant here.
	now := time.Now()
	t := &tenant.Tenant{
		ID:        uuid.New(),
		Name:      req.Name,
		Slug:      req.Slug,
		Domain:    req.Domain,
		Status:    tenant.Status(req.Status),
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := h.tenantRepo.Create(r.Context(), t); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
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

	t, err := h.tenantRepo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	// Fetch owner details
	ownerName := "-"
	ownerEmail := "-"
	ownerPhone := "-"

	// Get users for this tenant and find one with role 'owner'
	users, err := h.userRepo.ListByTenant(r.Context(), t.ID)
	if err == nil {
		for _, u := range users {
			if u.Role != nil && u.Role.Code == "owner" {
				ownerName = u.Name
				ownerEmail = u.Email
				if u.Phone != nil {
					ownerPhone = *u.Phone
				}
				break
			}
		}
	}

	// Fetch plan details if tenant has a plan assigned
	var planCode, planName *string
	var planPrice *float64
	if t.PlanID != nil {
		plan, err := h.planRepo.GetByID(r.Context(), *t.PlanID)
		if err == nil {
			planCode = &plan.Code
			planName = &plan.Name
			planPrice = &plan.PriceMonthly
		}
	}

	resp := TenantDetailResponse{
		Tenant:     *t,
		OwnerName:  ownerName,
		OwnerEmail: ownerEmail,
		OwnerPhone: ownerPhone,
		PlanCode:   planCode,
		PlanName:   planName,
		PlanPrice:  planPrice,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

type UpdateTenantRequest struct {
	Name       *string `json:"name,omitempty"`
	Slug       *string `json:"slug,omitempty"`
	Domain     *string `json:"domain,omitempty"`
	Status     *string `json:"status,omitempty"`
	OwnerPhone *string `json:"owner_phone,omitempty"`
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

	// Update owner phone if provided
	if req.OwnerPhone != nil {
		users, err := h.userRepo.ListByTenant(r.Context(), t.ID)
		if err == nil {
			for _, u := range users {
				if u.Role != nil && u.Role.Code == "owner" {
					u.Phone = req.OwnerPhone
					h.userRepo.Update(r.Context(), u)
					break
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}

func (h *SuperAdminHandler) DeleteTenant(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid tenant ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.tenantService.DeleteTenant(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
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
	Code         string         `json:"code"`
	Name         string         `json:"name"`
	Description  string         `json:"description,omitempty"`
	PriceMonthly float64        `json:"price_monthly"`
	PriceYearly  *float64       `json:"price_yearly,omitempty"`
	Currency     string         `json:"currency,omitempty"`
	Limits       map[string]int `json:"limits"`
	Features     []string       `json:"features"`
	IsActive     bool           `json:"is_active"`
	IsPublic     bool           `json:"is_public"`
	SortOrder    int            `json:"sort_order"`
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
	Name         string         `json:"name"`
	Description  string         `json:"description,omitempty"`
	PriceMonthly float64        `json:"price_monthly"`
	PriceYearly  *float64       `json:"price_yearly,omitempty"`
	Currency     string         `json:"currency,omitempty"`
	Limits       map[string]int `json:"limits"`
	Features     []string       `json:"features"`
	IsActive     bool           `json:"is_active"`
	IsPublic     bool           `json:"is_public"`
	SortOrder    int            `json:"sort_order"`
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
	Code              string                 `json:"code"`
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
		Code:              req.Code,
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

// ========== WhatsApp Management ==========

const platformTenantID = "platform"

func (h *SuperAdminHandler) GetWhatsAppStatus(w http.ResponseWriter, r *http.Request) {
	log.Info().Msg("[SuperAdmin] GetWhatsAppStatus called")

	if h.waClient == nil {
		log.Error().Msg("[SuperAdmin] WhatsApp client is nil - gateway not configured")
		http.Error(w, `{"error":"WhatsApp gateway not configured"}`, http.StatusServiceUnavailable)
		return
	}

	log.Info().Str("tenant_id", platformTenantID).Msg("[SuperAdmin] Calling waClient.Status")
	status, err := h.waClient.Status(r.Context(), platformTenantID)
	if err != nil {
		log.Warn().Err(err).Str("tenant_id", platformTenantID).Msg("[SuperAdmin] Failed to get WA status, returning not_connected")
		// If 404 from gateway, it means not connected
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "not_connected",
		})
		return
	}

	log.Info().Interface("status", status).Msg("[SuperAdmin] WA status retrieved successfully")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func (h *SuperAdminHandler) ConnectWhatsApp(w http.ResponseWriter, r *http.Request) {
	log.Info().Msg("[SuperAdmin] ConnectWhatsApp called")

	if h.waClient == nil {
		log.Error().Msg("[SuperAdmin] WhatsApp client is nil - gateway not configured")
		http.Error(w, `{"error":"WhatsApp gateway not configured"}`, http.StatusServiceUnavailable)
		return
	}

	log.Info().Str("tenant_id", platformTenantID).Msg("[SuperAdmin] Calling waClient.Connect")
	resp, err := h.waClient.Connect(r.Context(), platformTenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", platformTenantID).Msg("[SuperAdmin] Failed to connect WhatsApp")
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	log.Info().Interface("response", resp).Msg("[SuperAdmin] WhatsApp connect successful")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *SuperAdminHandler) GetWhatsAppQR(w http.ResponseWriter, r *http.Request) {
	log.Info().Msg("[SuperAdmin] GetWhatsAppQR called")

	if h.waClient == nil {
		log.Error().Msg("[SuperAdmin] WhatsApp client is nil - gateway not configured")
		http.Error(w, `{"error":"WhatsApp gateway not configured"}`, http.StatusServiceUnavailable)
		return
	}

	log.Info().Str("tenant_id", platformTenantID).Msg("[SuperAdmin] Calling waClient.QR")
	qr, err := h.waClient.QR(r.Context(), platformTenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", platformTenantID).Msg("[SuperAdmin] Failed to get QR code")
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	qrLen := "nil"
	if qr.QR != nil {
		qrLen = fmt.Sprintf("%d", len(*qr.QR))
	}
	log.Info().Str("qr_length", qrLen).Msg("[SuperAdmin] QR code retrieved successfully")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(qr)
}
func (h *SuperAdminHandler) GetNetworkStats(w http.ResponseWriter, r *http.Request) {
	log.Info().Msg("[SuperAdmin] GetNetworkStats called")

	if h.networkService == nil {
		http.Error(w, `{"error":"Network service not configured"}`, http.StatusServiceUnavailable)
		return
	}

	stats, err := h.networkService.GetGlobalNetworkStats(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("[SuperAdmin] Failed to get global network stats")
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
