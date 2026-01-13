package performance

import (
	"context"
	"fmt"
	"time"

	"rrnet/internal/performance/monitoring"
)

// InteractionValidator validates performance of module interactions
type InteractionValidator struct {
	monitor *monitoring.PerformanceMonitor
}

// NewInteractionValidator creates a new interaction validator
func NewInteractionValidator(monitor *monitoring.PerformanceMonitor) *InteractionValidator {
	return &InteractionValidator{
		monitor: monitor,
	}
}

// InteractionValidationResult represents the result of an interaction validation
type InteractionValidationResult struct {
	Valid          bool
	Message        string
	Interaction    string
	ResponseTime   time.Duration
	Threshold      time.Duration
	Errors         []string
	ValidatedAt    time.Time
}

// ValidateModuleInteraction validates performance of a module interaction
func (v *InteractionValidator) ValidateModuleInteraction(
	ctx context.Context,
	interactionName string,
	operation func(context.Context) error,
	threshold time.Duration,
) (*InteractionValidationResult, error) {
	result := &InteractionValidationResult{
		Valid:       true,
		Interaction: interactionName,
		Threshold:   threshold,
		ValidatedAt: time.Now(),
		Errors:      []string{},
	}

	// Measure operation performance
	start := time.Now()
	err := v.monitor.MonitorOperation(ctx, interactionName, operation)
	duration := time.Since(start)

	result.ResponseTime = duration

	// Check if response time exceeds threshold
	if duration > threshold {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf(
			"Response time %v exceeds threshold %v",
			duration,
			threshold,
		))
		result.Message = fmt.Sprintf(
			"Interaction %s performance validation failed: response time %v exceeds threshold %v",
			interactionName,
			duration,
			threshold,
		)
	} else {
		result.Message = fmt.Sprintf(
			"Interaction %s performance validated successfully: response time %v",
			interactionName,
			duration,
		)
	}

	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("Operation failed: %v", err))
	}

	return result, nil
}

// ValidateMultipleInteractions validates performance of multiple interactions
func (v *InteractionValidator) ValidateMultipleInteractions(
	ctx context.Context,
	interactions map[string]struct {
		Operation func(context.Context) error
		Threshold time.Duration
	},
) (map[string]*InteractionValidationResult, error) {
	results := make(map[string]*InteractionValidationResult)

	for name, interaction := range interactions {
		result, err := v.ValidateModuleInteraction(
			ctx,
			name,
			interaction.Operation,
			interaction.Threshold,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to validate interaction %s: %w", name, err)
		}
		results[name] = result
	}

	return results, nil
}
