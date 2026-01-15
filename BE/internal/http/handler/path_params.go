package handler

import (
	"net/http"
	"strings"
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


