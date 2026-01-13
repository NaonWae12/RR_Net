package monitoring

import (
	"context"
	"fmt"
	"sort"
	"time"
)

// BottleneckDetector detects performance bottlenecks
type BottleneckDetector struct {
	collector *MetricsCollector
	threshold time.Duration
}

// NewBottleneckDetector creates a new bottleneck detector
func NewBottleneckDetector(collector *MetricsCollector, threshold time.Duration) *BottleneckDetector {
	return &BottleneckDetector{
		collector: collector,
		threshold: threshold,
	}
}

// Bottleneck represents a detected performance bottleneck
type Bottleneck struct {
	Type        string        // "database", "application", "network", "resource", "external"
	Location    string        // Specific location of bottleneck
	Severity    string        // "critical", "high", "medium", "low"
	Impact      string        // Description of impact
	ResponseTime time.Duration
	Frequency   int           // How often it occurs
	Recommendation string     // Optimization recommendation
}

// DetectBottlenecks detects performance bottlenecks from metrics
func (bd *BottleneckDetector) DetectBottlenecks(ctx context.Context) ([]*Bottleneck, error) {
	bottlenecks := []*Bottleneck{}

	// Get all metrics
	allMetrics := bd.collector.GetAllMetrics()

	// Analyze each metric series
	for name, series := range allMetrics {
		// Check if metric name indicates latency
		if contains(name, "latency", "duration", "time") {
			bottleneck := bd.analyzeMetricSeries(name, series)
			if bottleneck != nil {
				bottlenecks = append(bottlenecks, bottleneck)
			}
		}
	}

	// Sort by severity
	sort.Slice(bottlenecks, func(i, j int) bool {
		severityOrder := map[string]int{
			"critical": 4,
			"high":     3,
			"medium":   2,
			"low":      1,
		}
		return severityOrder[bottlenecks[i].Severity] > severityOrder[bottlenecks[j].Severity]
	})

	return bottlenecks, nil
}

// analyzeMetricSeries analyzes a metric series for bottlenecks
func (bd *BottleneckDetector) analyzeMetricSeries(name string, series *MetricSeries) *Bottleneck {
	if len(series.Values) == 0 {
		return nil
	}

	// Calculate average response time
	var totalDuration time.Duration
	for _, value := range series.Values {
		totalDuration += time.Duration(value.Value) * time.Millisecond
	}
	avgDuration := totalDuration / time.Duration(len(series.Values))

	// Check if exceeds threshold
	if avgDuration <= bd.threshold {
		return nil
	}

	// Determine bottleneck type from metric name
	bottleneckType := "application"
	if contains(name, "database", "db", "query") {
		bottleneckType = "database"
	} else if contains(name, "network", "http", "api") {
		bottleneckType = "network"
	} else if contains(name, "external", "gateway", "mikrotik") {
		bottleneckType = "external"
	}

	// Determine severity
	severity := "medium"
	if avgDuration > bd.threshold*3 {
		severity = "critical"
	} else if avgDuration > bd.threshold*2 {
		severity = "high"
	}

	// Count occurrences above threshold
	frequency := 0
	for _, value := range series.Values {
		if time.Duration(value.Value)*time.Millisecond > bd.threshold {
			frequency++
		}
	}

	recommendation := bd.generateRecommendation(bottleneckType, name, avgDuration)

	return &Bottleneck{
		Type:          bottleneckType,
		Location:      name,
		Severity:      severity,
		Impact:        fmt.Sprintf("Average response time %v exceeds threshold %v", avgDuration, bd.threshold),
		ResponseTime:  avgDuration,
		Frequency:     frequency,
		Recommendation: recommendation,
	}
}

// generateRecommendation generates optimization recommendation
func (bd *BottleneckDetector) generateRecommendation(bottleneckType, location string, duration time.Duration) string {
	switch bottleneckType {
	case "database":
		return fmt.Sprintf("Optimize database queries for %s. Consider adding indexes, query optimization, or connection pooling.", location)
	case "network":
		return fmt.Sprintf("Optimize network calls for %s. Consider caching, request batching, or connection reuse.", location)
	case "external":
		return fmt.Sprintf("Optimize external service calls for %s. Consider async processing, retry logic, or service optimization.", location)
	default:
		return fmt.Sprintf("Optimize application logic for %s. Consider code optimization, caching, or algorithm improvement.", location)
	}
}

// contains checks if string contains any of the substrings
func contains(s string, substrings ...string) bool {
	for _, substr := range substrings {
		if len(s) >= len(substr) {
			for i := 0; i <= len(s)-len(substr); i++ {
				if s[i:i+len(substr)] == substr {
					return true
				}
			}
		}
	}
	return false
}

