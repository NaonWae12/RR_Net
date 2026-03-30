package site_setting

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// SiteSetting represents a global configuration for the platform
type SiteSetting struct {
	ID          uuid.UUID       `json:"id"`
	Key         string          `json:"key"`
	Value       json.RawMessage `json:"value"`
	Description string          `json:"description"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// LandingPageSEO represents SEO settings
type LandingPageSEO struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Keywords    []string `json:"keywords"`
}

// LandingPagePricing represents pricing section configuration
type LandingPagePricing struct {
	DisplayCount   int      `json:"display_count"`
	ShowMonthly    bool     `json:"show_monthly"`
	ShowYearly     bool     `json:"show_yearly"`
	Plans          []string `json:"plans"` // List of plan IDs to show, if empty show active/public
	PopularPlanID  string   `json:"popular_plan_id"`
	YearlyDiscount int      `json:"yearly_discount"` // Discount percentage, e.g. 20
}
