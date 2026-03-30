package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	paymentmethod "rrnet/internal/domain/payment_method"
	"rrnet/internal/service"
)

type PaymentMethodHandler struct {
	service *service.PaymentMethodService
}

func NewPaymentMethodHandler(service *service.PaymentMethodService) *PaymentMethodHandler {
	return &PaymentMethodHandler{service: service}
}

func (h *PaymentMethodHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	pms, err := h.service.ListByTenant(r.Context(), tenantID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": pms})
}

func (h *PaymentMethodHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var pm paymentmethod.PaymentMethod
	if err := json.NewDecoder(r.Body).Decode(&pm); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.Create(r.Context(), tenantID, &pm); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(pm)
}

func (h *PaymentMethodHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	var pm paymentmethod.PaymentMethod
	if err := json.NewDecoder(r.Body).Decode(&pm); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}
	pm.ID = id

	if err := h.service.Update(r.Context(), &pm); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pm)
}

func (h *PaymentMethodHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.Delete(r.Context(), id); err != nil {
		if err == service.ErrPaymentMethodInUse {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ============================================
// Super Admin Payment Method Handlers
// ============================================

// ListPaymentMethods handles GET /api/v1/superadmin/payment-methods
func (h *PaymentMethodHandler) ListPaymentMethods(w http.ResponseWriter, r *http.Request) {
	methods, err := h.service.ListPaymentMethods(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to retrieve payment methods")
		return
	}

	sendJSON(w, http.StatusOK, methods)
}

// CreatePaymentMethod handles POST /api/v1/superadmin/payment-methods
func (h *PaymentMethodHandler) CreatePaymentMethod(w http.ResponseWriter, r *http.Request) {
	var req service.CreatePaymentMethodRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	pm, err := h.service.CreatePaymentMethod(r.Context(), &req)
	if err != nil {
		if err == service.ErrInvalidCategory {
			sendError(w, http.StatusBadRequest, err.Error())
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to create payment method")
		return
	}

	sendJSON(w, http.StatusCreated, pm)
}

// GetPaymentMethod handles GET /api/v1/superadmin/payment-methods/:id
func (h *PaymentMethodHandler) GetPaymentMethod(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid payment method ID")
		return
	}

	pm, err := h.service.GetPaymentMethod(r.Context(), id)
	if err != nil {
		if err == service.ErrPaymentMethodNotFound {
			sendError(w, http.StatusNotFound, "Payment method not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to retrieve payment method")
		return
	}

	sendJSON(w, http.StatusOK, pm)
}

// UpdatePaymentMethod handles PUT /api/v1/superadmin/payment-methods/:id
func (h *PaymentMethodHandler) UpdatePaymentMethod(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid payment method ID")
		return
	}

	var req service.UpdatePaymentMethodRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	pm, err := h.service.UpdatePaymentMethod(r.Context(), id, &req)
	if err != nil {
		if err == service.ErrPaymentMethodNotFound {
			sendError(w, http.StatusNotFound, "Payment method not found")
			return
		}
		if err == service.ErrInvalidCategory {
			sendError(w, http.StatusBadRequest, err.Error())
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to update payment method")
		return
	}

	sendJSON(w, http.StatusOK, pm)
}

// DeletePaymentMethod handles DELETE /api/v1/superadmin/payment-methods/:id
func (h *PaymentMethodHandler) DeletePaymentMethod(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid payment method ID")
		return
	}

	if err := h.service.DeletePaymentMethod(r.Context(), id); err != nil {
		if err == service.ErrPaymentMethodNotFound {
			sendError(w, http.StatusNotFound, "Payment method not found")
			return
		}
		if err == service.ErrPaymentMethodInUse {
			sendError(w, http.StatusConflict, err.Error())
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to delete payment method")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Payment method deleted successfully"})
}

// TogglePaymentMethodStatus handles PATCH /api/v1/superadmin/payment-methods/:id/toggle
func (h *PaymentMethodHandler) TogglePaymentMethodStatus(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid payment method ID")
		return
	}

	pm, err := h.service.ToggleStatus(r.Context(), id)
	if err != nil {
		if err == service.ErrPaymentMethodNotFound {
			sendError(w, http.StatusNotFound, "Payment method not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to toggle payment method status")
		return
	}

	sendJSON(w, http.StatusOK, pm)
}

// ============================================
// Public Payment Method Handlers (No Auth Required)
// ============================================

// ListActivePaymentMethods handles GET /api/v1/public/payment-methods
// Returns only active platform-level payment methods for registration/waiting approval pages
func (h *PaymentMethodHandler) ListActivePaymentMethods(w http.ResponseWriter, r *http.Request) {
	methods, err := h.service.ListPaymentMethods(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to retrieve payment methods")
		return
	}

	// Filter only active methods
	activeMethods := []*paymentmethod.PaymentMethod{}
	for _, method := range methods {
		if method.IsActive {
			activeMethods = append(activeMethods, method)
		}
	}

	sendJSON(w, http.StatusOK, activeMethods)
}
