package handler

import (
	"encoding/json"
	"net/http"

	"rrnet/internal/domain/billing"
	"rrnet/internal/service"
)

type PlatformDiscountHandler struct {
	service *service.PlatformDiscountService
}

func NewPlatformDiscountHandler(service *service.PlatformDiscountService) *PlatformDiscountHandler {
	return &PlatformDiscountHandler{service: service}
}

func (h *PlatformDiscountHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.CreatePlatformDiscountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	d, err := h.service.Create(r.Context(), &req)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, d)
}

func (h *PlatformDiscountHandler) List(w http.ResponseWriter, r *http.Request) {
	includeInactive := r.URL.Query().Get("include_inactive") == "true"
	discounts, err := h.service.List(r.Context(), includeInactive)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to retrieve discounts")
		return
	}
	if discounts == nil {
		discounts = []*billing.PlatformDiscount{}
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":  discounts,
		"total": len(discounts),
	})
}

func (h *PlatformDiscountHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, ok := getUUIDParam(r, "id")
	if !ok {
		sendError(w, http.StatusBadRequest, "Invalid discount ID")
		return
	}

	d, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		sendError(w, http.StatusNotFound, "Discount not found")
		return
	}

	sendJSON(w, http.StatusOK, d)
}

func (h *PlatformDiscountHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := getUUIDParam(r, "id")
	if !ok {
		sendError(w, http.StatusBadRequest, "Invalid discount ID")
		return
	}

	var req service.UpdatePlatformDiscountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	d, err := h.service.Update(r.Context(), id, &req)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, d)
}

func (h *PlatformDiscountHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := getUUIDParam(r, "id")
	if !ok {
		sendError(w, http.StatusBadRequest, "Invalid discount ID")
		return
	}

	if err := h.service.Delete(r.Context(), id); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to delete discount")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlatformDiscountHandler) Validate(w http.ResponseWriter, r *http.Request) {
	type validateReq struct {
		Code   string  `json:"code"`
		Amount float64 `json:"amount"`
	}
	var req validateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	d, discountAmount, err := h.service.ValidateCode(r.Context(), req.Code, req.Amount)
	if err != nil {
		sendError(w, http.StatusNotFound, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"discount_id":     d.ID,
		"code":            d.Code,
		"discount_amount": discountAmount,
		"final_amount":    req.Amount - discountAmount,
	})
}
