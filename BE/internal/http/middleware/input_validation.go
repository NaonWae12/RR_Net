package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/rs/zerolog/log"
)

// RequestSizeLimits holds configurable request size limits
type RequestSizeLimits struct {
	MaxRequestSize   int64 // General request size limit
	MaxJSONSize      int64 // JSON body size limit
	MaxMultipartSize int64 // Multipart form size limit
}

// NewRequestSizeLimits creates request size limits from config
func NewRequestSizeLimits(maxRequest, maxJSON, maxMultipart int64) *RequestSizeLimits {
	return &RequestSizeLimits{
		MaxRequestSize:   maxRequest,
		MaxJSONSize:      maxJSON,
		MaxMultipartSize: maxMultipart,
	}
}

// InputValidationMiddleware validates request input with configurable limits
func InputValidationMiddleware(limits *RequestSizeLimits) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			// Validate Content-Length to prevent large payload attacks
			if r.ContentLength > limits.MaxRequestSize {
				log.Warn().
					Str("request_id", GetRequestID(ctx)).
					Int64("content_length", r.ContentLength).
					Int64("max_size", limits.MaxRequestSize).
					Msg("Request body too large")
				sendJSONError(w, http.StatusRequestEntityTooLarge, 
					fmt.Sprintf("Request body too large. Maximum size: %d bytes", limits.MaxRequestSize))
				return
			}

			// Validate Content-Type for POST/PUT/PATCH requests
			if r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch {
				contentType := r.Header.Get("Content-Type")
				if contentType != "" {
					// Check for specific content type limits
					if strings.HasPrefix(contentType, "application/json") {
						if r.ContentLength > limits.MaxJSONSize {
							sendJSONError(w, http.StatusRequestEntityTooLarge,
								fmt.Sprintf("JSON body too large. Maximum size: %d bytes", limits.MaxJSONSize))
							return
						}
					} else if strings.HasPrefix(contentType, "multipart/form-data") {
						if r.ContentLength > limits.MaxMultipartSize {
							sendJSONError(w, http.StatusRequestEntityTooLarge,
								fmt.Sprintf("Multipart body too large. Maximum size: %d bytes", limits.MaxMultipartSize))
							return
						}
					} else if !strings.HasPrefix(contentType, "application/x-www-form-urlencoded") {
						// Allow form-urlencoded but reject other types
						sendJSONError(w, http.StatusUnsupportedMediaType,
							"Invalid Content-Type. Supported types: application/json, multipart/form-data, application/x-www-form-urlencoded")
						return
					}
				}
			}

			// Validate query parameters with improved logic
			if err := validateQueryParams(r); err != nil {
				log.Warn().
					Str("request_id", GetRequestID(ctx)).
					Err(err).
					Str("path", r.URL.Path).
					Msg("Query parameter validation failed")
				sendJSONError(w, http.StatusBadRequest, err.Error())
				return
			}

			// Limit request body reading to prevent DoS
			r.Body = http.MaxBytesReader(w, r.Body, limits.MaxRequestSize)

			next.ServeHTTP(w, r)
		})
	}
}

// validateQueryParams validates query parameters with improved logic
func validateQueryParams(r *http.Request) error {
	// More targeted dangerous patterns (reduce false positives)
	dangerousPatterns := []struct {
		pattern string
		reason  string
	}{
		{"';", "SQL injection attempt"},
		{"--", "SQL comment injection"},
		{"/*", "SQL block comment start"},
		{"*/", "SQL block comment end"},
		{"xp_", "SQL extended procedure"},
		{"sp_", "SQL stored procedure"},
		{"<script", "XSS attempt"},
		{"javascript:", "XSS attempt"},
		{"onerror=", "XSS attempt"},
		{"onload=", "XSS attempt"},
	}

	for key, values := range r.URL.Query() {
		// Validate key length
		if len(key) > 100 {
			return fmt.Errorf("query parameter key too long: %s (max 100 characters)", key)
		}

		for _, value := range values {
			// Limit query parameter length
			if len(value) > 1000 {
				return fmt.Errorf("query parameter value too long for '%s' (max 1000 characters)", key)
			}

			// Check for dangerous patterns (case-insensitive)
			lowerValue := strings.ToLower(value)
			for _, pattern := range dangerousPatterns {
				if strings.Contains(lowerValue, pattern.pattern) {
					return fmt.Errorf("invalid query parameter '%s': %s", key, pattern.reason)
				}
			}
		}
	}

	return nil
}

// sendJSONError sends a JSON error response
func sendJSONError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}

