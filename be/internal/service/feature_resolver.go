package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"rrnet/internal/domain/addon"
	"rrnet/internal/domain/feature"
	"rrnet/internal/domain/plan"
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

// GetResolvedData fetches all necessary data for a tenant in one go
func (r *FeatureResolver) GetResolvedData(ctx context.Context, tenantID uuid.UUID) (*ResolvedData, error) {
	// Plan and addons are most commonly used
	p, _ := r.planRepo.GetTenantPlan(ctx, tenantID)
	a, _ := r.addonRepo.GetTenantAddons(ctx, tenantID)

	// Toggles (Tenant + Global)
	t, _ := r.featureRepo.ListTenantToggles(ctx, tenantID)
	gt, _ := r.featureRepo.ListGlobalToggles(ctx)

	// Merge toggles
	var allToggles []*feature.Toggle = append(t, gt...)

	return &ResolvedData{
		Plan:    p,
		Addons:  a,
		Toggles: allToggles,
	}, nil
}

// Has checks if a tenant has access to a specific feature
func (r *FeatureResolver) Has(ctx context.Context, tenantID uuid.UUID, featureCode string) bool {
	return r.HasWithData(ctx, tenantID, featureCode, nil)
}

// HasWithData checks feature access using pre-fetched data if available
func (r *FeatureResolver) HasWithData(ctx context.Context, tenantID uuid.UUID, featureCode string, data *ResolvedData) bool {
	// 1. Check global toggle first
	if data != nil && data.Toggles != nil {
		for _, t := range data.Toggles {
			if t.TenantID == nil && t.Code == featureCode {
				if !t.IsEnabled {
					return false
				}
			}
		}
	} else {
		globalToggle, err := r.featureRepo.GetGlobalToggle(ctx, featureCode)
		if err == nil && globalToggle != nil && !globalToggle.IsEnabled {
			return false
		}
	}

	// 2. Check tenant-specific toggle override
	if data != nil && data.Toggles != nil {
		for _, t := range data.Toggles {
			if t.TenantID != nil && *t.TenantID == tenantID && t.Code == featureCode {
				return t.IsEnabled
			}
		}
	} else {
		tenantToggle, err := r.featureRepo.GetTenantToggle(ctx, tenantID, featureCode)
		if err == nil && tenantToggle != nil {
			return tenantToggle.IsEnabled
		}
	}

	// 3. Check tenant addons
	var tenantAddons []*addon.TenantAddon
	if data != nil && data.Addons != nil {
		tenantAddons = data.Addons
	} else {
		tenantAddons, _ = r.addonRepo.GetTenantAddons(ctx, tenantID)
	}

	for _, ta := range tenantAddons {
		if ta.Addon != nil && ta.Addon.Type == addon.AddonTypeFeature && !ta.IsExpired() {
			featureVal, _ := ta.Addon.GetFeatureValue()
			if featureVal != nil && featureVal.Feature == featureCode {
				return true
			}
		}
	}

	// 4. Check tenant plan
	var p *plan.Plan
	if data != nil && data.Plan != nil {
		p = data.Plan
	} else {
		p, _ = r.planRepo.GetTenantPlan(ctx, tenantID)
	}

	if p != nil {
		return p.HasFeature(featureCode)
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
	return r.GetAllFeaturesWithData(ctx, tenantID, nil)
}

// GetAllFeaturesWithData returns all features using pre-fetched data
func (r *FeatureResolver) GetAllFeaturesWithData(ctx context.Context, tenantID uuid.UUID, data *ResolvedData) map[string]bool {
	// Optimization: Pre-fetch data if not provided
	if data == nil {
		p, _ := r.planRepo.GetTenantPlan(ctx, tenantID)
		a, _ := r.addonRepo.GetTenantAddons(ctx, tenantID)
		t, _ := r.featureRepo.ListTenantToggles(ctx, tenantID)
		gt, _ := r.featureRepo.ListGlobalToggles(ctx)
		// Merge toggles
		allToggles := append(t, gt...)
		data = &ResolvedData{Plan: p, Addons: a, Toggles: allToggles}
	}

	features := make(map[string]bool)

	// Get plan features
	if data.Plan != nil {
		planFeatures, _ := data.Plan.GetFeatures()
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
	for _, ta := range data.Addons {
		if ta.Addon != nil && ta.Addon.Type == addon.AddonTypeFeature && !ta.IsExpired() {
			featureVal, _ := ta.Addon.GetFeatureValue()
			if featureVal != nil {
				features[featureVal.Feature] = true
			}
		}
	}

	// Apply toggles
	for _, t := range data.Toggles {
		if t.TenantID == nil {
			// Global toggle (disabled global = disabled for all)
			if !t.IsEnabled {
				features[t.Code] = false
			}
		} else if *t.TenantID == tenantID {
			// Tenant-specific override
			features[t.Code] = t.IsEnabled
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
		"settlement",

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
