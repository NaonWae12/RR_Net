package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/domain/service_package"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

type ServicePackageHandler struct {
	svc *service.ServicePackageService
}

func NewServicePackageHandler(svc *service.ServicePackageService) *ServicePackageHandler {
	return &ServicePackageHandler{svc: svc}
}

func (h *ServicePackageHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	activeOnly := true
	if v := r.URL.Query().Get("active_only"); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			activeOnly = b
		}
	}

	var cat *service_package.Category
	if v := r.URL.Query().Get("category"); v != "" {
		c := service_package.Category(v)
		cat = &c
	}

	items, err := h.svc.List(r.Context(), tenantID, activeOnly, cat)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to list service packages")
		return
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{"data": items})
}

func (h *ServicePackageHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Service package ID is required")
		return
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid service package ID")
		return
	}

	item, err := h.svc.GetByID(r.Context(), tenantID, id)
	if err != nil {
		if err == repository.ErrServicePackageNotFound {
			sendError(w, http.StatusNotFound, "Service package not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to get service package")
		return
	}
	sendJSON(w, http.StatusOK, item)
}

func (h *ServicePackageHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var req service.CreateServicePackageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	item, err := h.svc.Create(r.Context(), tenantID, &req)
	if err != nil {
		switch err {
		case service.ErrServicePackageNameRequired:
			sendError(w, http.StatusBadRequest, "Name is required")
		case service.ErrServicePackageInvalidCategory, service.ErrServicePackageInvalidPricing:
			sendError(w, http.StatusBadRequest, "Invalid category/pricing")
		case service.ErrServicePackageProfileRequired:
			sendError(w, http.StatusBadRequest, "Network profile is required")
		case service.ErrServicePackagePriceInvalid:
			sendError(w, http.StatusBadRequest, "Invalid price")
		case repository.ErrServicePackageNameTaken:
			sendError(w, http.StatusConflict, "Package name already exists")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to create service package")
		}
		return
	}
	sendJSON(w, http.StatusCreated, item)
}

func (h *ServicePackageHandler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Service package ID is required")
		return
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid service package ID")
		return
	}

	var req service.UpdateServicePackageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	item, err := h.svc.Update(r.Context(), tenantID, id, &req)
	if err != nil {
		switch err {
		case repository.ErrServicePackageNotFound:
			sendError(w, http.StatusNotFound, "Service package not found")
		case service.ErrServicePackageNameRequired:
			sendError(w, http.StatusBadRequest, "Name is required")
		case service.ErrServicePackageInvalidCategory, service.ErrServicePackageInvalidPricing:
			sendError(w, http.StatusBadRequest, "Invalid category/pricing")
		case service.ErrServicePackageProfileRequired:
			sendError(w, http.StatusBadRequest, "Network profile is required")
		case service.ErrServicePackagePriceInvalid:
			sendError(w, http.StatusBadRequest, "Invalid price")
		case repository.ErrServicePackageNameTaken:
			sendError(w, http.StatusConflict, "Package name already exists")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to update service package")
		}
		return
	}
	sendJSON(w, http.StatusOK, item)
}

func (h *ServicePackageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Service package ID is required")
		return
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid service package ID")
		return
	}

	if err := h.svc.Delete(r.Context(), tenantID, id); err != nil {
		if err == repository.ErrServicePackageNotFound {
			sendError(w, http.StatusNotFound, "Service package not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to delete service package")
		return
	}
	sendJSON(w, http.StatusOK, map[string]bool{"ok": true})
}


