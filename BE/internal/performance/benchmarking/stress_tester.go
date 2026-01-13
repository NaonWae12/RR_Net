package benchmarking

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// StressTester performs stress testing to identify system limits
type StressTester struct {
	maxConcurrency int
	rampUpDuration time.Duration
	testDuration   time.Duration
}

// NewStressTester creates a new stress tester
func NewStressTester(maxConcurrency int, rampUpDuration, testDuration time.Duration) *StressTester {
	return &StressTester{
		maxConcurrency: maxConcurrency,
		rampUpDuration: rampUpDuration,
		testDuration:   testDuration,
	}
}

// StressTestResult represents the result of a stress test
type StressTestResult struct {
	BreakingPoint      int    // Concurrent users at breaking point
	MaxThroughput       float64 // Maximum requests per second
	FailurePoint        int    // Point where failures start
	RecoveryTime        time.Duration
	DataCorruption      bool
	SystemStability     bool
	ResourceExhaustion  string // "memory", "cpu", "database", "network", "none"
	Errors              []string
	TestDuration        time.Duration
}

// RunStressTest runs a stress test with gradual ramp-up
func (st *StressTester) RunStressTest(
	ctx context.Context,
	operation func(context.Context) error,
) (*StressTestResult, error) {
	result := &StressTestResult{
		Errors: []string{},
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	metrics := []RequestMetrics{}
	startTime := time.Now()
	endTime := startTime.Add(st.testDuration)

	// Gradual ramp-up
	rampUpEnd := startTime.Add(st.rampUpDuration)
	currentConcurrency := 0

	// Start workers with gradual ramp-up
	for i := 0; i < st.maxConcurrency; i++ {
		// Wait for ramp-up time
		if time.Now().Before(rampUpEnd) {
			time.Sleep(st.rampUpDuration / time.Duration(st.maxConcurrency))
		}

		wg.Add(1)
		currentConcurrency++
		go func(workerID int) {
			defer wg.Done()
			requestCount := 0
			for {
				if time.Now().After(endTime) {
					return
				}

				reqStart := time.Now()
				err := operation(ctx)
				duration := time.Since(reqStart)

				mu.Lock()
				metric := RequestMetrics{
					Duration: duration,
					Success:  err == nil,
					Error:    err,
				}
				metrics = append(metrics, metric)
				requestCount++
				if err != nil {
					result.FailurePoint = currentConcurrency
					result.Errors = append(result.Errors, fmt.Sprintf("Worker %d request failed: %v", workerID, err))
				}
				mu.Unlock()

				// Small delay to prevent overwhelming
				time.Sleep(10 * time.Millisecond)
			}
		}(i)
	}

	wg.Wait()

	// Calculate statistics
	if len(metrics) > 0 {
		successCount := int64(0)
		var totalDuration time.Duration
		for _, m := range metrics {
			if m.Success {
				successCount++
			}
			totalDuration += m.Duration
		}

		elapsed := time.Since(startTime)
		result.MaxThroughput = float64(successCount) / elapsed.Seconds()
		result.BreakingPoint = currentConcurrency
		result.TestDuration = elapsed

		// Check for data corruption (simplified - would need actual data validation)
		result.DataCorruption = false

		// Check system stability
		errorRate := float64(len(result.Errors)) / float64(len(metrics))
		result.SystemStability = errorRate < 0.1 // Less than 10% error rate

		// Determine resource exhaustion (simplified)
		if len(result.Errors) > len(metrics)/2 {
			result.ResourceExhaustion = "unknown" // Would be determined by monitoring
		} else {
			result.ResourceExhaustion = "none"
		}
	}

	return result, nil
}

