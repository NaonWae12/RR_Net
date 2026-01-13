package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"

	"github.com/rs/zerolog/log"
	"rrnet/internal/metrics"
)

const (
	csrfTokenHeader = "X-CSRF-Token"
	csrfCookieName = "csrf_token"
	csrfTokenLength = 32
	csrfCookieMaxAge = 3600 // 1 hour
)

// CSRFProtection implements double-submit cookie pattern for CSRF protection
type CSRFProtection struct {
	exemptPaths []string // Paths that don't require CSRF protection
	cookieSecure bool   // Set Secure flag (HTTPS only)
	cookieSameSite http.SameSite
}

// NewCSRFProtection creates a new CSRF protection middleware
func NewCSRFProtection(exemptPaths []string, cookieSecure bool, cookieSameSite http.SameSite) *CSRFProtection {
	return &CSRFProtection{
		exemptPaths:   exemptPaths,
		cookieSecure: cookieSecure,
		cookieSameSite: cookieSameSite,
	}
}

// generateToken generates a random CSRF token
func generateToken() (string, error) {
	bytes := make([]byte, csrfTokenLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate CSRF token: %w", err)
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// isExemptPath checks if the path is exempt from CSRF protection
func (c *CSRFProtection) isExemptPath(path string) bool {
	for _, exempt := range c.exemptPaths {
		if path == exempt || (len(exempt) > 0 && exempt[len(exempt)-1] == '*' && 
			len(path) >= len(exempt)-1 && path[:len(exempt)-1] == exempt[:len(exempt)-1]) {
			return true
		}
	}
	return false
}

// isStateChangingMethod checks if the HTTP method changes state
func isStateChangingMethod(method string) bool {
	return method == http.MethodPost || method == http.MethodPut || 
		   method == http.MethodPatch || method == http.MethodDelete
}

// CSRFMiddleware returns a middleware that enforces CSRF protection
func (c *CSRFProtection) CSRFMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Skip CSRF check for exempt paths
		if c.isExemptPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		// Only check CSRF for state-changing methods
		if !isStateChangingMethod(r.Method) {
			// For GET requests, set CSRF token cookie if not present
			if r.Method == http.MethodGet {
				cookie, err := r.Cookie(csrfCookieName)
				token := ""
				
				if err != nil || cookie == nil || cookie.Value == "" {
					// Generate new token
					var genErr error
					token, genErr = generateToken()
					if genErr != nil {
						log.Error().Err(genErr).Msg("Failed to generate CSRF token")
						next.ServeHTTP(w, r)
						return
					}

					http.SetCookie(w, &http.Cookie{
						Name:     csrfCookieName,
						Value:    token,
						Path:     "/",
						MaxAge:   csrfCookieMaxAge,
						HttpOnly: false, // Must be accessible to JavaScript for double-submit
						Secure:   c.cookieSecure,
						SameSite: c.cookieSameSite,
					})
				} else {
					// Use existing token from cookie
					token = cookie.Value
				}
				
				// IMPORTANT: Always expose CSRF token in response header for frontend to read
				// This is needed because frontend (localhost:3000) cannot read cookie from backend (localhost:8080)
				// Frontend will send this token back in X-CSRF-Token header for state-changing requests
				if token != "" {
					w.Header().Set("X-CSRF-Token", token)
				}
			}
			next.ServeHTTP(w, r)
			return
		}

		// Get token from cookie
		cookie, err := r.Cookie(csrfCookieName)
		if err != nil || cookie == nil || cookie.Value == "" {
			log.Warn().
				Str("request_id", GetRequestID(ctx)).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Msg("CSRF token cookie missing")
			
			// Record CSRF hit in metrics
			m := metrics.Get()
			if m != nil {
				m.RecordCSRFHit(r.URL.Path, "cookie_missing")
			}
			
			http.Error(w, "CSRF token missing", http.StatusForbidden)
			return
		}

		cookieToken := cookie.Value

		// Get token from header
		headerToken := r.Header.Get(csrfTokenHeader)
		if headerToken == "" {
			log.Warn().
				Str("request_id", GetRequestID(ctx)).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Msg("CSRF token header missing")
			
			// Record CSRF hit in metrics
			m := metrics.Get()
			if m != nil {
				m.RecordCSRFHit(r.URL.Path, "header_missing")
			}
			
			http.Error(w, "CSRF token header missing", http.StatusForbidden)
			return
		}

		// Compare tokens (double-submit cookie pattern)
		if cookieToken != headerToken {
			log.Warn().
				Str("request_id", GetRequestID(ctx)).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Msg("CSRF token mismatch")
			
			// Record CSRF hit in metrics
			m := metrics.Get()
			if m != nil {
				m.RecordCSRFHit(r.URL.Path, "token_mismatch")
			}
			
			http.Error(w, "CSRF token mismatch", http.StatusForbidden)
			return
		}

		// Token is valid, proceed
		next.ServeHTTP(w, r)
	})
}

// DefaultCSRFProtection returns CSRF protection with sensible defaults
func DefaultCSRFProtection() *CSRFProtection {
	// Exempt paths that don't need CSRF protection
	exemptPaths := []string{
		"/health",
		"/version",
		"/api/v1/auth/login",
		"/api/v1/auth/register",
		"/api/v1/auth/refresh",
		"/api/v1/auth/logout", // Logout is typically safe
		// Public (non-JWT) endpoints authenticated by shared-secret headers
		"/api/v1/radius/*",
	}

	return NewCSRFProtection(
		exemptPaths,
		false, // Secure cookie only in production with HTTPS
		http.SameSiteLaxMode, // LaxMode allows cookies in cross-origin GET requests and same-origin POST/PATCH/etc
	)
}

