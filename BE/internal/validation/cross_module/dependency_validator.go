package cross_module

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	redisclient "github.com/go-redis/redis/v8"
)

// DependencyValidator validates module dependencies
type DependencyValidator struct {
	db    *pgxpool.Pool
	redis *redisclient.Client
}

// NewDependencyValidator creates a new dependency validator
func NewDependencyValidator(db *pgxpool.Pool, redis *redisclient.Client) *DependencyValidator {
	return &DependencyValidator{
		db:    db,
		redis: redis,
	}
}

// DependencyValidationResult represents the result of a dependency validation
type DependencyValidationResult struct {
	Valid       bool
	Message     string
	Dependency  string
	Status      string
	Errors      []string
	CheckedAt   time.Time
}

// ValidateDatabaseDependency validates database dependency
func (v *DependencyValidator) ValidateDatabaseDependency(ctx context.Context) (*DependencyValidationResult, error) {
	result := &DependencyValidationResult{
		Valid:      true,
		Dependency: "database",
		CheckedAt:  time.Now(),
		Errors:     []string{},
	}

	// Test database connection
	err := v.db.Ping(ctx)
	if err != nil {
		result.Valid = false
		result.Status = "unavailable"
		result.Errors = append(result.Errors, fmt.Sprintf("Database connection failed: %v", err))
		result.Message = "Database dependency validation failed"
		return result, nil
	}

	result.Status = "available"
	result.Message = "Database dependency validated successfully"
	return result, nil
}

// ValidateRedisDependency validates Redis dependency
func (v *DependencyValidator) ValidateRedisDependency(ctx context.Context) (*DependencyValidationResult, error) {
	result := &DependencyValidationResult{
		Valid:      true,
		Dependency: "redis",
		CheckedAt:  time.Now(),
		Errors:     []string{},
	}

	// Test Redis connection
	err := v.redis.Ping(ctx).Err()
	if err != nil {
		result.Valid = false
		result.Status = "unavailable"
		result.Errors = append(result.Errors, fmt.Sprintf("Redis connection failed: %v", err))
		result.Message = "Redis dependency validation failed"
		return result, nil
	}

	result.Status = "available"
	result.Message = "Redis dependency validated successfully"
	return result, nil
}

// ValidateAllDependencies validates all module dependencies
func (v *DependencyValidator) ValidateAllDependencies(ctx context.Context) (map[string]*DependencyValidationResult, error) {
	results := make(map[string]*DependencyValidationResult)

	// Validate database
	dbResult, err := v.ValidateDatabaseDependency(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to validate database dependency: %w", err)
	}
	results["database"] = dbResult

	// Validate Redis
	redisResult, err := v.ValidateRedisDependency(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to validate redis dependency: %w", err)
	}
	results["redis"] = redisResult

	// Note: External service dependencies (Mikrotik, Payment Gateway, WA Gateway)
	// would be validated here when those modules are implemented

	return results, nil
}

