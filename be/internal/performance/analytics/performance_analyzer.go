package analytics

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"rrnet/internal/performance/monitoring"
)

// PerformanceAnalyzer analyzes performance trends and patterns
type PerformanceAnalyzer struct {
	collector *monitoring.MetricsCollector
}

// NewPerformanceAnalyzer creates a new performance analyzer
func NewPerformanceAnalyzer(collector *monitoring.MetricsCollector) *PerformanceAnalyzer {
	return &PerformanceAnalyzer{
		collector: collector,
	}
}

// TrendAnalysis represents performance trend analysis
type TrendAnalysis struct {
	MetricName    string
	Period        string // "hourly", "daily", "weekly", "monthly"
	Trend         string // "improving", "degrading", "stable"
	ChangePercent float64
	AverageValue  float64
	MinValue      float64
	MaxValue      float64
	DataPoints    int
	Anomalies     []Anomaly
	AnalysisDate  time.Time
}

// Anomaly represents a performance anomaly
type Anomaly struct {
	Timestamp time.Time
	Value     float64
	Severity  string // "critical", "high", "medium", "low"
	Reason    string
}

// AnalyzeTrends analyzes performance trends over time
func (pa *PerformanceAnalyzer) AnalyzeTrends(
	ctx context.Context,
	metricName string,
	period string,
) (*TrendAnalysis, error) {
	series, ok := pa.collector.GetMetricSeries(metricName)
	if !ok {
		return nil, fmt.Errorf("metric series %s not found", metricName)
	}

	analysis := &TrendAnalysis{
		MetricName:   metricName,
		Period:       period,
		DataPoints:   len(series.Values),
		AnalysisDate: time.Now(),
		Anomalies:    []Anomaly{},
	}

	if len(series.Values) == 0 {
		return analysis, nil
	}

	// Calculate statistics
	var total float64
	values := make([]float64, len(series.Values))
	for i, value := range series.Values {
		values[i] = value.Value
		total += value.Value
	}

	sort.Float64s(values)
	analysis.AverageValue = total / float64(len(values))
	analysis.MinValue = values[0]
	analysis.MaxValue = values[len(values)-1]

	// Determine trend (simplified - compare first half vs second half)
	midpoint := len(values) / 2
	firstHalfAvg := calculateAverage(values[:midpoint])
	secondHalfAvg := calculateAverage(values[midpoint:])

	changePercent := ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
	analysis.ChangePercent = changePercent

	if changePercent > 5 {
		analysis.Trend = "degrading"
	} else if changePercent < -5 {
		analysis.Trend = "improving"
	} else {
		analysis.Trend = "stable"
	}

	// Detect anomalies (values that are 2 standard deviations from mean)
	mean := analysis.AverageValue
	stdDev := calculateStdDev(values, mean)
	threshold := mean + (2 * stdDev)

	for _, value := range series.Values {
		if value.Value > threshold {
			severity := "low"
			if value.Value > mean+(3*stdDev) {
				severity = "critical"
			} else if value.Value > mean+(2.5*stdDev) {
				severity = "high"
			} else if value.Value > mean+(2*stdDev) {
				severity = "medium"
			}

			analysis.Anomalies = append(analysis.Anomalies, Anomaly{
				Timestamp: value.Timestamp,
				Value:     value.Value,
				Severity:  severity,
				Reason:    fmt.Sprintf("Value %f exceeds threshold %f (mean: %f, stddev: %f)", value.Value, threshold, mean, stdDev),
			})
		}
	}

	return analysis, nil
}

// calculateAverage calculates average of float slice
func calculateAverage(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var sum float64
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

// calculateStdDev calculates standard deviation
func calculateStdDev(values []float64, mean float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var sumSquaredDiff float64
	for _, v := range values {
		diff := v - mean
		sumSquaredDiff += diff * diff
	}
	variance := sumSquaredDiff / float64(len(values))
	return math.Sqrt(variance)
}

// ComparativeAnalysis represents comparative performance analysis
type ComparativeAnalysis struct {
	Scenario1          string
	Scenario2          string
	MetricName         string
	ImprovementPercent float64
	RegressionPercent  float64
	Scenario1Avg       float64
	Scenario2Avg       float64
	Recommendation     string
	AnalysisDate       time.Time
}

// CompareScenarios compares performance between two scenarios
func (pa *PerformanceAnalyzer) CompareScenarios(
	ctx context.Context,
	metricName1, metricName2 string,
	scenario1Name, scenario2Name string,
) (*ComparativeAnalysis, error) {
	series1, ok1 := pa.collector.GetMetricSeries(metricName1)
	series2, ok2 := pa.collector.GetMetricSeries(metricName2)

	if !ok1 || !ok2 {
		return nil, fmt.Errorf("one or both metric series not found")
	}

	analysis := &ComparativeAnalysis{
		Scenario1:    scenario1Name,
		Scenario2:    scenario2Name,
		MetricName:   metricName1,
		AnalysisDate: time.Now(),
	}

	// Calculate averages
	analysis.Scenario1Avg = calculateAverageFromSeries(series1)
	analysis.Scenario2Avg = calculateAverageFromSeries(series2)

	// Calculate improvement/regression
	if analysis.Scenario1Avg > 0 {
		changePercent := ((analysis.Scenario2Avg - analysis.Scenario1Avg) / analysis.Scenario1Avg) * 100
		if changePercent < 0 {
			analysis.ImprovementPercent = -changePercent
			analysis.Recommendation = fmt.Sprintf("Scenario 2 performs %.2f%% better than Scenario 1", analysis.ImprovementPercent)
		} else {
			analysis.RegressionPercent = changePercent
			analysis.Recommendation = fmt.Sprintf("Scenario 2 performs %.2f%% worse than Scenario 1", analysis.RegressionPercent)
		}
	}

	return analysis, nil
}

// calculateAverageFromSeries calculates average from metric series
func calculateAverageFromSeries(series *monitoring.MetricSeries) float64 {
	if len(series.Values) == 0 {
		return 0
	}
	var sum float64
	for _, value := range series.Values {
		sum += value.Value
	}
	return sum / float64(len(series.Values))
}
