package reporting

import (
	"context"
	"fmt"
	"time"

	"rrnet/internal/security/audit"
	"rrnet/internal/security/compliance"
	"rrnet/internal/security/scanning"
)

// SecurityReporter generates security reports
type SecurityReporter struct {
	auditor      *audit.SecurityAuditor
	scanner      *scanning.DependencyScanner
	compliance   *compliance.ComplianceValidator
}

// NewSecurityReporter creates a new security reporter
func NewSecurityReporter(
	auditor *audit.SecurityAuditor,
	scanner *scanning.DependencyScanner,
	compliance *compliance.ComplianceValidator,
) *SecurityReporter {
	return &SecurityReporter{
		auditor:    auditor,
		scanner:    scanner,
		compliance: compliance,
	}
}

// SecurityReport represents a comprehensive security report
type SecurityReport struct {
	ReportID          string
	ReportType        string
	GeneratedAt       time.Time
	Summary           SecuritySummary
	Vulnerabilities   []audit.Vulnerability
	ComplianceResults map[string]*compliance.ComplianceResult
	Recommendations   []string
}

// SecuritySummary represents a summary of security status
type SecuritySummary struct {
	TotalVulnerabilities int
	CriticalVulnerabilities int
	HighVulnerabilities   int
	MediumVulnerabilities int
	LowVulnerabilities    int
	ComplianceScore      float64
	OverallStatus        string // "secure", "at_risk", "critical"
}

// GenerateVulnerabilityReport generates a vulnerability report
func (sr *SecurityReporter) GenerateVulnerabilityReport(ctx context.Context) (*SecurityReport, error) {
	report := &SecurityReport{
		ReportID:        fmt.Sprintf("VULN-%d", time.Now().Unix()),
		ReportType:      "vulnerability",
		GeneratedAt:     time.Now(),
		Vulnerabilities: []audit.Vulnerability{},
		ComplianceResults: make(map[string]*compliance.ComplianceResult),
		Recommendations: []string{},
	}

	// Run security audit
	auditResult, err := sr.auditor.RunAudit(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to run security audit: %w", err)
	}

	// Scan dependencies
	dependencyVulns, err := sr.scanner.ScanDependencies(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to scan dependencies: %w", err)
	}

	// Convert dependency vulnerabilities to audit vulnerabilities
	for _, depVuln := range dependencyVulns {
		vuln := audit.Vulnerability{
			ID:            depVuln.VulnerabilityID,
			Type:          "dependency",
			Severity:      depVuln.Severity,
			Description:   depVuln.Description,
			Location:      fmt.Sprintf("%s@%s", depVuln.PackageName, depVuln.Version),
			Recommendation: depVuln.Recommendation,
			Timestamp:     depVuln.Timestamp,
		}
		report.Vulnerabilities = append(report.Vulnerabilities, vuln)
	}

	// Calculate summary
	report.Summary = sr.calculateSummary(report.Vulnerabilities, auditResult)

	// Generate recommendations
	report.Recommendations = sr.generateRecommendations(report.Vulnerabilities, auditResult)

	return report, nil
}

// GenerateComplianceReport generates a compliance report
func (sr *SecurityReporter) GenerateComplianceReport(ctx context.Context) (*SecurityReport, error) {
	report := &SecurityReport{
		ReportID:        fmt.Sprintf("COMP-%d", time.Now().Unix()),
		ReportType:      "compliance",
		GeneratedAt:     time.Now(),
		Vulnerabilities: []audit.Vulnerability{},
		ComplianceResults: make(map[string]*compliance.ComplianceResult),
		Recommendations: []string{},
	}

	// Validate compliance
	complianceResults, err := sr.compliance.ValidateAllCompliance(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to validate compliance: %w", err)
	}

	report.ComplianceResults = complianceResults

	// Calculate compliance score
	totalScore := 0.0
	count := 0
	for _, result := range complianceResults {
		totalScore += result.Score
		count++
	}
	if count > 0 {
		report.Summary.ComplianceScore = totalScore / float64(count)
	}

	// Generate recommendations
	report.Recommendations = sr.generateComplianceRecommendations(complianceResults)

	return report, nil
}

// GenerateSecurityMetricsReport generates a security metrics report
func (sr *SecurityReporter) GenerateSecurityMetricsReport(ctx context.Context) (*SecurityReport, error) {
	report := &SecurityReport{
		ReportID:        fmt.Sprintf("METRICS-%d", time.Now().Unix()),
		ReportType:      "metrics",
		GeneratedAt:     time.Now(),
		Vulnerabilities: []audit.Vulnerability{},
		ComplianceResults: make(map[string]*compliance.ComplianceResult),
		Recommendations: []string{},
	}

	// Run security audit
	auditResult, err := sr.auditor.RunAudit(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to run security audit: %w", err)
	}

	// Validate compliance
	complianceResults, err := sr.compliance.ValidateAllCompliance(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to validate compliance: %w", err)
	}

	report.ComplianceResults = complianceResults

	// Calculate summary
	report.Summary = sr.calculateSummary([]audit.Vulnerability{}, auditResult)

	// Calculate compliance score
	totalScore := 0.0
	count := 0
	for _, result := range complianceResults {
		totalScore += result.Score
		count++
	}
	if count > 0 {
		report.Summary.ComplianceScore = totalScore / float64(count)
	}

	return report, nil
}

// calculateSummary calculates security summary
func (sr *SecurityReporter) calculateSummary(
	vulnerabilities []audit.Vulnerability,
	auditResult *audit.AuditResult,
) SecuritySummary {
	summary := SecuritySummary{
		TotalVulnerabilities: len(vulnerabilities),
	}

	for _, vuln := range vulnerabilities {
		switch vuln.Severity {
		case "critical":
			summary.CriticalVulnerabilities++
		case "high":
			summary.HighVulnerabilities++
		case "medium":
			summary.MediumVulnerabilities++
		case "low":
			summary.LowVulnerabilities++
		}
	}

	// Determine overall status
	if summary.CriticalVulnerabilities > 0 {
		summary.OverallStatus = "critical"
	} else if summary.HighVulnerabilities > 0 {
		summary.OverallStatus = "at_risk"
	} else {
		summary.OverallStatus = "secure"
	}

	return summary
}

// generateRecommendations generates security recommendations
func (sr *SecurityReporter) generateRecommendations(
	vulnerabilities []audit.Vulnerability,
	auditResult *audit.AuditResult,
) []string {
	recommendations := []string{}

	// Add recommendations based on vulnerabilities
	for _, vuln := range vulnerabilities {
		if vuln.Severity == "critical" || vuln.Severity == "high" {
			recommendations = append(recommendations, fmt.Sprintf("Address %s vulnerability: %s", vuln.Severity, vuln.Recommendation))
		}
	}

	// Add recommendations based on audit results
	if auditResult.FailedChecks > 0 {
		recommendations = append(recommendations, fmt.Sprintf("Address %d failed security checks", auditResult.FailedChecks))
	}

	return recommendations
}

// generateComplianceRecommendations generates compliance recommendations
func (sr *SecurityReporter) generateComplianceRecommendations(
	results map[string]*compliance.ComplianceResult,
) []string {
	recommendations := []string{}

	for standard, result := range results {
		if result.Status != "compliant" {
			recommendations = append(recommendations, fmt.Sprintf("Improve %s compliance: current score %.2f", standard, result.Score))
			recommendations = append(recommendations, result.Recommendations...)
		}
	}

	return recommendations
}

