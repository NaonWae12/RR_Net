package regression

import (
	"context"
	"fmt"
	"sort"
	"time"

	"rrnet/internal/performance/monitoring"
)

// RegressionDetector detects performance regressions
type RegressionDetector struct {
	collector *monitoring.MetricsCollector
	baselines map[string]*Baseline
}

// NewRegressionDetector creates a new regression detector
func NewRegressionDetector(collector *monitoring.MetricsCollector) *RegressionDetector {
	return &RegressionDetector{
		collector: collector,
		baselines: make(map[string]*Baseline),
	}
}

// Baseline represents a performance baseline
type Baseline struct {
	MetricName    string
	AverageValue  float64
	P95Value      float64
	P99Value      float64
	Threshold     float64 // Percentage threshold for regression detection
	CreatedAt     time.Time
	Version       string
	Environment   string
}

// Regression represents a detected performance regression
type Regression struct {
	MetricName      string
	BaselineVersion string
	CurrentVersion  string
	RegressionType  string // "response_time", "throughput", "error_rate", "resource_usage"
	Severity        string // "critical", "high", "medium", "low"
	BaselineValue   float64
	CurrentValue    float64
	RegressionPercent float64
	Impact          string
	Recommendation  string
	DetectedAt      time.Time
}

// CreateBaseline creates a performance baseline
func (rd *RegressionDetector) CreateBaseline(
	ctx context.Context,
	metricName string,
	version string,
	environment string,
	threshold float64,
) (*Baseline, error) {
	series, ok := rd.collector.GetMetricSeries(metricName)
	if !ok {
		return nil, fmt.Errorf("metric series %s not found", metricName)
	}

	if len(series.Values) == 0 {
		return nil, fmt.Errorf("no data points in metric series %s", metricName)
	}

	// Calculate statistics
	values := make([]float64, len(series.Values))
	var sum float64
	for i, value := range series.Values {
		values[i] = value.Value
		sum += value.Value
	}

	// Sort for percentile calculation
	sort.Float64s(values)

	baseline := &Baseline{
		MetricName:   metricName,
		AverageValue: sum / float64(len(values)),
		P95Value:     calculatePercentile(values, 95),
		P99Value:     calculatePercentile(values, 99),
		Threshold:    threshold,
		CreatedAt:    time.Now(),
		Version:      version,
		Environment:  environment,
	}

	rd.baselines[metricName] = baseline
	return baseline, nil
}

// DetectRegression detects performance regression against baseline
func (rd *RegressionDetector) DetectRegression(
	ctx context.Context,
	metricName string,
	currentVersion string,
) (*Regression, error) {
	baseline, ok := rd.baselines[metricName]
	if !ok {
		return nil, fmt.Errorf("baseline not found for metric %s", metricName)
	}

	series, ok := rd.collector.GetMetricSeries(metricName)
	if !ok {
		return nil, fmt.Errorf("metric series %s not found", metricName)
	}

	if len(series.Values) == 0 {
		return nil, fmt.Errorf("no data points in metric series %s", metricName)
	}

	// Calculate current average
	var sum float64
	for _, value := range series.Values {
		sum += value.Value
	}
	currentAvg := sum / float64(len(series.Values))

	// Check for regression
	regressionPercent := ((currentAvg - baseline.AverageValue) / baseline.AverageValue) * 100

	// Only report if exceeds threshold
	if regressionPercent <= baseline.Threshold {
		return nil, nil // No regression
	}

	// Determine severity
	severity := "low"
	if regressionPercent > 50 {
		severity = "critical"
	} else if regressionPercent > 30 {
		severity = "high"
	} else if regressionPercent > 15 {
		severity = "medium"
	}

	// Determine regression type from metric name
	regressionType := "response_time"
	if contains(metricName, "throughput", "rate") {
		regressionType = "throughput"
	} else if contains(metricName, "error", "failure") {
		regressionType = "error_rate"
	} else if contains(metricName, "memory", "cpu", "resource") {
		regressionType = "resource_usage"
	}

	regression := &Regression{
		MetricName:       metricName,
		BaselineVersion:  baseline.Version,
		CurrentVersion:   currentVersion,
		RegressionType:   regressionType,
		Severity:         severity,
		BaselineValue:    baseline.AverageValue,
		CurrentValue:     currentAvg,
		RegressionPercent: regressionPercent,
		Impact:           fmt.Sprintf("Performance degraded by %.2f%%", regressionPercent),
		Recommendation:   fmt.Sprintf("Investigate %s regression. Baseline: %.2f, Current: %.2f", metricName, baseline.AverageValue, currentAvg),
		DetectedAt:       time.Now(),
	}

	return regression, nil
}

// calculatePercentile calculates percentile value
func calculatePercentile(values []float64, percentile int) float64 {
	if len(values) == 0 {
		return 0
	}
	index := (percentile * len(values)) / 100
	if index >= len(values) {
		index = len(values) - 1
	}
	return values[index]
}


// contains checks if string contains substring
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

