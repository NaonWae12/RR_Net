package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"time"

	"rrnet/internal/metrics"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// RedisClientInterface defines the interface for Redis operations needed by rate limiter
type RedisClientInterface interface {
	Pipeline() redis.Pipeliner
	TTL(ctx context.Context, key string) *redis.DurationCmd
}

// RateLimiter implements per-tenant and per-IP rate limiting using Redis
type RateLimiter struct {
	redis         RedisClientInterface
	defaultLimit  int                        // Default requests per window
	defaultWindow time.Duration              // Default time window
	limits        map[string]RateLimitConfig // Per-endpoint limits
}

// RateLimitConfig holds rate limit configuration for a specific endpoint
type RateLimitConfig struct {
	Limit  int
	Window time.Duration
}

// NewRateLimiter creates a new rate limiter with default limits
func NewRateLimiter(redisClient RedisClientInterface, defaultLimit int, defaultWindow time.Duration) *RateLimiter {
	return &RateLimiter{
		redis:         redisClient,
		defaultLimit:  defaultLimit,
		defaultWindow: defaultWindow,
		limits:        make(map[string]RateLimitConfig),
	}
}

// SetEndpointLimit sets a custom rate limit for a specific endpoint pattern
func (rl *RateLimiter) SetEndpointLimit(endpoint string, limit int, window time.Duration) {
	rl.limits[endpoint] = RateLimitConfig{
		Limit:  limit,
		Window: window,
	}
}

// getClientIdentifier returns a unique identifier for rate limiting
// Priority: tenant_id > user_id > IP address
func (rl *RateLimiter) getClientIdentifier(r *http.Request) string {
	ctx := r.Context()

	// Try to get tenant ID from context
	if tenantID, ok := ctx.Value("tenant_id").(uuid.UUID); ok && tenantID != (uuid.UUID{}) {
		return "tenant:" + tenantID.String()
	}

	// Try to get user ID from auth context
	if userID, ok := ctx.Value("user_id").(uuid.UUID); ok && userID != (uuid.UUID{}) {
		return "user:" + userID.String()
	}

	// Fallback to IP address
	ip := rl.getClientIP(r)
	hash := sha256.Sum256([]byte(ip))
	return "ip:" + hex.EncodeToString(hash[:16]) // Use first 16 bytes for shorter key
}

// getClientIP extracts the real client IP from request headers
func (rl *RateLimiter) getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (for proxies/load balancers)
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		ips := strings.Split(forwarded, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Check X-Real-IP header
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	// Fallback to RemoteAddr
	ip := r.RemoteAddr
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx] // Remove port
	}
	return ip
}

// getLimitForEndpoint returns the rate limit config for the given endpoint
func (rl *RateLimiter) getLimitForEndpoint(path string) (int, time.Duration) {
	// Check for exact match first
	if config, ok := rl.limits[path]; ok {
		return config.Limit, config.Window
	}

	// Check for prefix match (e.g., "/api/v1/auth" matches "/api/v1/auth/login")
	for endpoint, config := range rl.limits {
		if strings.HasPrefix(path, endpoint) {
			return config.Limit, config.Window
		}
	}

	// Return default limits
	return rl.defaultLimit, rl.defaultWindow
}

// RateLimitMiddleware returns a middleware that enforces rate limiting
func (rl *RateLimiter) RateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Skip rate limiting for health check and version endpoints
		if r.URL.Path == "/health" || r.URL.Path == "/version" {
			next.ServeHTTP(w, r)
			return
		}

		// Get client identifier
		clientID := rl.getClientIdentifier(r)

		// Get limits for this endpoint
		limit, window := rl.getLimitForEndpoint(r.URL.Path)

		// Create rate limit key: rate_limit:{client_id}:{path}
		key := "rate_limit:" + clientID + ":" + r.URL.Path

		// Use Redis INCR with EXPIRE for atomic operation
		// This ensures we increment and set expiry atomically
		pipe := rl.redis.Pipeline()
		incrCmd := pipe.Incr(ctx, key)
		pipe.Expire(ctx, key, window)
		_, err := pipe.Exec(ctx)

		if err != nil {
			// Redis error - log and allow request (fail open)
			log.Warn().
				Err(err).
				Str("request_id", GetRequestID(ctx)).
				Str("path", r.URL.Path).
				Msg("Rate limiter Redis error, allowing request")
			next.ServeHTTP(w, r)
			return
		}

		count := int(incrCmd.Val())

		// Check if limit exceeded
		if count > limit {
			// Calculate retry after (time until window resets)
			ttl, err := rl.redis.TTL(ctx, key).Result()
			if err != nil {
				ttl = window // Fallback to full window
			}

			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limit))
			w.Header().Set("X-RateLimit-Remaining", "0")
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(ttl).Unix(), 10))
			w.Header().Set("Retry-After", strconv.Itoa(int(ttl.Seconds())))
			w.WriteHeader(http.StatusTooManyRequests)

			log.Warn().
				Str("request_id", GetRequestID(ctx)).
				Str("client_id", clientID).
				Str("path", r.URL.Path).
				Int("count", count).
				Int("limit", limit).
				Msg("Rate limit exceeded")

			// Record rate limit hit in metrics
			m := metrics.Get()
			if m != nil {
				m.RecordRateLimitHit(r.URL.Path, clientID)
			}

			_, _ = w.Write([]byte(`{"error":"Rate limit exceeded","retry_after":` + strconv.Itoa(int(ttl.Seconds())) + `}`))
			return
		}

		// Set rate limit headers
		remaining := limit - count
		if remaining < 0 {
			remaining = 0
		}

		ttl, err := rl.redis.TTL(ctx, key).Result()
		if err != nil {
			ttl = window
		}

		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limit))
		w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(ttl).Unix(), 10))

		next.ServeHTTP(w, r)
	})
}
