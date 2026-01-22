package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

// DiscountHandler handles discount-related HTTP requests
type DiscountHandler struct {
	svc *service.DiscountService
}

// NewDiscountHandler creates a new discount handler
func NewDiscountHandler(svc *service.DiscountService) *DiscountHandler {
	return &DiscountHandler{svc: svc}
}

// List returns all discounts for the tenant
func (h *DiscountHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	// Parse query params
	includeInactive := r.URL.Query().Get("include_inactive") == "true"
	validOnly := r.URL.Query().Get("valid_only") == "true"

	var items []*service.DiscountDTO
	var err error

	if validOnly {
		items, err = h.svc.ListValid(r.Context(), tenantID)
	} else {
		items, err = h.svc.List(r.Context(), tenantID, includeInactive)
	}

	if err != nil {
		log.Error().Err(err).Msg("Failed to list discounts")
		sendError(w, http.StatusInternalServerError, "Failed to list discounts")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data": items,
		"total": len(items),
	})
}

// Get returns a single discount by ID
func (h *DiscountHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Discount ID is required")
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid discount ID")
		return
	}

	item, err := h.svc.GetByID(r.Context(), tenantID, id)
	if err != nil {
		if err == repository.ErrDiscountNotFound {
			sendError(w, http.StatusNotFound, "Discount not found")
			return
		}
		log.Error().Err(err).Msg("Failed to get discount")
		sendError(w, http.StatusInternalServerError, "Failed to get discount")
		return
	}

	sendJSON(w, http.StatusOK, item)
}

// Create creates a new discount
func (h *DiscountHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var req service.CreateDiscountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	item, err := h.svc.Create(r.Context(), tenantID, &req)
	if err != nil {
		switch err {
		case service.ErrDiscountNameRequired:
			sendError(w, http.StatusBadRequest, "Name is required")
		case service.ErrDiscountTypeInvalid:
			sendError(w, http.StatusBadRequest, "Invalid discount type (must be 'percent' or 'nominal')")
		case service.ErrDiscountValueInvalid:
			sendError(w, http.StatusBadRequest, "Invalid discount value")
		case service.ErrDiscountExpired:
			sendError(w, http.StatusBadRequest, "Discount expiry date must be in the future")
		case repository.ErrDiscountNameTaken:
			sendError(w, http.StatusConflict, "Discount name already exists")
		default:
			log.Error().Err(err).Msg("Failed to create discount")
			sendError(w, http.StatusInternalServerError, "Failed to create discount")
		}
		return
	}

	sendJSON(w, http.StatusCreated, item)
}

// Update updates a discount
func (h *DiscountHandler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Discount ID is required")
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid discount ID")
		return
	}

	var req service.UpdateDiscountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	item, err := h.svc.Update(r.Context(), tenantID, id, &req)
	if err != nil {
		switch err {
		case repository.ErrDiscountNotFound:
			sendError(w, http.StatusNotFound, "Discount not found")
		case service.ErrDiscountNameRequired:
			sendError(w, http.StatusBadRequest, "Name is required")
		case service.ErrDiscountTypeInvalid:
			sendError(w, http.StatusBadRequest, "Invalid discount type (must be 'percent' or 'nominal')")
		case service.ErrDiscountValueInvalid:
			sendError(w, http.StatusBadRequest, "Invalid discount value")
		case service.ErrDiscountExpired:
			sendError(w, http.StatusBadRequest, "Discount expiry date must be in the future")
		case repository.ErrDiscountNameTaken:
			sendError(w, http.StatusConflict, "Discount name already exists")
		default:
			log.Error().Err(err).Msg("Failed to update discount")
			sendError(w, http.StatusInternalServerError, "Failed to update discount")
		}
		return
	}

	sendJSON(w, http.StatusOK, item)
}

// Delete soft deletes a discount
func (h *DiscountHandler) Delete(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Discount ID is required")
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid discount ID")
		return
	}

	if err := h.svc.Delete(r.Context(), tenantID, id); err != nil {
		if err == repository.ErrDiscountNotFound {
			sendError(w, http.StatusNotFound, "Discount not found")
			return
		}
		log.Error().Err(err).Msg("Failed to delete discount")
		sendError(w, http.StatusInternalServerError, "Failed to delete discount")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Discount deleted successfully"})
}

