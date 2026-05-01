package service

import (
	"context"

	"github.com/google/uuid"

	"rrnet/internal/domain/addon"
	"rrnet/internal/domain/feature"
	"rrnet/internal/domain/plan"
	"rrnet/internal/repository"
)

const (
	// Unlimited represents no limit (-1)
	Unlimited = -1
)

// LimitResolver resolves resource limits for tenants
// Resolution: plan base limit + addon boosts
type LimitResolver struct {
	planRepo  *repository.PlanRepository
	addonRepo *repository.AddonRepository
}

// ResolvedData contains pre-fetched data for a tenant request to avoid redundant DB queries
type ResolvedData struct {
	Plan    *plan.Plan
	Addons  []*addon.TenantAddon
	Toggles []*feature.Toggle
}

// NewLimitResolver creates a new limit resolver
func NewLimitResolver(planRepo *repository.PlanRepository, addonRepo *repository.AddonRepository) *LimitResolver {
	return &LimitResolver{
		planRepo:  planRepo,
		addonRepo: addonRepo,
	}
}

// Get returns the effective limit for a tenant
// Returns -1 for unlimited
func (r *LimitResolver) Get(ctx context.Context, tenantID uuid.UUID, limitName string) int {
	return r.GetWithData(ctx, tenantID, limitName, nil)
}

// GetWithData returns the effective limit using pre-fetched data if available
func (r *LimitResolver) GetWithData(ctx context.Context, tenantID uuid.UUID, limitName string, data *ResolvedData) int {
	// Get base limit from plan
	baseLimit := 0
	var p *plan.Plan
	var err error

	if data != nil && data.Plan != nil {
		p = data.Plan
	} else {
		p, err = r.planRepo.GetTenantPlan(ctx, tenantID)
	}

	if err == nil && p != nil {
		baseLimit = p.GetLimit(limitName)
		// If plan has unlimited, return immediately
		if baseLimit == Unlimited {
			return Unlimited
		}
	}

	// Add boosts from addons
	boosts := 0
	if data != nil && data.Addons != nil {
		boosts = r.calculateAddonBoosts(data.Addons, limitName)
	} else {
		boosts = r.getAddonBoostsFromDB(ctx, tenantID, limitName)
	}

	return baseLimit + boosts
}

// IsUnlimited checks if a tenant has unlimited value for a limit
func (r *LimitResolver) IsUnlimited(ctx context.Context, tenantID uuid.UUID, limitName string) bool {
	return r.Get(ctx, tenantID, limitName) == Unlimited
}

// IsWithinLimit checks if current usage is within the limit
func (r *LimitResolver) IsWithinLimit(ctx context.Context, tenantID uuid.UUID, limitName string, currentUsage int) bool {
	limit := r.Get(ctx, tenantID, limitName)
	if limit == Unlimited {
		return true
	}
	return currentUsage < limit
}

// CanAdd checks if adding N items would exceed the limit
func (r *LimitResolver) CanAdd(ctx context.Context, tenantID uuid.UUID, limitName string, currentUsage, countToAdd int) bool {
	limit := r.Get(ctx, tenantID, limitName)
	if limit == Unlimited {
		return true
	}
	return (currentUsage + countToAdd) <= limit
}

// GetRemaining returns how many more items can be added
func (r *LimitResolver) GetRemaining(ctx context.Context, tenantID uuid.UUID, limitName string, currentUsage int) int {
	limit := r.Get(ctx, tenantID, limitName)
	if limit == Unlimited {
		return Unlimited
	}
	remaining := limit - currentUsage
	if remaining < 0 {
		return 0
	}
	return remaining
}

// GetAllLimits returns a map of all limits and their values for a tenant
func (r *LimitResolver) GetAllLimits(ctx context.Context, tenantID uuid.UUID) map[string]int {
	return r.GetAllLimitsWithData(ctx, tenantID, nil)
}

// GetAllLimitsWithData returns all limits using pre-fetched data
func (r *LimitResolver) GetAllLimitsWithData(ctx context.Context, tenantID uuid.UUID, data *ResolvedData) map[string]int {
	// Optimization: Pre-fetch data if not provided
	if data == nil {
		p, _ := r.planRepo.GetTenantPlan(ctx, tenantID)
		a, _ := r.addonRepo.GetTenantAddons(ctx, tenantID)
		data = &ResolvedData{Plan: p, Addons: a}
	}

	limits := make(map[string]int)
	limitNames := []string{
		"max_routers",
		"max_vouchers",
		"max_odc",
		"max_odp",
		"max_clients",
		"wa_quota_monthly",
	}

	for _, name := range limitNames {
		limits[name] = r.GetWithData(ctx, tenantID, name, data)
	}

	return limits
}

// getAddonBoostsFromDB calculates total limit boost from DB
func (r *LimitResolver) getAddonBoostsFromDB(ctx context.Context, tenantID uuid.UUID, limitName string) int {
	tenantAddons, err := r.addonRepo.GetTenantAddons(ctx, tenantID)
	if err != nil {
		return 0
	}
	return r.calculateAddonBoosts(tenantAddons, limitName)
}

// calculateAddonBoosts calculates total limit boost from a list of addons
func (r *LimitResolver) calculateAddonBoosts(tenantAddons []*addon.TenantAddon, limitName string) int {
	total := 0
	for _, ta := range tenantAddons {
		if ta.Addon == nil || ta.Addon.Type != addon.AddonTypeLimitBoost || ta.IsExpired() {
			continue
		}

		boostVal, err := ta.Addon.GetLimitBoostValue()
		if err != nil || boostVal == nil {
			continue
		}

		qty := ta.Quantity
		if qty <= 0 {
			qty = 1
		}

		switch limitName {
		case "max_routers":
			total += boostVal.AddRouters * qty
		case "max_clients":
			total += boostVal.AddClients * qty
		case "max_vouchers":
			total += boostVal.AddVouchers * qty
		case "max_odc":
			total += boostVal.AddODC * qty
		case "max_odp":
			total += boostVal.AddODP * qty
		case "wa_quota_monthly":
			total += boostVal.AddWAQuota * qty
		}
	}

	return total
}

// LimitInfo represents limit information for a tenant
type LimitInfo struct {
	Name        string `json:"name"`
	Limit       int    `json:"limit"` // -1 = unlimited
	IsUnlimited bool   `json:"unlimited"`
}

// GetLimitInfo returns detailed limit information
func (r *LimitResolver) GetLimitInfo(ctx context.Context, tenantID uuid.UUID, limitName string) *LimitInfo {
	limit := r.Get(ctx, tenantID, limitName)
	return &LimitInfo{
		Name:        limitName,
		Limit:       limit,
		IsUnlimited: limit == Unlimited,
	}
}
