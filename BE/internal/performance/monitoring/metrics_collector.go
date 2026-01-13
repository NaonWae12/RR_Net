package monitoring

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// MetricsCollector collects performance metrics
type MetricsCollector struct {
	mu      sync.RWMutex
	metrics map[string]*MetricSeries
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		metrics: make(map[string]*MetricSeries),
	}
}

// MetricSeries represents a series of metric values over time
type MetricSeries struct {
	Name      string
	Values    []MetricValue
	mu        sync.RWMutex
	MaxValues int
}

// MetricValue represents a single metric value at a point in time
type MetricValue struct {
	Timestamp time.Time
	Value     float64
	Labels    map[string]string
}

// NewMetricSeries creates a new metric series
func NewMetricSeries(name string, maxValues int) *MetricSeries {
	return &MetricSeries{
		Name:      name,
		Values:    []MetricValue{},
		MaxValues: maxValues,
	}
}

// RecordMetric records a metric value
func (mc *MetricsCollector) RecordMetric(name string, value float64, labels map[string]string) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	series, ok := mc.metrics[name]
	if !ok {
		series = NewMetricSeries(name, 1000) // Keep last 1000 values
		mc.metrics[name] = series
	}

	series.mu.Lock()
	defer series.mu.Unlock()

	metricValue := MetricValue{
		Timestamp: time.Now(),
		Value:     value,
		Labels:    labels,
	}

	series.Values = append(series.Values, metricValue)

	// Trim if exceeds max values
	if len(series.Values) > series.MaxValues {
		series.Values = series.Values[len(series.Values)-series.MaxValues:]
	}
}

// GetMetricSeries gets a metric series by name
func (mc *MetricsCollector) GetMetricSeries(name string) (*MetricSeries, bool) {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	series, ok := mc.metrics[name]
	return series, ok
}

// GetAllMetrics gets all metric series
func (mc *MetricsCollector) GetAllMetrics() map[string]*MetricSeries {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	result := make(map[string]*MetricSeries)
	for k, v := range mc.metrics {
		result[k] = v
	}
	return result
}

// PerformanceMonitor monitors performance in real-time
type PerformanceMonitor struct {
	collector *MetricsCollector
	thresholds map[string]float64
}

// NewPerformanceMonitor creates a new performance monitor
func NewPerformanceMonitor(collector *MetricsCollector, thresholds map[string]float64) *PerformanceMonitor {
	return &PerformanceMonitor{
		collector:  collector,
		thresholds: thresholds,
	}
}

// MonitorOperation monitors an operation and records metrics
func (pm *PerformanceMonitor) MonitorOperation(
	ctx context.Context,
	operationName string,
	operation func(context.Context) error,
) error {
	start := time.Now()
	err := operation(ctx)
	duration := time.Since(start)

	// Record latency
	pm.collector.RecordMetric(
		fmt.Sprintf("%s_latency", operationName),
		float64(duration.Milliseconds()),
		map[string]string{"operation": operationName},
	)

	// Record success/failure
	success := 0.0
	if err == nil {
		success = 1.0
	}
	pm.collector.RecordMetric(
		fmt.Sprintf("%s_success", operationName),
		success,
		map[string]string{"operation": operationName},
	)

	// Check threshold
	if threshold, ok := pm.thresholds[operationName]; ok {
		if float64(duration.Milliseconds()) > threshold {
			// Threshold exceeded - could trigger alert
			_ = threshold // Use threshold for alerting logic
		}
	}

	return err
}

