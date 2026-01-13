package contracts

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"

)

// APIValidator validates API contracts between modules
type APIValidator struct {
	handler http.Handler
}

// NewAPIValidator creates a new API validator
func NewAPIValidator(h http.Handler) *APIValidator {
	return &APIValidator{
		handler: h,
	}
}

// APIValidationResult represents the result of an API validation
type APIValidationResult struct {
	Valid       bool
	Message     string
	Endpoint    string
	Method      string
	StatusCode  int
	Errors      []string
}

// ValidateEndpoint validates an API endpoint contract
func (v *APIValidator) ValidateEndpoint(
	ctx context.Context,
	method, path string,
	headers map[string]string,
	body string,
) (*APIValidationResult, error) {
	result := &APIValidationResult{
		Valid:    true,
		Endpoint: path,
		Method:   method,
		Errors:   []string{},
	}

	// Create request
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	req = req.WithContext(ctx)

	// Create response recorder
	w := httptest.NewRecorder()

	// Execute request
	v.handler.ServeHTTP(w, req)

	result.StatusCode = w.Code

	// Validate status code
	if w.Code >= 400 && w.Code < 500 {
		// Client error - might be expected (e.g., 401 for unauthenticated)
		if w.Code == http.StatusUnauthorized {
			result.Valid = true
			result.Message = "Endpoint requires authentication (expected)"
		} else {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("Client error: %d", w.Code))
		}
	} else if w.Code >= 500 {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("Server error: %d", w.Code))
	} else {
		result.Valid = true
		result.Message = fmt.Sprintf("Endpoint responded with status %d", w.Code)
	}

	// Validate response format (basic JSON check)
	contentType := w.Header().Get("Content-Type")
	if !strings.Contains(contentType, "application/json") && w.Code < 300 {
		result.Errors = append(result.Errors, "Response is not JSON")
	}

	return result, nil
}

// ValidateAPIContract validates API contract compliance
func (v *APIValidator) ValidateAPIContract(
	ctx context.Context,
	endpoints []struct {
		Method  string
		Path    string
		Headers map[string]string
		Body    string
	},
) ([]*APIValidationResult, error) {
	results := []*APIValidationResult{}

	for _, endpoint := range endpoints {
		result, err := v.ValidateEndpoint(ctx, endpoint.Method, endpoint.Path, endpoint.Headers, endpoint.Body)
		if err != nil {
			return nil, err
		}
		results = append(results, result)
	}

	return results, nil
}

