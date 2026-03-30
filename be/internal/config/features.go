package config

import (
	"errors"
	"fmt"
)

// Feature represents a feature definition in the catalog
type Feature struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Category    string `json:"category,omitempty"`
}

// FeatureCatalog contains all available features
// This is the single source of truth for features
var FeatureCatalog = []Feature{
	// Core / Management
	{Code: "client_management", Name: "Client Management", Description: "Core client management capabilities", Category: "core"},
	{Code: "dashboard_pendapatan", Name: "Dashboard Pendapatan", Description: "Revenue dashboard", Category: "core"},

	// Billing
	{Code: "billing_basic", Name: "Billing (Basic)", Description: "Basic billing features", Category: "billing"},
	{Code: "billing_full", Name: "Billing (Full)", Description: "Complete billing suite", Category: "billing"},
	{Code: "payment_gateway", Name: "Payment Gateway", Description: "Payment gateway integration", Category: "billing"},
	{Code: "payment_reporting_advanced", Name: "Payment Reporting (Advanced)", Description: "Advanced payment reporting features", Category: "billing"},
	{Code: "collector_module", Name: "Collector Module", Description: "Features for billing collectors", Category: "billing"},
	{Code: "settlement", Name: "Collector Settlement", Description: "Manage collector settlements and deposits", Category: "billing"},

	// Network & Radius
	{Code: "radius_basic", Name: "Radius Basic", Description: "Basic Radius authentication support", Category: "network"},
	{Code: "radius_full", Name: "Radius Full", Description: "Full Radius capabilities", Category: "network"},
	{Code: "mikrotik_api", Name: "MikroTik API", Description: "Standard MikroTik API integration", Category: "network"},
	{Code: "mikrotik_api_basic", Name: "MikroTik API Basic", Description: "Basic MikroTik API integration", Category: "network"},
	{Code: "mikrotik_control_panel_advanced", Name: "MikroTik Control Panel (advanced)", Description: "Advanced MikroTik control panel features", Category: "network"},
	{Code: "isolir_manual", Name: "Manual Isolir", Description: "Manual service isolation/disconnection", Category: "network"},
	{Code: "isolir_auto", Name: "Auto Isolir", Description: "Automatic service isolation based on billing status", Category: "network"},
	{Code: "service_packages", Name: "Service Packages", Description: "Paket internet (PPPoE & Lite) + global discount settings", Category: "network"},

	// Voucher
	{Code: "voucher_basic", Name: "Voucher (Basic)", Description: "Basic voucher management", Category: "voucher"},
	{Code: "voucher_full", Name: "Voucher (Full)", Description: "Full voucher management system", Category: "voucher"},

	// Maps
	{Code: "maps_basic", Name: "Maps (Basic)", Description: "Basic mapping features", Category: "maps"},
	{Code: "maps_full", Name: "Maps (Full)", Description: "Advanced mapping capabilities", Category: "maps"},
	{Code: "odc_maps", Name: "ODC Maps", Description: "ODC mapping and visualization", Category: "maps"},
	{Code: "odp_maps", Name: "ODP Maps", Description: "ODP mapping and visualization", Category: "maps"},
	{Code: "client_maps", Name: "Client Maps", Description: "Client location mapping", Category: "maps"},

	// Security & RBAC
	{Code: "rbac_basic", Name: "RBAC (Basic)", Description: "Basic Role-Based Access Control", Category: "security"},
	{Code: "rbac_full", Name: "RBAC (Full)", Description: "Full Role-Based Access Control", Category: "security"},
	{Code: "rbac_employee", Name: "RBAC Employee", Description: "Role-based access control for employees", Category: "security"},
	{Code: "rbac_client_reseller", Name: "RBAC Client / Reseller", Description: "Role-based access control for clients and resellers", Category: "security"},

	// Communication
	{Code: "wa_gateway", Name: "WA Gateway", Description: "WhatsApp gateway integration", Category: "communication"},

	// HCM & Operations
	{Code: "hcm_module", Name: "HCM (Absensi, Gaji, Cuti, Reimbursement)", Description: "Human Capital Management module", Category: "hcm"},
	{Code: "hr_module", Name: "HR Module", Description: "Human Resources module", Category: "hcm"},
	{Code: "technician_module", Name: "Technician Module", Description: "Features for field technicians", Category: "operations"},

	// Customization
	{Code: "custom_login_page", Name: "Custom Login Page", Description: "Customizable login page", Category: "customization"},
	{Code: "custom_isolir_page", Name: "Custom Isolir Page", Description: "Customizable isolir/disconnection page", Category: "customization"},
	{Code: "custom_domain", Name: "Custom Domain", Description: "Use your own domain name", Category: "customization"},

	// Advanced & AI
	{Code: "ai_agent_client_wa", Name: "AI Agent (Client via WA)", Description: "AI agent for client interactions via WhatsApp", Category: "ai"},
	{Code: "reports_advanced", Name: "Advanced Reports", Description: "Comprehensive reporting suite", Category: "reporting"},

	// Integration & Addons
	{Code: "api_access", Name: "API Access", Description: "Access to system API", Category: "integration"},
	{Code: "api_integration_partial", Name: "API Integration (Partial)", Description: "Partial API integration support", Category: "integration"},
	{Code: "api_integration_full", Name: "API Integration (Full)", Description: "Full API integration support", Category: "integration"},
	{Code: "addon_router", Name: "Add-on Router", Description: "Additional router add-on support", Category: "addon"},
	{Code: "addon_user_packs", Name: "Add-on User Packs", Description: "Additional user pack add-ons", Category: "addon"},

	// Support
	{Code: "priority_support", Name: "Priority Support", Description: "Priority customer support", Category: "support"},

	// Special Features
	{Code: "*", Name: "Multi-tenant SaaS (Super Admin)", Description: "Super admin multi-tenant SaaS features", Category: "saas"},
}

// GetFeatureCatalog returns all features
func GetFeatureCatalog() []Feature {
	return FeatureCatalog
}

// GetFeatureByCode returns a feature by its code
func GetFeatureByCode(code string) (*Feature, bool) {
	for _, f := range FeatureCatalog {
		if f.Code == code {
			return &f, true
		}
	}
	return nil, false
}

// IsValidFeatureCode checks if a feature code is valid
func IsValidFeatureCode(code string) bool {
	_, found := GetFeatureByCode(code)
	return found
}

// ValidateFeatureCodes validates an array of feature codes
// Returns an error if any code is invalid
func ValidateFeatureCodes(codes []string) error {
	if codes == nil {
		return nil
	}

	var invalidCodes []string
	for _, code := range codes {
		if code == "" {
			continue // Skip empty codes
		}
		if !IsValidFeatureCode(code) {
			invalidCodes = append(invalidCodes, code)
		}
	}

	if len(invalidCodes) > 0 {
		return fmt.Errorf("invalid feature codes: %v", invalidCodes)
	}

	return nil
}

// ErrInvalidFeatureCode is returned when a feature code is invalid
var ErrInvalidFeatureCode = errors.New("invalid feature code")
