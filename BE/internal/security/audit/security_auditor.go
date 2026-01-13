package audit

import (
	"context"
	"fmt"
	"time"
)

// SecurityAuditor performs security audits
type SecurityAuditor struct {
	checks []SecurityCheck
}

// NewSecurityAuditor creates a new security auditor
func NewSecurityAuditor(checks []SecurityCheck) *SecurityAuditor {
	return &SecurityAuditor{
		checks: checks,
	}
}

// SecurityCheck represents a security check
type SecurityCheck interface {
	Name() string
	Execute(ctx context.Context) (*SecurityCheckResult, error)
}

// SecurityCheckResult represents the result of a security check
type SecurityCheckResult struct {
	CheckName    string
	Status       string // "passed", "failed", "warning"
	Message      string
	Severity     string // "low", "medium", "high", "critical"
	Recommendations []string
	Timestamp    time.Time
}

// AuditResult represents the result of a security audit
type AuditResult struct {
	TotalChecks   int
	PassedChecks  int
	FailedChecks  int
	WarningChecks int
	Results       []*SecurityCheckResult
	Timestamp     time.Time
}

// RunAudit runs a security audit
func (sa *SecurityAuditor) RunAudit(ctx context.Context) (*AuditResult, error) {
	result := &AuditResult{
		Results:   []*SecurityCheckResult{},
		Timestamp: time.Now(),
	}

	for _, check := range sa.checks {
		checkResult, err := check.Execute(ctx)
		if err != nil {
			return nil, fmt.Errorf("security check %s failed: %w", check.Name(), err)
		}

		result.TotalChecks++
		result.Results = append(result.Results, checkResult)

		switch checkResult.Status {
		case "passed":
			result.PassedChecks++
		case "failed":
			result.FailedChecks++
		case "warning":
			result.WarningChecks++
		}
	}

	return result, nil
}

// VulnerabilityScanner scans for vulnerabilities
type VulnerabilityScanner struct {
	scanners []VulnerabilityScannerType
}

// NewVulnerabilityScanner creates a new vulnerability scanner
func NewVulnerabilityScanner(scanners []VulnerabilityScannerType) *VulnerabilityScanner {
	return &VulnerabilityScanner{
		scanners: scanners,
	}
}

// VulnerabilityScannerType represents a type of vulnerability scanner
type VulnerabilityScannerType interface {
	Name() string
	Scan(ctx context.Context) ([]Vulnerability, error)
}

// Vulnerability represents a detected vulnerability
type Vulnerability struct {
	ID            string
	Type          string
	Severity      string // "low", "medium", "high", "critical"
	Description   string
	Location      string
	Recommendation string
	Timestamp     time.Time
}

// ScanVulnerabilities scans for vulnerabilities
func (vs *VulnerabilityScanner) ScanVulnerabilities(ctx context.Context) ([]Vulnerability, error) {
	allVulnerabilities := []Vulnerability{}

	for _, scanner := range vs.scanners {
		vulnerabilities, err := scanner.Scan(ctx)
		if err != nil {
			return nil, fmt.Errorf("scanner %s failed: %w", scanner.Name(), err)
		}
		allVulnerabilities = append(allVulnerabilities, vulnerabilities...)
	}

	return allVulnerabilities, nil
}

// ConfigurationReviewer reviews security configurations
type ConfigurationReviewer struct {
	reviewers []ConfigurationReviewerType
}

// NewConfigurationReviewer creates a new configuration reviewer
func NewConfigurationReviewer(reviewers []ConfigurationReviewerType) *ConfigurationReviewer {
	return &ConfigurationReviewer{
		reviewers: reviewers,
	}
}

// ConfigurationReviewerType represents a type of configuration reviewer
type ConfigurationReviewerType interface {
	Name() string
	Review(ctx context.Context) ([]ConfigurationIssue, error)
}

// ConfigurationIssue represents a configuration security issue
type ConfigurationIssue struct {
	Type          string
	Severity      string
	Description   string
	Location      string
	Recommendation string
	Timestamp     time.Time
}

// ReviewConfigurations reviews security configurations
func (cr *ConfigurationReviewer) ReviewConfigurations(ctx context.Context) ([]ConfigurationIssue, error) {
	allIssues := []ConfigurationIssue{}

	for _, reviewer := range cr.reviewers {
		issues, err := reviewer.Review(ctx)
		if err != nil {
			return nil, fmt.Errorf("reviewer %s failed: %w", reviewer.Name(), err)
		}
		allIssues = append(allIssues, issues...)
	}

	return allIssues, nil
}

