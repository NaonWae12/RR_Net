package health

import (
	"context"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Status struct {
	Status   string            `json:"status"`
	Services map[string]string `json:"services"`
}

// Check performs health checks on all infrastructure dependencies.
func Check(ctx context.Context, db *pgxpool.Pool, redis *redis.Client) Status {
	status := Status{
		Status:   "healthy",
		Services: make(map[string]string),
	}

	// Check PostgreSQL
	checkCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	if err := db.Ping(checkCtx); err != nil {
		status.Status = "unhealthy"
		status.Services["postgres"] = "down: " + err.Error()
	} else {
		status.Services["postgres"] = "up"
	}

	// Check Redis
	checkCtx, cancel = context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	if err := redis.Ping(checkCtx).Err(); err != nil {
		status.Status = "unhealthy"
		status.Services["redis"] = "down: " + err.Error()
	} else {
		status.Services["redis"] = "up"
	}

	return status
}

