package handler

import (
	"net/http"
	"strings"

	"github.com/google/uuid"
)

// getParam tries to read a path parameter that may be provided either:
// - via our custom setPathParam()/getPathParam context mechanism, or
// - via Go's ServeMux PathValue (Go 1.22 patterns), or
// - as a last resort, from the URL path segment.
//
// This keeps handlers robust across different routing strategies.
func getParam(r *http.Request, key string) string {
	if r == nil {
		return ""
	}

	if v := strings.TrimSpace(getPathParam(r, key)); v != "" {
		return v
	}

	// Go 1.22+ ServeMux path params
	if v := strings.TrimSpace(r.PathValue(key)); v != "" {
		return v
	}

	// Fallback: last path segment
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) == 0 {
		return ""
	}
	return strings.TrimSpace(parts[len(parts)-1])
}

// getUUIDParam extracts a UUID from either path params or the URL path.
// It tries multiple strategies so handlers don't depend on a specific router implementation.
func getUUIDParam(r *http.Request, key string) (uuid.UUID, bool) {
	// 1) preferred: whatever getParam returns
	if v := strings.TrimSpace(getParam(r, key)); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			return id, true
		}
	}

	// 2) try ANY path segment that looks like a UUID
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	for i := len(parts) - 1; i >= 0; i-- {
		if id, err := uuid.Parse(strings.TrimSpace(parts[i])); err == nil {
			return id, true
		}
	}

	return uuid.Nil, false
}


