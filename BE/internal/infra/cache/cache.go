package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

// Cache provides caching functionality using Redis
type Cache struct {
	redis  *redis.Client
	prefix string
}

// NewCache creates a new cache instance
func NewCache(redisClient *redis.Client, prefix string) *Cache {
	return &Cache{
		redis:  redisClient,
		prefix: prefix,
	}
}

// Get retrieves a value from cache
func (c *Cache) Get(ctx context.Context, key string, dest interface{}) error {
	fullKey := c.prefix + ":" + key
	val, err := c.redis.Get(ctx, fullKey).Result()
	if err == redis.Nil {
		return ErrCacheMiss
	}
	if err != nil {
		return fmt.Errorf("cache get error: %w", err)
	}

	return json.Unmarshal([]byte(val), dest)
}

// Set stores a value in cache with TTL
func (c *Cache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	fullKey := c.prefix + ":" + key
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("cache marshal error: %w", err)
	}

	return c.redis.Set(ctx, fullKey, data, ttl).Err()
}

// Delete removes a value from cache
func (c *Cache) Delete(ctx context.Context, key string) error {
	fullKey := c.prefix + ":" + key
	return c.redis.Del(ctx, fullKey).Err()
}

// DeletePattern removes all keys matching a pattern
func (c *Cache) DeletePattern(ctx context.Context, pattern string) error {
	fullPattern := c.prefix + ":" + pattern
	keys, err := c.redis.Keys(ctx, fullPattern).Result()
	if err != nil {
		return fmt.Errorf("cache keys error: %w", err)
	}

	if len(keys) > 0 {
		return c.redis.Del(ctx, keys...).Err()
	}

	return nil
}

// Exists checks if a key exists in cache
func (c *Cache) Exists(ctx context.Context, key string) (bool, error) {
	fullKey := c.prefix + ":" + key
	count, err := c.redis.Exists(ctx, fullKey).Result()
	return count > 0, err
}

// ErrCacheMiss is returned when a cache key is not found
var ErrCacheMiss = fmt.Errorf("cache miss")

