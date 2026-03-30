package service

import (
	"context"
	"encoding/json"
	"rrnet/internal/domain/site_setting"
	"rrnet/internal/repository"
)

type SiteSettingService interface {
	GetSEO(ctx context.Context) (*site_setting.LandingPageSEO, error)
	GetPricingConfig(ctx context.Context) (*site_setting.LandingPagePricing, error)
	UpdateSEO(ctx context.Context, seo *site_setting.LandingPageSEO) error
	UpdatePricingConfig(ctx context.Context, config *site_setting.LandingPagePricing) error
	ListSettings(ctx context.Context) ([]site_setting.SiteSetting, error)
	GetByKey(ctx context.Context, key string) (*site_setting.SiteSetting, error)
}

type siteSettingService struct {
	repo repository.SiteSettingRepository
}

func NewSiteSettingService(repo repository.SiteSettingRepository) SiteSettingService {
	return &siteSettingService{repo: repo}
}

func (s *siteSettingService) GetSEO(ctx context.Context) (*site_setting.LandingPageSEO, error) {
	setting, err := s.repo.GetByKey(ctx, "landing_page_seo")
	if err != nil {
		// Return defaults if not found
		return &site_setting.LandingPageSEO{
			Title:       "RRNET | All-in-One ERP for ISP",
			Description: "Scale your ISP business with automated billing and network management.",
			Keywords:    []string{"ISP", "ERP", "RRNET"},
		}, nil
	}

	var seo site_setting.LandingPageSEO
	if len(setting.Value) > 0 && string(setting.Value) != "{}" {
		if err := json.Unmarshal(setting.Value, &seo); err != nil {
			return nil, err
		}
	}
	return &seo, nil
}

func (s *siteSettingService) GetPricingConfig(ctx context.Context) (*site_setting.LandingPagePricing, error) {
	setting, err := s.repo.GetByKey(ctx, "landing_page_pricing")
	if err != nil {
		// Return defaults if not found
		return &site_setting.LandingPagePricing{
			DisplayCount:   3,
			ShowMonthly:    true,
			ShowYearly:     true,
			Plans:          []string{},
			PopularPlanID:  "",
			YearlyDiscount: 20,
		}, nil
	}

	var config site_setting.LandingPagePricing
	if len(setting.Value) > 0 && string(setting.Value) != "{}" {
		if err := json.Unmarshal(setting.Value, &config); err != nil {
			return nil, err
		}
	}

	// If yearly discount is 0 (likely omitted in old JSON), default to 20
	if config.YearlyDiscount == 0 {
		config.YearlyDiscount = 20
	}

	return &config, nil
}

func (s *siteSettingService) UpdateSEO(ctx context.Context, seo *site_setting.LandingPageSEO) error {
	val, err := json.Marshal(seo)
	if err != nil {
		return err
	}

	setting := &site_setting.SiteSetting{
		Key:         "landing_page_seo",
		Value:       val,
		Description: "SEO Metadata for Landing Page",
	}

	return s.repo.Upsert(ctx, setting)
}

func (s *siteSettingService) UpdatePricingConfig(ctx context.Context, config *site_setting.LandingPagePricing) error {
	val, err := json.Marshal(config)
	if err != nil {
		return err
	}

	setting := &site_setting.SiteSetting{
		Key:         "landing_page_pricing",
		Value:       val,
		Description: "Pricing section configuration for Landing Page",
	}

	return s.repo.Upsert(ctx, setting)
}

func (s *siteSettingService) ListSettings(ctx context.Context) ([]site_setting.SiteSetting, error) {
	return s.repo.List(ctx)
}

func (s *siteSettingService) GetByKey(ctx context.Context, key string) (*site_setting.SiteSetting, error) {
	return s.repo.GetByKey(ctx, key)
}
