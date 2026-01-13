package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"rrnet/internal/domain/addon"
	"rrnet/internal/repository"
)

var (
	ErrFeatureNotAvailable = errors.New("feature not available for this tenant")
)

// FeatureResolver resolves feature availability for tenants
// Resolution order: tenant addons -> tenant plan -> global toggle -> default false
type FeatureResolver struct {
	planRepo    *repository.PlanRepository
	addonRepo   *repository.AddonRepository
	featureRepo *repository.FeatureRepository
}

// NewFeatureResolver creates a new feature resolver
func NewFeatureResolver(planRepo *repository.PlanRepository, addonRepo *repository.AddonRepository, featureRepo *repository.FeatureRepository) *FeatureResolver {
	return &FeatureResolver{
		planRepo:    planRepo,
		addonRepo:   addonRepo,
		featureRepo: featureRepo,
	}
}

// Has checks if a tenant has access to a specific feature
func (r *FeatureResolver) Has(ctx context.Context, tenantID uuid.UUID, featureCode string) bool {
	// 1. Check global toggle first (e.g., maintenance_mode disables everything)
	globalToggle, err := r.featureRepo.GetGlobalToggle(ctx, featureCode)
	if err == nil && globalToggle != nil {
		// If global toggle exists and is disabled, feature is off for everyone
		if !globalToggle.IsEnabled {
			return false
		}
		// If global toggle is enabled, continue checking tenant-specific availability
	}

	// 2. Check tenant-specific toggle override
	tenantToggle, err := r.featureRepo.GetTenantToggle(ctx, tenantID, featureCode)
	if err == nil && tenantToggle != nil {
		return tenantToggle.IsEnabled
	}

	// 3. Check tenant addons for feature unlock
	tenantAddons, err := r.addonRepo.GetTenantAddons(ctx, tenantID)
	if err == nil {
		for _, ta := range tenantAddons {
			if ta.Addon != nil && ta.Addon.Type == addon.AddonTypeFeature && !ta.IsExpired() {
				featureVal, _ := ta.Addon.GetFeatureValue()
				if featureVal != nil && featureVal.Feature == featureCode {
					return true
				}
			}
		}
	}

	// 4. Check tenant plan
	plan, err := r.planRepo.GetTenantPlan(ctx, tenantID)
	if err == nil && plan != nil {
		return plan.HasFeature(featureCode)
	}

	// 5. Default: feature not available
	return false
}

// HasAny checks if tenant has at least one of the specified features
func (r *FeatureResolver) HasAny(ctx context.Context, tenantID uuid.UUID, featureCodes ...string) bool {
	for _, code := range featureCodes {
		if r.Has(ctx, tenantID, code) {
			return true
		}
	}
	return false
}

// HasAll checks if tenant has all of the specified features
func (r *FeatureResolver) HasAll(ctx context.Context, tenantID uuid.UUID, featureCodes ...string) bool {
	for _, code := range featureCodes {
		if !r.Has(ctx, tenantID, code) {
			return false
		}
	}
	return true
}

// GetAllFeatures returns a map of all features and their availability for a tenant
func (r *FeatureResolver) GetAllFeatures(ctx context.Context, tenantID uuid.UUID) map[string]bool {
	features := make(map[string]bool)

	// Get plan features
	plan, err := r.planRepo.GetTenantPlan(ctx, tenantID)
	if err == nil && plan != nil {
		planFeatures, _ := plan.GetFeatures()
		for _, f := range planFeatures {
			if f == "*" {
				// Enterprise plan - enable all features
				for _, code := range getAllFeatureCodes() {
					features[code] = true
				}
				break
			}
			features[f] = true
		}
	}

	// Override with addon features
	tenantAddons, err := r.addonRepo.GetTenantAddons(ctx, tenantID)
	if err == nil {
		for _, ta := range tenantAddons {
			if ta.Addon != nil && ta.Addon.Type == addon.AddonTypeFeature && !ta.IsExpired() {
				featureVal, _ := ta.Addon.GetFeatureValue()
				if featureVal != nil {
					features[featureVal.Feature] = true
				}
			}
		}
	}

	// Override with tenant toggles
	tenantToggles, err := r.featureRepo.ListTenantToggles(ctx, tenantID)
	if err == nil {
		for _, t := range tenantToggles {
			features[t.Code] = t.IsEnabled
		}
	}

	// Apply global toggles (disabled global = disabled for all)
	globalToggles, err := r.featureRepo.ListGlobalToggles(ctx)
	if err == nil {
		for _, t := range globalToggles {
			if !t.IsEnabled {
				features[t.Code] = false
			}
		}
	}

	return features
}

// getAllFeatureCodes returns all known feature codes
func getAllFeatureCodes() []string {
	return []string{
		// Core / legacy codes (kept for backward compatibility)
		"client_management",
		"billing_basic",
		"billing_full",
		"radius_basic",
		"radius_full",
		"mikrotik_api",
		"voucher_basic",
		"voucher_full",
		"isolir_manual",
		"isolir_auto",
		"maps_basic",
		"maps_full",
		"rbac_basic",
		"rbac_full",
		"wa_gateway",
		"payment_gateway",
		"hr_module",
		"collector_module",
		"technician_module",
		"custom_login_page",
		"custom_domain",
		"reports_advanced",
		"api_access",
		"priority_support",

		// Current plan feature codes (see migrations/000004_create_plans.up.sql)
		"mikrotik_api_basic",
		"mikrotik_control_panel_advanced",
		"wa_gateway_basic",
		"wa_gateway",
		"rbac_employee",
		"rbac_client_reseller",
		"api_integration_partial",
		"api_integration_full",
		"hcm_module",
		"payment_reporting_advanced",
		"dashboard_pendapatan",
		"odp_maps",
		"client_maps",
		"custom_isolir_page",
		"ai_agent_client_wa",
		"addon_router",
		"addon_user_packs",
		"service_packages",
	}
}


