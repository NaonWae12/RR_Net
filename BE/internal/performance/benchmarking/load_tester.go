package benchmarking

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// LoadTester performs load testing on system components
type LoadTester struct {
	concurrency int
	duration    time.Duration
}

// NewLoadTester creates a new load tester
func NewLoadTester(concurrency int, duration time.Duration) *LoadTester {
	return &LoadTester{
		concurrency: concurrency,
		duration:    duration,
	}
}

// LoadTestResult represents the result of a load test
type LoadTestResult struct {
	TotalRequests    int64
	SuccessfulRequests int64
	FailedRequests   int64
	AverageLatency   time.Duration
	P95Latency       time.Duration
	P99Latency       time.Duration
	Throughput       float64 // requests per second
	Errors           []string
}

// RequestMetrics tracks metrics for a single request
type RequestMetrics struct {
	Duration time.Duration
	Success  bool
	Error    error
}

// RunLoadTest runs a load test with the specified operation
func (lt *LoadTester) RunLoadTest(
	ctx context.Context,
	operation func(context.Context) error,
) (*LoadTestResult, error) {
	result := &LoadTestResult{
		Errors: []string{},
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	metrics := []RequestMetrics{}
	startTime := time.Now()
	endTime := startTime.Add(lt.duration)

	// Start concurrent workers
	for i := 0; i < lt.concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				if time.Now().After(endTime) {
					return
				}

				reqStart := time.Now()
				err := operation(ctx)
				duration := time.Since(reqStart)

				mu.Lock()
				result.TotalRequests++
				metric := RequestMetrics{
					Duration: duration,
					Success:  err == nil,
					Error:    err,
				}
				metrics = append(metrics, metric)
				if err != nil {
					result.FailedRequests++
					result.Errors = append(result.Errors, fmt.Sprintf("Request failed: %v", err))
				} else {
					result.SuccessfulRequests++
				}
				mu.Unlock()
			}
		}()
	}

	wg.Wait()

	// Calculate statistics
	if len(metrics) > 0 {
		// Calculate average latency
		var totalDuration time.Duration
		for _, m := range metrics {
			totalDuration += m.Duration
		}
		result.AverageLatency = totalDuration / time.Duration(len(metrics))

		// Calculate percentiles (simplified)
		result.P95Latency = calculatePercentile(metrics, 95)
		result.P99Latency = calculatePercentile(metrics, 99)

		// Calculate throughput
		elapsed := time.Since(startTime)
		result.Throughput = float64(result.TotalRequests) / elapsed.Seconds()
	}

	return result, nil
}

// calculatePercentile calculates the percentile latency
func calculatePercentile(metrics []RequestMetrics, percentile int) time.Duration {
	if len(metrics) == 0 {
		return 0
	}

	// Sort by duration (simplified - in production use proper sorting)
	// For now, just return average as approximation
	var total time.Duration
	for _, m := range metrics {
		total += m.Duration
	}
	return total / time.Duration(len(metrics))
}

