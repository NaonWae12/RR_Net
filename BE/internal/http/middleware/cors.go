package middleware

import (
	"net/http"
	"strconv"
	"strings"
)

// CORSConfig holds CORS configuration
type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods  []string
	AllowedHeaders  []string
	ExposedHeaders  []string
	AllowCredentials bool
	MaxAge          int
}

// DefaultCORSConfig returns a default CORS configuration
func DefaultCORSConfig() *CORSConfig {
	return &CORSConfig{
		// Allow explicit origins for development and production
		// When AllowCredentials is true, wildcard "*" is not allowed by CORS spec
		AllowedOrigins: []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://72.60.74.209:3000", // VPS production frontend
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization", "X-Tenant-Slug", "X-Request-ID", "X-CSRF-Token"},
		ExposedHeaders:   []string{"X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           86400, // 24 hours
	}
}

// CORS middleware handles CORS requests
func CORS(config *CORSConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		
		// Check if origin is allowed
		allowed := false
		var allowedOrigin string
		if len(config.AllowedOrigins) == 1 && config.AllowedOrigins[0] == "*" {
			// Wildcard is only allowed when AllowCredentials is false
			allowed = true
			allowedOrigin = "*"
		} else {
			for _, ao := range config.AllowedOrigins {
				if origin == ao {
					allowed = true
					allowedOrigin = origin
					break
				}
			}
		}
		
		// Only set CORS headers if origin is allowed
		if allowed && allowedOrigin != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			
			if config.AllowCredentials {
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
			
			// Expose headers so frontend can read them (including X-CSRF-Token)
			w.Header().Set("Access-Control-Expose-Headers", strings.Join(config.ExposedHeaders, ", "))
			
			// Handle preflight requests
			if r.Method == http.MethodOptions {
				w.Header().Set("Access-Control-Allow-Methods", strings.Join(config.AllowedMethods, ", "))
				w.Header().Set("Access-Control-Allow-Headers", strings.Join(config.AllowedHeaders, ", "))
				w.Header().Set("Access-Control-Max-Age", strconv.Itoa(config.MaxAge))
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		
		next.ServeHTTP(w, r)
		})
	}
}

