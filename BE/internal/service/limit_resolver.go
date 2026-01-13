package service

import (
	"context"

	"github.com/google/uuid"

	"rrnet/internal/domain/addon"
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
	// Get base limit from plan
	baseLimit := 0
	plan, err := r.planRepo.GetTenantPlan(ctx, tenantID)
	if err == nil && plan != nil {
		baseLimit = plan.GetLimit(limitName)
		// If plan has unlimited, return immediately
		if baseLimit == Unlimited {
			return Unlimited
		}
	}

	// Add boosts from addons
	boosts := r.getAddonBoosts(ctx, tenantID, limitName)

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
	limits := make(map[string]int)
	limitNames := []string{
		"max_routers",
		"max_users",
		"max_vouchers",
		"max_odc",
		"max_odp",
		"max_clients",
		"wa_quota_monthly",
	}

	for _, name := range limitNames {
		limits[name] = r.Get(ctx, tenantID, name)
	}

	return limits
}

// getAddonBoosts calculates total limit boost from addons
func (r *LimitResolver) getAddonBoosts(ctx context.Context, tenantID uuid.UUID, limitName string) int {
	total := 0

	tenantAddons, err := r.addonRepo.GetTenantAddons(ctx, tenantID)
	if err != nil {
		return 0
	}

	for _, ta := range tenantAddons {
		if ta.Addon == nil || ta.Addon.Type != addon.AddonTypeLimitBoost || ta.IsExpired() {
			continue
		}

		boostVal, err := ta.Addon.GetLimitBoostValue()
		if err != nil || boostVal == nil {
			continue
		}

		switch limitName {
		case "max_routers":
			total += boostVal.AddRouters
		case "max_users":
			total += boostVal.AddUsers
		case "max_clients":
			total += boostVal.AddClients
		case "max_vouchers":
			total += boostVal.AddVouchers
		case "max_odc":
			total += boostVal.AddODC
		case "max_odp":
			total += boostVal.AddODP
		case "wa_quota_monthly":
			total += boostVal.AddWAQuota
		}
	}

	return total
}

// LimitInfo represents limit information for a tenant
type LimitInfo struct {
	Name        string `json:"name"`
	Limit       int    `json:"limit"`      // -1 = unlimited
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


