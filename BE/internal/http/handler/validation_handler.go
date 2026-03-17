package handler

import (
	"net/http"

	"rrnet/internal/repository"
)

// ValidationHandler handles validation endpoints
type ValidationHandler struct {
	userRepo   *repository.UserRepository
	tenantRepo *repository.TenantRepository
}

// NewValidationHandler creates a new validation handler
func NewValidationHandler(userRepo *repository.UserRepository, tenantRepo *repository.TenantRepository) *ValidationHandler {
	return &ValidationHandler{userRepo: userRepo, tenantRepo: tenantRepo}
}

// CheckEmailAvailable handles GET /api/v1/validation/email?email=xxx
func (h *ValidationHandler) CheckEmailAvailable(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		sendJSON(w, http.StatusBadRequest, map[string]interface{}{
			"available": false,
			"message":   "Email parameter is required",
		})
		return
	}

	exists, err := h.userRepo.CheckEmailExists(r.Context(), email)
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"available": false,
			"message":   "Failed to check email availability",
		})
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"available": !exists,
		"message":   getMessage(!exists, "email"),
	})
}

// CheckPhoneAvailable handles GET /api/v1/validation/phone?phone=xxx
func (h *ValidationHandler) CheckPhoneAvailable(w http.ResponseWriter, r *http.Request) {
	phone := r.URL.Query().Get("phone")
	if phone == "" {
		sendJSON(w, http.StatusBadRequest, map[string]interface{}{
			"available": false,
			"message":   "Phone parameter is required",
		})
		return
	}

	exists, err := h.userRepo.CheckPhoneExists(r.Context(), phone)
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"available": false,
			"message":   "Failed to check phone availability",
		})
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"available": !exists,
		"message":   getMessage(!exists, "phone"),
	})
}

// CheckSlugAvailable handles GET /api/v1/validation/slug?slug=xxx
func (h *ValidationHandler) CheckSlugAvailable(w http.ResponseWriter, r *http.Request) {
	slug := r.URL.Query().Get("slug")
	if slug == "" {
		sendJSON(w, http.StatusBadRequest, map[string]interface{}{
			"available": false,
			"message":   "Slug parameter is required",
		})
		return
	}

	exists, err := h.tenantRepo.SlugExists(r.Context(), slug, nil)
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"available": false,
			"message":   "Failed to check slug availability",
		})
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"available": !exists,
		"message":   getMessage(!exists, "slug"),
	})
}

func getMessage(available bool, field string) string {
	if available {
		return field + " is available"
	}
	return field + " is already registered"
}
