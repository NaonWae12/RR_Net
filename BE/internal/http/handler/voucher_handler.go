package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/service"
)

type VoucherHandler struct {
	voucherService *service.VoucherService
}

func NewVoucherHandler(voucherService *service.VoucherService) *VoucherHandler {
	return &VoucherHandler{voucherService: voucherService}
}

// ========== Voucher Packages ==========

func (h *VoucherHandler) ListPackages(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	activeOnly := r.URL.Query().Get("active") == "true"

	packages, err := h.voucherService.ListPackages(r.Context(), tenantID, activeOnly)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  packages,
		"total": len(packages),
	})
}

func (h *VoucherHandler) GetPackage(w http.ResponseWriter, r *http.Request) {
	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid package ID"}`, http.StatusBadRequest)
		return
	}

	pkg, err := h.voucherService.GetPackage(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pkg)
}

func (h *VoucherHandler) CreatePackage(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	var req service.CreateVoucherPackageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.DownloadSpeed <= 0 || req.UploadSpeed <= 0 {
		http.Error(w, `{"error":"Name, download_speed and upload_speed are required"}`, http.StatusBadRequest)
		return
	}

	pkg, err := h.voucherService.CreatePackage(r.Context(), tenantID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(pkg)
}

func (h *VoucherHandler) UpdatePackage(w http.ResponseWriter, r *http.Request) {
	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid package ID"}`, http.StatusBadRequest)
		return
	}

	var req service.UpdateVoucherPackageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	pkg, err := h.voucherService.UpdatePackage(r.Context(), id, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pkg)
}

func (h *VoucherHandler) DeletePackage(w http.ResponseWriter, r *http.Request) {
	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid package ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.voucherService.DeletePackage(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *VoucherHandler) SyncPackageToRouters(w http.ResponseWriter, r *http.Request) {
	idStr := getParam(r, "id")
	packageID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid package ID"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		RouterIDs []uuid.UUID `json:"router_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if len(req.RouterIDs) == 0 {
		http.Error(w, `{"error":"router_ids is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.voucherService.SyncPackageToRouters(r.Context(), packageID, req.RouterIDs); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Package synced successfully",
	})
}

// ========== Vouchers ==========

func (h *VoucherHandler) GenerateVouchers(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	var req service.GenerateVouchersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	vouchers, err := h.voucherService.GenerateVouchers(r.Context(), tenantID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  vouchers,
		"total": len(vouchers),
	})
}

func (h *VoucherHandler) ListVouchers(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	vouchers, total, err := h.voucherService.ListVouchers(r.Context(), tenantID, limit, offset)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":   vouchers,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *VoucherHandler) ToggleVoucherStatus(w http.ResponseWriter, r *http.Request) {
	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid voucher ID"}`, http.StatusBadRequest)
		return
	}

	voucher, err := h.voucherService.ToggleVoucherStatus(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(voucher)
}

func (h *VoucherHandler) DeleteVoucher(w http.ResponseWriter, r *http.Request) {
	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid voucher ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.voucherService.DeleteVoucher(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
