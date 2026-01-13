package redis

import (
	"context"

	"github.com/go-redis/redis/v8"
	"github.com/rs/zerolog/log"
)

// NewClient creates a new Redis client with lazy connection.
func NewClient(addr, password string, db int) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	log.Info().
		Str("addr", addr).
		Int("db", db).
		Msg("Redis client initialized")

	return client
}

// Ping checks Redis connection health.
func Ping(ctx context.Context, client *redis.Client) error {
	return client.Ping(ctx).Err()
}

